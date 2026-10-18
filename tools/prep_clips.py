"""Prepare the Muse clips for the Remotion edit.

1. Copies every clip the edit uses into public/clips/.
2. Bakes the two style transitions into the head of a clip, frame by frame with a seeded noise mask:
   - into the dream: S07 (gongbi) opens out of black like ink spreading through silk (S06 ends on black);
   - out of the dream: S20 (live action, the cup) comes through a white page whose fibres thin away (S17 ends on white).
3. Measures each clip's ambient sound over the part the edit uses and stores a gain that brings it to a common
   level, so the Muse sound sits as a steady bed under the score.

Writes public/clips/*.mp4 and src/clips.json. Run from nanke/: python -I tools/prep_clips.py
"""
import json
import os
import re
import shutil
import subprocess
import sys

sys.path.append(os.path.expandvars(r"%APPDATA%\Python\Python312\site-packages"))
import cv2  # noqa: E402
import numpy as np  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CLIPS = os.path.join(ROOT, "public", "clips")
os.makedirs(CLIPS, exist_ok=True)
edl = json.load(open(os.path.join(ROOT, "edl.json"), encoding="utf-8"))
TARGET_DB = -30.0  # mean level of the ambient bed
OPENING = json.load(open(os.path.join(ROOT, "src", "opening.json"), encoding="utf-8"))["use"]
# with the voice-over some shots run longer so their lines fit (edl voDur); without it, the cut as it was
VOICE = json.load(open(os.path.join(ROOT, "src", "voice.json"), encoding="utf-8"))["use"]


def fbm(w, h, seed, octaves=5):
    """Fractal value noise in [0, 1], the same every run."""
    rng = np.random.default_rng(seed)
    out = np.zeros((h, w), np.float32)
    amp, tot = 1.0, 0.0
    for o in range(octaves):
        gw, gh = 4 * 2 ** o + 1, int((4 * 2 ** o) * h / w) + 2
        grid = rng.random((gh, gw)).astype(np.float32)
        out += amp * cv2.resize(grid, (w, h), interpolation=cv2.INTER_CUBIC)
        tot += amp
        amp *= 0.5
    out /= tot
    return (out - out.min()) / (out.max() - out.min())


def radial(w, h, cx=0.5, cy=0.5):
    y, x = np.mgrid[0:h, 0:w].astype(np.float32)
    d = np.hypot((x / w - cx) * (w / h), y / h - cy)
    return d / d.max()


def smoothstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


def bake(src, dst, length, kind):
    """Reveal the first `length` seconds of src out of black (ink) or white (paper)."""
    cap = cv2.VideoCapture(src)
    fps = cap.get(cv2.CAP_PROP_FPS)
    w, h = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)), int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    n_tr = int(round(length * fps))
    if kind == "ink":
        field = 0.55 * radial(w, h) + 0.45 * fbm(w, h, 7)
        fibre = None
    else:
        field = 0.45 * radial(w, h) + 0.55 * fbm(w, h, 11, octaves=6)
        # fine horizontal fibres, like the weave of silk seen against the light
        fibre = cv2.GaussianBlur(np.random.default_rng(3).random((h, w)).astype(np.float32), (0, 0), sigmaX=6, sigmaY=0.6)
        fibre = (fibre - fibre.min()) / (fibre.max() - fibre.min())
    ff = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{w}x{h}",
                           "-r", str(fps), "-i", "-", "-i", src, "-map", "0:v", "-map", "1:a?", "-c:v", "libx264",
                           "-preset", "medium", "-crf", "14", "-pix_fmt", "yuv420p", "-c:a", "copy", "-shortest", dst],
                          stdin=subprocess.PIPE)
    i = 0
    while True:
        ok, f = cap.read()
        if not ok:
            break
        if i < n_tr:
            p = (i + 1) / n_tr
            p = p * p * (3 - 2 * p)
            edge = 1.15 * p - 0.08  # how far the reveal has spread
            m = smoothstep(edge, edge - 0.10, field)  # 1 = picture shows
            fr = f.astype(np.float32)
            if kind == "ink":
                # the spreading front is darker, like wet ink soaking into silk
                front = smoothstep(edge - 0.10, edge - 0.03, field) * (1 - smoothstep(edge - 0.03, edge + 0.04, field))
                out = fr * m[..., None] * (1 - 0.35 * front[..., None])
            else:
                thin = np.clip(m + 0.35 * m * (fibre - 0.5), 0, 1)
                glow = (1 - thin)[..., None]
                warm = np.array([235, 246, 252], np.float32)  # BGR, a warm white
                out = fr * thin[..., None] + warm * glow
            f = np.clip(out, 0, 255).astype(np.uint8)
        ff.stdin.write(f.tobytes())
        i += 1
    ff.stdin.close()
    ff.wait()
    cap.release()


def mean_db(path, start, dur):
    r = subprocess.run(["ffmpeg", "-hide_banner", "-ss", str(start), "-t", str(dur), "-i", path, "-af", "volumedetect",
                        "-vn", "-f", "null", "-"], capture_output=True, text=True, encoding="utf-8", errors="replace")
    m = re.search(r"mean_volume: (-?[\d.]+) dB", r.stderr)
    return float(m.group(1)) if m else None


BAKE = {"S07": ("ink", 1.6), "S20": ("paper", 1.4)}  # S20 (the cup) is the first shot out of the dream
# the in-point each baked clip was made from, so that a changed in-point in edl.json bakes it again
MANIFEST = os.path.join(CLIPS, "baked.json")
baked = json.load(open(MANIFEST, encoding="utf-8")) if os.path.exists(MANIFEST) else {}
out = []
for s in edl["shots"]:
    if VOICE and "voDur" in s:
        s = {**s, "dur": s["voDur"]}
    if not s.get("file"):
        # S00, the opening, comes in two versions of different length; src/opening.json says which one is in use,
        # or none at all (the film then starts on S00A, as it did before the openings were made)
        if "variants" in s and OPENING == "none":
            continue
        dur = s["variants"][OPENING] if "variants" in s else s["dur"]
        out.append({"id": s["id"], "file": None, "in": 0, "dur": dur, "gain": 0})
        continue
    src = os.path.join(ROOT, s["file"])
    name = os.path.basename(s["file"])
    if s["id"] in BAKE:
        kind, length = BAKE[s["id"]]
        name = name.replace(".mp4", f"-{kind}.mp4")
        dst = os.path.join(CLIPS, name)
    if s["id"] in BAKE and (not os.path.exists(dst) or os.path.getmtime(dst) < os.path.getmtime(src)
                            or baked.get(name) != s["in"]):
        # the reveal has to start at the clip's in-point, so bake from a trimmed copy
        trimmed = os.path.join(CLIPS, "_trim.mp4")
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", str(s["in"]), "-i", src, "-c:v", "libx264", "-crf", "12",
                        "-preset", "fast", "-c:a", "aac", "-b:a", "192k", trimmed], check=True)
        bake(trimmed, dst, length, kind)
        os.remove(trimmed)
        baked[name] = s["in"]
        json.dump(baked, open(MANIFEST, "w", encoding="utf-8"), indent=1)
    if s["id"] in BAKE:
        start = 0
    else:
        dst = os.path.join(CLIPS, name)
        if not os.path.exists(dst) or os.path.getmtime(dst) < os.path.getmtime(src):
            shutil.copy2(src, dst)
        start = s["in"]
    db = mean_db(dst, start, s["dur"])
    gain = 1.0 if db is None else float(np.clip(10 ** ((TARGET_DB - db) / 20), 0.25, 3.0))
    # the clip's length in frames: not always 240 (tools/dejudder.py adds frames)
    cap = cv2.VideoCapture(dst)
    frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    cap.release()
    out.append({"id": s["id"], "file": "clips/" + name, "in": start, "dur": s["dur"], "gain": round(gain, 3),
                "meanDb": db, "frames": frames})
    print(f"{s['id']:5} {name:24} in {start:>4} dur {s['dur']}  ambient {db} dB -> gain {gain:.2f}")

json.dump({"fps": 24, "shots": out}, open(os.path.join(ROOT, "src", "clips.json"), "w", encoding="utf-8"),
          ensure_ascii=False, indent=1)
print("total", sum(s["dur"] for s in out), "s")
