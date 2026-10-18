"""Lift the calligraphed title off its paper for the live-action opening's title card.

Muse wrote 南柯一梦 in brush on white paper (muse/OR-title.webp, its TT-b). This divides out the paper's own shading,
turns the ink's density into opacity (so the dry-brush streaks and the thin ends of strokes stay thin and broken, as
the brush left them), colours it the warm off-white of the film's lettering, and crops it to the ink with a margin.
The card in src/Film.jsx (OpeningReal) puts it on black.

Writes public/opening/title.png (RGBA) and prints its aspect ratio (OPEN_REAL.title.aspect in Film.jsx).
Run from nanke/: python -I tools/make_title.py
"""
import os
import sys

sys.path.append(os.path.expandvars(r"%APPDATA%\Python\Python312\site-packages"))
import cv2  # noqa: E402
import numpy as np  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "muse", "OR-title.webp")
OUT = os.path.join(ROOT, "public", "opening", "title.png")
INK = (207, 229, 239)  # BGR of #efe5cf, the subtitles' and end title's warm white

img = cv2.imread(SRC).astype(np.float32)
gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
# the paper without the ink: a large closing (the ink is thinner than the kernel) then a blur
paper = cv2.GaussianBlur(cv2.morphologyEx(gray, cv2.MORPH_CLOSE, np.ones((61, 61), np.uint8)), (0, 0), 25)
v = gray / np.maximum(paper, 1)
alpha = np.clip((0.9 - v) / (0.9 - 0.22), 0, 1) ** 0.9  # 0 on paper, 1 in full black ink
alpha = cv2.GaussianBlur(alpha, (0, 0), 0.6)
alpha[alpha < 0.04] = 0  # the paper's own fibres and grain

# the box round the strokes themselves: specks of the paper near its edges would otherwise stretch it to the whole
# sheet, and are dropped with everything else outside the box
solid = cv2.morphologyEx((alpha > 0.5).astype(np.uint8), cv2.MORPH_OPEN, np.ones((9, 9), np.uint8))
ys, xs = np.nonzero(solid)
pad = int(0.04 * img.shape[1])
y0, y1 = max(0, ys.min() - pad), min(img.shape[0], ys.max() + pad)
x0, x1 = max(0, xs.min() - pad), min(img.shape[1], xs.max() + pad)
a = alpha[y0:y1, x0:x1]
out = np.zeros((y1 - y0, x1 - x0, 4), np.uint8)
out[..., :3] = INK
out[..., 3] = np.round(a * 255).astype(np.uint8)
os.makedirs(os.path.dirname(OUT), exist_ok=True)
cv2.imwrite(OUT, out)
print(f"-> {OUT}  {x1 - x0}x{y1 - y0}  aspect {(x1 - x0) / (y1 - y0):.3f}")
