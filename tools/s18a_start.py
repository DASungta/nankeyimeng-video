"""Make the first frame for S18A (the close-up of his eyes) out of the last frame of S18, so the two join without a cut.

S18 ends with the edit pushing in on his sleeping face (src/Film.jsx, PUSH: 1.5x around the point between his eyes,
reached on the shot's last frame). This takes that frame from the clip the edit plays (public/clips/S18-v1-paper.mp4),
crops exactly what the push shows, and scales it back up to 1280x720. Muse then animates it from that frame: the
camera keeps closing in and his eyes snap open. The first try, drawn from a description, had him face-down on the
pillow instead of lying face-up as in S18.

Usage (from nanke/): python -I tools/s18a_start.py   → muse/S18A-start.jpg
This frame was sent to Muse (2026-10-16). Muse took it as a reference rather than a literal first frame, so the edit
now ends the push at 1.22x, where his eyes meet the opening of S18A-v3 (see PUSH in src/Film.jsx); the 1.5x below is
the framing that was sent.
"""
import os
import subprocess

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "public", "clips", "S18-v1-paper.mp4")
DST = os.path.join(ROOT, "muse", "S18A-start.jpg")
FRAME, SCALE, OX, OY = 143, 1.5, 0.65, 0.44  # keep in step with PUSH in src/Film.jsx
W, H = 1280, 720
w, h = W / SCALE, H / SCALE
x, y = OX * (W - w), OY * (H - h)  # the corner that stays put when scaling about (OX, OY)
vf = f"select=eq(n\\,{FRAME}),crop={w:.0f}:{h:.0f}:{x:.0f}:{y:.0f},scale={W}:{H}:flags=lanczos,unsharp=5:5:0.6"
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", SRC, "-vf", vf, "-frames:v", "1", "-q:v", "2", DST], check=True)
print("wrote", DST, f"crop {w:.0f}x{h:.0f} at {x:.0f},{y:.0f}")
