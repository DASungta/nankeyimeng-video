"""Write gold 楷书 onto a blank plaque in a Muse clip, following it frame by frame.

The plaque face is the dark teal field inside the gold frame. Each frame we threshold that colour,
take the contour closest to last frame's, fit four corners, smooth the corners over time, and
warp a text card onto them. Characters run right to left, as on old horizontal plaques.

Usage (from nanke/):
  python -I tools/plaque_text.py SRC DST [--text 大槐安國] [--roi x,y,w,h] [--debug DIR]
--roi picks the plaque in the first frame when other dark teal areas are larger (pixel box in the clip).
--static is for a fixed camera with things passing in front of the plaque (S10A): one quad from the median
of all detections, and the text is drawn only on pixels that still have the plaque colour, so a flag or a
parasol crossing the plaque covers the characters instead of being painted over.
Used for S08 (大槐安國, tracked) and S10A (南柯郡城, --quad read off a grid of a clean frame).
"""
import os
import subprocess
import sys
import tempfile

sys.path.append(os.path.expandvars(r"%APPDATA%\Python\Python312\site-packages"))
import cv2  # noqa: E402
import numpy as np  # noqa: E402
from PIL import Image, ImageDraw, ImageFont  # noqa: E402

import argparse  # noqa: E402

ap = argparse.ArgumentParser()
ap.add_argument("src")
ap.add_argument("dst")
ap.add_argument("--text", default="大槐安國")  # traditional forms, as on Tang plaques and in the original text
ap.add_argument("--roi", default=None)
ap.add_argument("--debug", default=None)
ap.add_argument("--quad", default=None, help="fixed plaque face corners TL,TR,BR,BL as x1,y1,...,x4,y4 (implies --static)")
ap.add_argument("--static", action="store_true",
                help="camera is fixed: use one median quad for every frame, and only paint where the plaque face shows")
args = ap.parse_args()
if args.quad:
    args.static = True
src, dst, debug, TEXT = args.src, args.dst, args.debug, args.text
ROI = tuple(int(v) for v in args.roi.split(",")) if args.roi else None
FONT = "C:/Windows/Fonts/simkai.ttf"


def order(pts):
    """Return corners as TL, TR, BR, BL."""
    pts = np.array(pts, dtype=np.float32).reshape(4, 2)
    s, d = pts.sum(1), np.diff(pts, axis=1).ravel()
    return np.array([pts[s.argmin()], pts[d.argmin()], pts[s.argmax()], pts[d.argmax()]], np.float32)


def corners(frame, prev_center):
    hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
    m = cv2.inRange(hsv, (80, 40, 30), (115, 255, 140))
    m = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((7, 7), np.uint8))
    cs, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    cs = [c for c in cs if cv2.contourArea(c) > 1500]
    if not cs:
        return None
    if prev_center is None or (ROI and args.static):
        if ROI:
            rx, ry, rw, rh = ROI
            inside = [c for c in cs if rx <= cv2.boundingRect(c)[0] + cv2.boundingRect(c)[2] / 2 <= rx + rw
                      and ry <= cv2.boundingRect(c)[1] + cv2.boundingRect(c)[3] / 2 <= ry + rh]
            cs = inside or cs
        c = max(cs, key=cv2.contourArea)
    else:
        def score(c):
            x, y, w, h = cv2.boundingRect(c)
            return np.hypot(x + w / 2 - prev_center[0], y + h / 2 - prev_center[1]) - 0.02 * cv2.contourArea(c)
        c = min(cs, key=score)
    hull = cv2.convexHull(c)
    peri = cv2.arcLength(hull, True)
    for eps in np.linspace(0.01, 0.08, 15):
        approx = cv2.approxPolyDP(hull, eps * peri, True)
        if len(approx) == 4:
            return order(approx)
    return order(cv2.boxPoints(cv2.minAreaRect(c)))


def text_card(w=1200, h=420):
    """Gold characters on transparent, right to left."""
    card = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    font = ImageFont.truetype(FONT, int(h * 0.80))
    stroke = max(2, int(h * 0.022))  # thicken the thin 楷体 strokes toward a bold Tang 楷书
    step = w / len(TEXT)
    shadow = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    ds, d = ImageDraw.Draw(shadow), ImageDraw.Draw(card)
    for i, ch in enumerate(reversed(TEXT)):
        cx = step * (i + 0.5)
        tw = d.textlength(ch, font=font)
        x, y = cx - tw / 2, h * 0.03
        ds.text((x + 7, y + 7), ch, font=font, fill=(10, 20, 20, 150), stroke_width=stroke, stroke_fill=(10, 20, 20, 150))
        d.text((x, y), ch, font=font, fill=(255, 255, 255, 255), stroke_width=stroke, stroke_fill=(255, 255, 255, 255))
    # vertical gold gradient through the glyph mask
    a = np.array(card)[..., 3].astype(np.float32) / 255
    g = np.linspace(0, 1, h)[:, None]
    top, bot = np.array([238, 205, 120]), np.array([176, 128, 52])
    rgb = (top * (1 - g[..., None]) + bot * g[..., None]) * np.ones((h, w, 1))
    gold = np.dstack([rgb, a * 255]).astype(np.uint8)
    out = Image.alpha_composite(shadow, Image.fromarray(gold, "RGBA"))
    return cv2.cvtColor(np.array(out), cv2.COLOR_RGBA2BGRA)


card = text_card()
ch, cw = card.shape[:2]
# where the text sits inside the plaque face (fractions of the face)
inset = np.float32([[0.05, 0.08], [0.95, 0.08], [0.95, 0.92], [0.05, 0.92]])

cap = cv2.VideoCapture(src)
fps = cap.get(cv2.CAP_PROP_FPS)
frames, quads, center = [], [], None
while True:
    ok, f = cap.read()
    if not ok:
        break
    q = corners(f, center)
    if q is not None:
        center = q.mean(0)
    frames.append(f)
    quads.append(q)

# fill gaps, then smooth each corner coordinate with a short moving average
idx = [i for i, q in enumerate(quads) if q is not None]
arr = np.array([quads[i] for i in idx])
full = np.stack([np.interp(range(len(frames)), idx, arr[:, k, j]) for k in range(4) for j in range(2)], 1)
k = 5
pad = np.pad(full, ((k, k), (0, 0)), mode="edge")
smooth = np.stack([pad[i:i + 2 * k + 1].mean(0) for i in range(len(frames))]).reshape(-1, 4, 2)
if args.static:
    det = np.array([quads[i] for i in idx])
    areas = np.array([cv2.contourArea(q.astype(np.float32)) for q in det])
    keep = det[np.abs(areas - np.median(areas)) < 0.12 * np.median(areas)]
    fixed = np.median(keep, axis=0)
    print("static quad from", len(keep), "of", len(det), "detections:", fixed.round(1).tolist())
    if args.quad:
        fixed = np.array([float(v) for v in args.quad.split(",")], np.float32).reshape(4, 2)
        print("using --quad", fixed.tolist())
    smooth = np.repeat(fixed[None], len(frames), axis=0)

tmp = tempfile.mkdtemp()
src_card = np.float32([[0, 0], [cw, 0], [cw, ch], [0, ch]])
for i, (f, q) in enumerate(zip(frames, smooth)):
    tl, tr, br, bl = q
    def lerp(u, v):
        top = tl + (tr - tl) * u
        bot = bl + (br - bl) * u
        return top + (bot - top) * v
    dst_q = np.float32([lerp(u, v) for u, v in inset])
    M = cv2.getPerspectiveTransform(src_card, dst_q)
    warped = cv2.warpPerspective(card, M, (f.shape[1], f.shape[0]), flags=cv2.INTER_AREA)
    alpha = cv2.GaussianBlur(warped[..., 3].astype(np.float32) / 255, (3, 3), 0)[..., None]
    if args.static:
        face = cv2.inRange(cv2.cvtColor(f, cv2.COLOR_BGR2HSV), (80, 40, 30), (115, 255, 150))
        face = cv2.morphologyEx(face, cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))
        face = cv2.GaussianBlur(face.astype(np.float32) / 255, (5, 5), 0)[..., None]
        alpha = alpha * face
    # let the silk texture show through a little
    lum = cv2.cvtColor(f, cv2.COLOR_BGR2GRAY).astype(np.float32)[..., None] / 255
    paint = warped[..., :3].astype(np.float32) * (0.82 + 0.35 * lum)
    out = f.astype(np.float32) * (1 - alpha * 0.95) + paint * alpha * 0.95
    out = np.clip(out, 0, 255).astype(np.uint8)
    cv2.imwrite(os.path.join(tmp, f"{i:04d}.png"), out)
    if debug and i % 24 == 0:
        cv2.imwrite(os.path.join(debug, f"plaque-{i // 24:02d}.jpg"), cv2.resize(out, (624, 352)))

subprocess.run(["ffmpeg", "-v", "error", "-y", "-framerate", str(fps), "-i", os.path.join(tmp, "%04d.png"),
                "-i", src, "-map", "0:v", "-map", "1:a?", "-c:v", "libx264", "-preset", "medium", "-crf", "16",
                "-pix_fmt", "yuv420p", "-c:a", "copy", "-shortest", dst], check=True)
print("frames", len(frames), "detected", len(idx), "wrote", dst)
