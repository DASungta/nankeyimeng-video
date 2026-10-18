"""Remove the periodic jumps in a Muse clip.

Muse's videos skip a frame at regular intervals: in clips with a steady camera move one step in every 24 frames (S01,
S02, S17, S18) or every 8 (S14) is about twice as large as the steps around it, so the move hitches. This finds those
steps (optical flow on a small copy: a step more than 1.55 times the median of the four steps around it) and puts an
in-between frame into each gap: the two frames warped halfway towards each other along the flow and averaged. The
audio is stretched by the same ratio so it stays in sync.

Writes DST and DST.json ({"inserted": [frame indices of the source the new frames go before], "frames": n}); a frame
of the source at index i is at index i + (number of inserted indices <= i) in DST, so an in-point moves by that many
frames (tools/prep_clips.py does not need to know: edl.json takes the new in-point).

Usage (from nanke/): python -I tools/dejudder.py muse/S01-v1.mp4 muse/S01-v1-dj.mp4 [--period 24]
--period keeps only the jumps that fall on the skip cadence (before frames 23, 47, 71 … for 24): S02 also has fast real
movements that look like jumps, and those are left alone.
"""
import json
import os
import subprocess
import sys

sys.path.append(os.path.expandvars(r"%APPDATA%\Python\Python312\site-packages"))
import cv2  # noqa: E402
import numpy as np  # noqa: E402

import argparse  # noqa: E402

ap = argparse.ArgumentParser()
ap.add_argument("src")
ap.add_argument("dst")
ap.add_argument("--period", type=int, default=0)
args = ap.parse_args()
src, dst = args.src, args.dst
cap = cv2.VideoCapture(src)
fps = cap.get(cv2.CAP_PROP_FPS)
frames = []
while True:
    ok, f = cap.read()
    if not ok:
        break
    frames.append(f)
h, w = frames[0].shape[:2]


def small(f):
    return cv2.cvtColor(cv2.resize(f, (320, 180), interpolation=cv2.INTER_AREA), cv2.COLOR_BGR2GRAY)


sm = [small(f) for f in frames]
steps = np.array([0.0] + [np.linalg.norm(cv2.calcOpticalFlowFarneback(sm[i - 1], sm[i], None, 0.5, 3, 15, 3, 5, 1.2, 0), axis=2).mean()
                          for i in range(1, len(sm))])
inserted = []
for i in range(3, len(steps) - 2):
    around = np.median(np.r_[steps[i - 2:i], steps[i + 1:i + 3]])
    if steps[i] > 0.2 and steps[i] > 1.55 * around and (not args.period or (i + 1) % args.period == 0):
        inserted.append(i)


def midway(a, b):
    """The frame halfway between a and b: each warped half the flow towards the other, then averaged."""
    ga, gb = (cv2.cvtColor(cv2.resize(x, (w // 2, h // 2), interpolation=cv2.INTER_AREA), cv2.COLOR_BGR2GRAY) for x in (a, b))
    flow = cv2.calcOpticalFlowFarneback(ga, gb, None, 0.5, 4, 21, 3, 7, 1.5, 0)
    flow = cv2.resize(flow, (w, h), interpolation=cv2.INTER_LINEAR) * 2
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    fa = cv2.remap(a, xx - 0.5 * flow[..., 0], yy - 0.5 * flow[..., 1], cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
    fb = cv2.remap(b, xx + 0.5 * flow[..., 0], yy + 0.5 * flow[..., 1], cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
    return ((fa.astype(np.uint16) + fb) // 2).astype(np.uint8)


n_out = len(frames) + len(inserted)
tempo = len(frames) / n_out  # the audio slows by the same ratio as the picture
ff = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{w}x{h}", "-r", str(fps), "-i", "-",
                       "-i", src, "-map", "0:v", "-map", "1:a?", "-filter:a", f"atempo={tempo:.6f}", "-c:v", "libx264", "-preset", "medium",
                       "-crf", "14", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", dst], stdin=subprocess.PIPE)
ins = set(inserted)
for i, f in enumerate(frames):
    if i in ins:
        ff.stdin.write(midway(frames[i - 1], f).tobytes())
    ff.stdin.write(f.tobytes())
ff.stdin.close()
ff.wait()
json.dump({"inserted": inserted, "frames": n_out, "fps": fps}, open(dst + ".json", "w"), indent=1)
print(f"{os.path.basename(src)}: {len(inserted)} frames inserted before source frames {inserted} → {n_out} frames, audio x{tempo:.4f}")
