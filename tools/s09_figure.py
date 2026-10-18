"""Composite the prostrating 淳于棼 into S09 (the audience before the king of 大槐安国).

Muse refuses a court scene with a prostrating figure in it, so the hall (S09-v2) and the figure
(S09-fig-a, gongbi on plain white) were made apart and are joined here:
1. key the figure off white: near-white areas that touch the border, or large enclosed ones, are background;
2. recolour the robe from 赭黄 to 绯. From 总章元年 (668) 赤黄 was reserved for the emperor, and the story is
   set in the 贞元 years; 绯 is also what he wears at the wedding in S10;
3. place him in the central aisle at the foot of the dais, level with the nearest officials and above the
   subtitle line, back to camera, head toward the throne, with a soft contact shadow, and
   follow any small drift of the clip by phase correlation on the floor;
4. match the clip: soften, warm, desaturate a little and add the same grain.

Usage (from nanke/): python -I tools/s09_figure.py [--debug DIR]
Writes muse/S09-v2-fig.mp4 and muse/S09-fig.png (the keyed, recoloured figure).
"""
import argparse
import os
import subprocess
import sys

sys.path.append(os.path.expandvars(r"%APPDATA%\Python\Python312\site-packages"))
import cv2  # noqa: E402
import numpy as np  # noqa: E402

ap = argparse.ArgumentParser()
ap.add_argument("--debug", default=None)
ap.add_argument("--height", type=float, default=0.185, help="figure height as a fraction of the frame")
ap.add_argument("--x", type=float, default=0.55, help="centre of the figure, fraction of width")
ap.add_argument("--bottom", type=float, default=0.865, help="robe hem, fraction of height")
args = ap.parse_args()

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "muse", "S09-v2.mp4")
FIG = os.path.join(ROOT, "muse", "S09-fig-a.webp")
DST = os.path.join(ROOT, "muse", "S09-v2-fig.mp4")


def key(img):
    """BGRA figure with the white background removed."""
    b, g, r = [img[..., i].astype(np.int16) for i in range(3)]
    mn, mx = np.minimum(np.minimum(b, g), r), np.maximum(np.maximum(b, g), r)
    white = ((mn > 228) & (mx - mn < 22)).astype(np.uint8)
    n, lab, stats, _ = cv2.connectedComponentsWithStats(white, connectivity=4)
    h, w = white.shape
    bg = np.zeros_like(white)
    for i in range(1, n):
        x, y, ww, hh, area = stats[i]
        if x == 0 or y == 0 or x + ww == w or y + hh == h or area > 4000:
            bg[lab == i] = 1
    a = 1 - bg.astype(np.float32)
    a = cv2.erode(a, np.ones((9, 9), np.uint8))  # cut into the ink outline so no white fringe is left
    a = cv2.GaussianBlur(a, (0, 0), 1.6)
    return np.dstack([img, (a * 255).astype(np.uint8)])


def recolour(bgra):
    """赭黄 robe to 绯. Skin and the pale lining are lighter and less saturated, so they are left alone."""
    hsv = cv2.cvtColor(bgra[..., :3], cv2.COLOR_BGR2HSV).astype(np.float32)
    H, S, V = hsv[..., 0], hsv[..., 1], hsv[..., 2]
    hue_w = np.clip(1 - np.abs(H - 21) / 11, 0, 1)  # ochre is around 21 in OpenCV units
    sat_w = np.clip((S - 75) / 45, 0, 1)
    wgt = cv2.GaussianBlur(hue_w * sat_w, (0, 0), 1.0)
    H2 = (H - 21 * wgt) % 180  # to about 0: the deep 绯 of the S10 wedding robe
    S2 = np.clip(S * (1 + 0.12 * wgt), 0, 255)
    V2 = V * (1 - 0.34 * wgt)
    out = cv2.cvtColor(np.dstack([H2, S2, V2]).astype(np.uint8), cv2.COLOR_HSV2BGR)
    return np.dstack([out, bgra[..., 3]])


fig = cv2.imread(FIG, cv2.IMREAD_COLOR)
fig = recolour(key(fig))
ys, xs = np.nonzero(fig[..., 3] > 8)
fig = fig[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
cv2.imwrite(os.path.join(ROOT, "muse", "S09-fig.png"), fig)

cap = cv2.VideoCapture(SRC)
fps = cap.get(cv2.CAP_PROP_FPS)
W, H = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)), int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
fh = int(round(args.height * H))
fw = int(round(fig.shape[1] * fh / fig.shape[0]))
small = cv2.resize(fig, (fw, fh), interpolation=cv2.INTER_AREA).astype(np.float32)
small[..., :3] = cv2.GaussianBlur(small[..., :3], (0, 0), 0.6)
# match the painting: a touch warmer and less saturated than Muse's clean figure
grey = small[..., :3].mean(2, keepdims=True)
small[..., :3] = (0.88 * small[..., :3] + 0.12 * grey) * np.array([0.93, 0.98, 1.02], np.float32)
alpha = small[..., 3:] / 255
x0 = int(round(args.x * W - fw / 2))
y0 = int(round(args.bottom * H - fh))

# contact shadow: a flat soft ellipse under the hem, darkening the floor
shadow = np.zeros((H, W), np.float32)
cv2.ellipse(shadow, (x0 + fw // 2 + fw // 10, y0 + int(fh * 0.93)), (int(fw * 0.5), int(fh * 0.1)), 0, 0, 360, 1, -1)
shadow = cv2.GaussianBlur(shadow, (0, 0), fh * 0.06) * 0.42

ff = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{W}x{H}",
                       "-r", str(fps), "-i", "-", "-i", SRC, "-map", "0:v", "-map", "1:a?", "-c:v", "libx264",
                       "-preset", "medium", "-crf", "14", "-pix_fmt", "yuv420p", "-c:a", "copy", "-shortest", DST],
                      stdin=subprocess.PIPE)
rng = np.random.default_rng(9)
ref, win, i = None, None, 0
floor = (slice(int(H * 0.72), H), slice(int(W * 0.2), int(W * 0.8)))
while True:
    ok, f = cap.read()
    if not ok:
        break
    g = cv2.cvtColor(f, cv2.COLOR_BGR2GRAY).astype(np.float32)[floor]
    if ref is None:
        ref, win = g, cv2.createHanningWindow(g.shape[::-1], cv2.CV_32F)
        dx = dy = 0.0
    else:
        (dx, dy), _ = cv2.phaseCorrelate(ref, g, win)
    M = np.float32([[1, 0, x0 + dx], [0, 1, y0 + dy]])
    layer = cv2.warpAffine(small, M, (W, H), flags=cv2.INTER_LINEAR, borderValue=(0, 0, 0, 0))
    sh = cv2.warpAffine(shadow, np.float32([[1, 0, dx], [0, 1, dy]]), (W, H))
    out = f.astype(np.float32) * (1 - sh[..., None])
    a = layer[..., 3:] / 255
    grain = rng.normal(0, 3.0, (H, W, 1)).astype(np.float32)
    out = out * (1 - a) + (layer[..., :3] + grain) * a
    out = np.clip(out, 0, 255).astype(np.uint8)
    ff.stdin.write(out.tobytes())
    if args.debug and i % 24 == 0:
        cv2.imwrite(os.path.join(args.debug, f"s09-{i // 24:02d}.jpg"), out)
        print(f"frame {i}: drift {dx:+.2f},{dy:+.2f}")
    i += 1
ff.stdin.close()
ff.wait()
print("figure", fw, "x", fh, "at", x0, y0, "frames", i, "wrote", DST)
