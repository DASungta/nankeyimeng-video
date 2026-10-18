"""Even out a Muse clip's camera move and give it a film shutter's motion blur.

The director found the camera moves in the dream (2026-10-17) looked like a low frame rate. Two causes, both measured:
- the cadence: Muse's camera moves come in an 8-frame cycle, and in some clips (S08, S13, S15) the last step of each
  cycle is about 30 % longer than the others (a skipped frame), so the move hitches three times a second; in the
  rest it wavers by 5–10 % (S07, S10C, S12B, S12). tools/dejudder.py only catches steps about twice the norm.
- no motion blur: every Muse frame is perfectly sharp, so a move of several pixels a frame across fine ink lines
  strobes at 24 fps. A film camera blurs each frame over the half of the frame interval its shutter is open.

So this measures the camera's motion between frames (ORB features on a half-size copy, a RANSAC similarity
transform, the mean displacement it gives over the frame), smooths the step sizes over the cycle (a centred moving
average WINDOW frames wide), and resamples the clip at the smoothed positions; each new frame is the average of
sub-frames spread over SHUTTER of a frame interval, each made by warping the two neighbouring frames towards each
other along dense optical flow (DIS). Where the camera hardly moves nothing is blurred. The frame count, the frame
rate and the sound stay as they are, so in-points in edl.json do not change.

Usage (from nanke/): python -I tools/smooth_motion.py muse/S10C-v1.mp4 muse/S10C-v1-sm.mp4 [--window 8] [--shutter 0.5]
Writes DST and DST.json (per frame: the measured step, the source position used, and how many sub-frames).
"""
import argparse
import json
import os
import subprocess
import sys

sys.path.append(os.path.expandvars(r"%APPDATA%\Python\Python312\site-packages"))
import cv2  # noqa: E402
import numpy as np  # noqa: E402

ap = argparse.ArgumentParser()
ap.add_argument("src")
ap.add_argument("dst")
ap.add_argument("--window", type=int, default=8, help="frames to average the step sizes over (the cadence cycle)")
ap.add_argument("--shutter", type=float, default=0.5, help="fraction of a frame interval each frame is blurred over")
ap.add_argument("--max-shift", type=float, default=1.0, help="how many frames a frame may move in time")
ap.add_argument("--measure", choices=["camera", "ratio"], default="camera",
                help="camera: fit one pan/tilt/push to the flow (flat gongbi pictures); ratio: compare every pixel's "
                     "move with the same pixel over the neighbouring steps (live action with depth, where near and far "
                     "move at different speeds and a single fit jumps between them)")
args = ap.parse_args()

cap = cv2.VideoCapture(args.src)
fps = cap.get(cv2.CAP_PROP_FPS)
frames = []
while True:
    ok, f = cap.read()
    if not ok:
        break
    frames.append(f)
n = len(frames)
h, w = frames[0].shape[:2]
gray = [cv2.cvtColor(f, cv2.COLOR_BGR2GRAY) for f in frames]

# ---- the camera's step between frames, in pixels of the source ----
# A similarity transform (pan, tilt, push) fitted with RANSAC to the dense flow on a grid, so riders, banners and
# the like moving on their own do not count. Not ORB features: on the gongbi clips they lock onto the silk weave,
# which stays put on the screen while the painting moves, and the steps came out as 0, 3, 0, 3 …
dis = cv2.DISOpticalFlow_create(cv2.DISOPTICAL_FLOW_PRESET_MEDIUM)
hs, ws = h // 2, w // 2
gy, gx = np.mgrid[hs * 0.06:hs * 0.94:24j, ws * 0.04:ws * 0.96:40j]
pts = np.stack([gx.ravel(), gy.ravel()], 1).astype(np.float32)
grid = np.c_[pts, np.ones(len(pts))]


def camera_step(a, b):
    sa, sb = cv2.resize(a, (ws, hs), interpolation=cv2.INTER_AREA), cv2.resize(b, (ws, hs), interpolation=cv2.INTER_AREA)
    f = dis.calc(sa, sb, None)
    d = f[pts[:, 1].astype(int), pts[:, 0].astype(int)]
    M, inl = cv2.estimateAffinePartial2D(pts, pts + d, method=cv2.RANSAC, ransacReprojThreshold=0.5)
    if M is None or inl.sum() < len(pts) * 0.3:
        return 2 * float(np.median(np.linalg.norm(f, axis=2)))
    return 2 * float(np.linalg.norm(grid @ M.T - pts, axis=1).mean())


def ratio_steps():
    """The time each step covers relative to its neighbours (the median over pixels of how far each pixel moved
    against its own average over the four steps either side), times the overall speed, smoothed."""
    mags = []
    for i in range(n - 1):
        sa = cv2.resize(gray[i], (ws, hs), interpolation=cv2.INTER_AREA)
        sb = cv2.resize(gray[i + 1], (ws, hs), interpolation=cv2.INTER_AREA)
        mags.append(cv2.resize(np.linalg.norm(dis.calc(sa, sb, None), axis=2), (ws // 4, hs // 4), interpolation=cv2.INTER_AREA))
    m = np.array(mags)
    speed = 2 * np.median(m.reshape(len(m), -1), axis=1)
    trend = np.array([np.median(speed[max(0, i - 4):i + 5]) for i in range(len(speed))])
    r = np.ones(len(m))
    for i in range(len(m)):
        nb = np.r_[m[max(0, i - 4):i], m[i + 1:i + 5]].mean(0)
        ok = nb > 0.15
        if ok.sum() > 100:
            r[i] = np.median(m[i][ok] / nb[ok])
    return trend * r


step = ratio_steps() if args.measure == "ratio" else np.array([camera_step(gray[i], gray[i + 1]) for i in range(n - 1)])

# ---- where each output frame samples the source ----
k = args.window
pad = np.r_[np.full(k, step[0]), step, np.full(k, step[-1])]
smooth = np.convolve(pad, np.ones(k) / k, mode="same")[k:-k]
smooth *= step.sum() / max(smooth.sum(), 1e-9)
eps = 1e-4  # keeps the progress strictly increasing where the camera is still
P = np.r_[0, np.cumsum(step + eps)]
Q = np.r_[0, np.cumsum(smooth + eps)]
pos = np.interp(Q, P, np.arange(n, dtype=np.float64))
pos = np.clip(pos, np.arange(n) - args.max_shift, np.arange(n) + args.max_shift)  # by default never more than a frame from where it was
pos[0], pos[-1] = 0, n - 1

# ---- in-between frames along the flow ----
flows = {}


def flow(i, j):
    if (i, j) not in flows:
        if len(flows) > 8:
            flows.pop(next(iter(flows)))
        flows[(i, j)] = dis.calc(gray[i], gray[j], None)
    return flows[(i, j)]


base = np.stack(np.meshgrid(np.arange(w, dtype=np.float32), np.arange(h, dtype=np.float32)), -1)


def at(x):
    """The frame at fractional source position x."""
    x = min(max(x, 0.0), n - 1.0)
    i = min(int(np.floor(x)), n - 2)
    t = x - i
    if t < 1e-3:
        return frames[i].astype(np.float32)
    if t > 1 - 1e-3:
        return frames[i + 1].astype(np.float32)
    fa, fb = flow(i, i + 1), flow(i + 1, i)
    ma = (base - np.float32(t) * fa).astype(np.float32)
    mb = (base - np.float32(1 - t) * fb).astype(np.float32)
    a = cv2.remap(frames[i], ma, None, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
    b = cv2.remap(frames[i + 1], mb, None, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
    return (1 - t) * a.astype(np.float32) + t * b.astype(np.float32)


ff = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{w}x{h}", "-r", str(fps),
                       "-i", "-", "-i", args.src, "-map", "0:v", "-map", "1:a?", "-c:v", "libx264", "-preset", "medium",
                       "-crf", "14", "-pix_fmt", "yuv420p", "-c:a", "copy", "-shortest", args.dst], stdin=subprocess.PIPE)
log = []
for j in range(n):
    local = smooth[min(j, n - 2)]  # pixels this frame moves
    subs = 1 if local * args.shutter < 0.6 else int(min(12, np.ceil(local * args.shutter / 0.8) + 1))
    xs = [pos[j]] if subs == 1 else pos[j] + args.shutter * (np.linspace(0, 1, subs) - 0.5)
    out = sum(at(x) for x in xs) / len(xs)
    ff.stdin.write(np.clip(out + 0.5, 0, 255).astype(np.uint8).tobytes())
    log.append({"step": round(float(step[min(j, n - 2)]), 3), "pos": round(float(pos[j]), 3), "subs": len(xs)})
ff.stdin.close()
ff.wait()
avg = np.convolve(np.r_[np.full(4, step[0]), step, np.full(4, step[-1])], np.ones(8) / 8, mode="same")[4:-4]
dev = np.sqrt(np.mean((step / np.maximum(avg, 1e-3) - 1)[avg > 0.3] ** 2)) if (avg > 0.3).any() else 0
json.dump({"window": k, "shutter": args.shutter, "frames": n, "step_rms_deviation": round(float(dev), 3), "per_frame": log},
          open(args.dst + ".json", "w"), indent=0)
print(f"{os.path.basename(args.src)}: {n} frames, median step {np.median(step):.2f} px, uneven by {100 * dev:.0f} % before; "
      f"up to {max(x['subs'] for x in log)} sub-frames per frame -> {args.dst}")
