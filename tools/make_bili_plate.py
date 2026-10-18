# The 4:3 Bilibili cover plate (2026-10-18): Muse's CV-W-a painting whole at the foot (1600x900), and above it a band
# of its own silk for the lettering: the sky's colour, plus its fine weave taken from the clean patch at the top left
# and mirror-tiled (clipped, so no speck repeats). The painting's top 120 rows (only leaves there; the palace roofs start
# lower) fade into the silk. Run from nanke/: python tools/make_bili_plate.py  ->  public/posters/art-bili-43.webp
import cv2, numpy as np
from PIL import Image
src = np.array(Image.open('muse/alt/CV-W-a.webp').convert('RGB')).astype(np.float32)
W, H, AH, TOP, FADE = 1600, 1200, 900, 300, 120
art = cv2.resize(src, (W, AH), interpolation=cv2.INTER_AREA)
patch = art[6:150, 6:380]
weave = patch - cv2.GaussianBlur(patch, (0, 0), 12)
sd = weave.reshape(-1, 3).std(0)
weave = np.clip(weave, -2.2 * sd, 2.2 * sd)  # no specks repeating across the band
band_h = TOP + FADE
rows = []
for r in range(int(np.ceil(band_h / weave.shape[0])) + 1):
    w = weave if r % 2 == 0 else weave[::-1]
    rows.append(np.hstack([w if c % 2 == 0 else w[:, ::-1] for c in range(int(np.ceil(W / weave.shape[1])) + 1)]))
tile = np.vstack(rows)[:band_h, :W]
base = np.median(patch.reshape(-1, 3), axis=0)
silk = base[None, None, :] * (1 + 0.02 * np.linspace(1, 0, band_h)[:, None, None]) + tile
out = np.zeros((H, W, 3), np.float32)
out[:TOP] = silk[:TOP]
a = np.ones((AH, 1, 1), np.float32)
a[:FADE, 0, 0] = np.linspace(0, 1, FADE) ** 1.6
under = art.copy(); under[:FADE] = silk[TOP:TOP + FADE]
out[TOP:] = art * a + under * (1 - a)
out = np.clip(out, 0, 255).astype(np.uint8)
Image.fromarray(out).save('public/posters/art-bili-43.webp', quality=94)
