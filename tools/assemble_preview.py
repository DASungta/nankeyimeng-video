"""Join the Muse clips into a plain preview, following edl.json.

No transitions, subtitles or music: each shot is cut to its in/dur, scaled to 1280x720 at 24 fps,
its ambient sound normalised, and the clips are joined end to end. S28 is a black title card.

Usage (from nanke/): python -I tools/assemble_preview.py
Writes out/preview-assembly.mp4.
"""
import json
import os
import subprocess
import tempfile

from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
edl = json.load(open(os.path.join(ROOT, "edl.json"), encoding="utf-8"))
tmp = tempfile.mkdtemp()
os.makedirs(os.path.join(ROOT, "out"), exist_ok=True)

VF = "scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,setsar=1,fps=24"
AF = "loudnorm=I=-24:TP=-3:LRA=11,aresample=48000"
parts = []
for i, s in enumerate(edl["shots"]):
    out = os.path.join(tmp, f"{i:02d}.mp4")
    if s["file"]:
        cmd = ["ffmpeg", "-v", "error", "-y", "-ss", str(s["in"]), "-t", str(s["dur"]),
               "-i", os.path.join(ROOT, s["file"]), "-vf", VF, "-af", AF,
               "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-c:a", "aac", "-b:a", "160k",
               "-ac", "2", out]
    else:
        card = os.path.join(tmp, "title.png")
        im = Image.new("RGB", (1280, 720), (6, 6, 6))
        d = ImageDraw.Draw(im)
        font = ImageFont.truetype("C:/Windows/Fonts/msyh.ttc", 72)
        w = d.textlength("南柯一梦", font=font)
        d.text(((1280 - w) / 2, 300), "南柯一梦", fill=(225, 210, 175), font=font)
        im.save(card)
        cmd = ["ffmpeg", "-v", "error", "-y", "-loop", "1", "-t", str(s["dur"]), "-i", card,
               "-f", "lavfi", "-t", str(s["dur"]), "-i", "anullsrc=r=48000:cl=stereo",
               "-vf", "fps=24,format=yuv420p", "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
               "-c:a", "aac", "-b:a", "160k", "-shortest", out]
    subprocess.run(cmd, check=True)
    parts.append(out)
    print(s["id"], "ok")

lst = os.path.join(tmp, "list.txt")
with open(lst, "w", encoding="utf-8") as f:
    f.writelines(f"file '{p}'\n" for p in parts)
final = os.path.join(ROOT, "out", "preview-assembly.mp4")
subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", lst,
                "-c", "copy", "-movflags", "+faststart", final], check=True)
print("wrote", final)
