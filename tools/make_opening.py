"""Bake the opening's ink reveal: the old 槐 painted on silk (Muse's OP-a, muse/OP-key.webp) soaking into a blank silk.

The opening (src/Film.jsx, Opening) starts on bare silk; the painting spreads over it from the hollow at the roots,
outwards and up into the crown, like ink and wash soaking into silk, with a darker wet edge at the spreading front
(the same look as the ink that opens the dream in S07). This writes that reveal as a clip; Film.jsx draws the ant,
the title, the seal and the credit over it, then pushes into the hollow and dissolves into S00A.

- the bare silk: the painting with everything that is not silk (by colour distance from the blank silk on the right)
  filled in: low frequencies by inpainting, the weave by tiling the blank silk's own texture, so the silk outside the
  strokes is the painting's own and does not change while the ink spreads;
- the order: distance from the hollow plus fractal noise, so the ink starts at the roots and creeps outward unevenly.

Writes public/opening/op-reveal.mp4 (2048x1152, 24 fps, 10 s; the painting is complete from REVEAL[1] s).
Run from nanke/: python -I tools/make_opening.py
"""
import os
import subprocess
import sys

sys.path.append(os.path.expandvars(r"%APPDATA%\Python\Python312\site-packages"))
import cv2  # noqa: E402
import numpy as np  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "muse", "OP-key.webp")
OUT = os.path.join(ROOT, "public", "opening", "op-reveal.mp4")
FPS, SECONDS = 24, 10
REVEAL = (0.8, 4.4)  # seconds: the ink starts spreading, the painting is complete
HOLLOW = (0.306, 0.835)  # the hollow at the roots, fractions of the frame (also OPEN.hollow in Film.jsx)
BLANK = (0.62, 0.95, 0.40, 0.70)  # x0, x1, y0, y1: bare silk on the right, where the title goes

P = cv2.imread(SRC).astype(np.float32)
h, w = P.shape[:2]


def smoothstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


def fbm(seed, octaves=5):
    rng = np.random.default_rng(seed)
    out = np.zeros((h, w), np.float32)
    amp, tot = 1.0, 0.0
    for o in range(octaves):
        gw, gh = 4 * 2 ** o + 1, int((4 * 2 ** o) * h / w) + 2
        out += amp * cv2.resize(rng.random((gh, gw)).astype(np.float32), (w, h), interpolation=cv2.INTER_CUBIC)
        tot += amp
        amp *= 0.5
    out /= tot
    return (out - out.min()) / (out.max() - out.min())


# ---- what is paint and what is bare silk ----
x0, x1, y0, y1 = (int(BLANK[0] * w), int(BLANK[1] * w), int(BLANK[2] * h), int(BLANK[3] * h))
lab = cv2.cvtColor(P.astype(np.uint8), cv2.COLOR_BGR2LAB).astype(np.float32)
silk_lab = np.median(lab[y0:y1, x0:x1].reshape(-1, 3), axis=0)
dist = np.linalg.norm(cv2.GaussianBlur(lab, (0, 0), 1.5) - silk_lab, axis=2)
paint = (dist > 14).astype(np.uint8)
paint = cv2.morphologyEx(paint, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))  # drop specks of the silk's own grain
paint = cv2.dilate(paint, np.ones((9, 9), np.uint8))
M = cv2.GaussianBlur(paint.astype(np.float32), (0, 0), 3)
print(f"paint covers {100 * paint.mean():.0f} % of the frame")

# ---- the bare silk under it ----
# the silk's own colour, averaged from bare silk only (normalised convolution), well clear of the strokes, whose
# darkness would otherwise bleed into the fill as blotches
bare = 1 - cv2.dilate(paint, np.ones((25, 25), np.uint8)).astype(np.float32)
num = cv2.GaussianBlur(P * bare[..., None], (0, 0), 90)
den = cv2.GaussianBlur(bare, (0, 0), 90)[..., None]
low = num / np.maximum(den, 1e-3)
low = np.where(den > 0.02, low, np.median(P[bare > 0], axis=0))
patch = P[y0:y1, x0:x1]
weave = patch - cv2.GaussianBlur(patch, (0, 0), 1.5)  # the threads only: specks and stains would repeat visibly
lim = np.percentile(np.abs(weave), 90)
weave = np.clip(weave, -lim, lim)  # in the tiling, so the fine weave is kept and the specks are cut off
tile = np.concatenate([weave, weave[:, ::-1]], 1)
tile = np.concatenate([tile, tile[::-1]], 0)
reps = (int(np.ceil(h / tile.shape[0])), int(np.ceil(w / tile.shape[1])), 1)
grain = np.tile(tile, reps)[:h, :w]
silk = P * (1 - M[..., None]) + (low + grain) * M[..., None]

# ---- the order the ink arrives in ----
yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
d = np.hypot((xx / w - HOLLOW[0]) * (w / h), yy / h - HOLLOW[1])
d /= d[paint > 0].max()
R = 0.62 * d + 0.38 * fbm(17)
lo, hi = np.percentile(R[paint > 0], [1, 99.5])
R = np.clip((R - lo) / (hi - lo), 0, 1)

os.makedirs(os.path.dirname(OUT), exist_ok=True)
ff = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{w}x{h}", "-r", str(FPS),
                       "-i", "-", "-c:v", "libx264", "-preset", "medium", "-crf", "12", "-pix_fmt", "yuv420p", OUT], stdin=subprocess.PIPE)
EDGE = 0.10
for i in range(FPS * SECONDS):
    t = i / FPS
    p = -EDGE + (1 + 2 * EDGE) * float(smoothstep(REVEAL[0], REVEAL[1], t))
    a = (1 - smoothstep(p - EDGE, p, R)) * M  # how much of the painting has soaked in here
    wet = np.exp(-(((R - (p - EDGE / 2)) / (EDGE / 2)) ** 2)) * M * (p < 1)  # the darker spreading front
    img = silk * (1 - a[..., None]) + P * a[..., None]
    img *= (1 - 0.22 * wet)[..., None]
    ff.stdin.write(np.clip(img + 0.5, 0, 255).astype(np.uint8).tobytes())
ff.stdin.close()
ff.wait()
print("->", OUT)
