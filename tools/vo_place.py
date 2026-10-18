"""Pick, clean and place the voice-over takes.

    python -I tools/vo_place.py [--report]

For every line in muse/vo/lines.json it measures each take in muse/vo/takes (where the speech starts and ends, the
longest pause inside it, how fast it is read), picks one (a line's "take" in lines.json overrides the pick), and
writes it cleaned to public/vo/<id>.wav: trimmed to the speech, the voice's EQ and compression, the line's effect
(the call in the dark, the king's hall, the two messengers calling at once), and every line brought to the same
speech level. The chosen raw take is also kept as muse/vo/<id>.wav.

Then it places the lines on the film's timeline (src/clips.json): a line starts at its `at`, seconds into its shot,
or just after the line named in its `after`. It measures the score (public/music.wav) under each line and works out
how far to bring it down so the voice sits clear of it. src/vo.json gets {id, shot, at, dur, file, duck} per line;
src/Film.jsx plays the lines and ducks the score and the ambient bed with it. Lines that run past their subtitle or
into the next line are listed at the end. With --fit, the shots whose lines do not fit are lengthened in edl.json
(then npm run prep, npm run music, and this again).
"""
import json
import subprocess
import sys
import wave
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
VO = ROOT / 'muse' / 'vo'
TAKES = VO / 'takes'
OUT = ROOT / 'public' / 'vo'
SR = 48000
LEVEL = -18.0  # dBFS, RMS of the voiced part of every line
UNDER = 11.0  # dB the score is kept below the voice while it speaks (but never brought down more than 13 dB)
GAP = 0.12  # s between a line and the one it follows
PUNCT = set('，。、；：！？—…“”‘’《》（）,.;:!? ')

# EQ and dynamics per voice. The narrator thicker, as in a history documentary (director, 2026-10-18): voice and
# formants 7 % lower (about 1.25 semitones; asetrate, and atempo keeps the length), more chest (120 and 250 Hz), less
# box (550 Hz), and the presence and some air given back (2.5 kHz, above 5 kHz): the reference voice is so soft that
# hardly anything above 4 kHz comes out of the clone, which reads as muffled rather than full. The king: an old emperor
# (director, 2026-10-18, picked A of four: like the emperors of the court dramas), a voice designed from the style
# alone, very slow with drawn-out endings, 8 % lower, and a slight shake (FX). The others just cleaned.
CHAIN = {
	'narrator': 'asetrate=44640,aresample=48000,atempo=1.0752688,highpass=f=55,equalizer=f=120:t=q:w=0.9:g=5,equalizer=f=250:t=q:w=1.0:g=3,equalizer=f=550:t=q:w=1.2:g=-2,equalizer=f=2500:t=q:w=1.0:g=2.5,highshelf=f=5000:g=4,acompressor=threshold=0.1:ratio=3:attack=10:release=150:makeup=1',
	'messenger': 'highpass=f=80,equalizer=f=200:t=q:w=0.9:g=1.5,acompressor=threshold=0.1:ratio=2.5:attack=8:release=120',
	'king': 'asetrate=44160,aresample=48000,atempo=1.0869565,highpass=f=70,equalizer=f=180:t=q:w=0.9:g=2,acompressor=threshold=0.1:ratio=2.5:attack=8:release=120',
	'chunyu': 'highpass=f=80,acompressor=threshold=0.1:ratio=2.5:attack=8:release=120',
}
# the line's place in the story. The messenger's three lines are one voice in one room (director, 2026-10-18: the
# calls must sound like the man who invites him): the same small room on all three, the call in the dark only a
# little further off, the call from the dream with a short echo after it.
ROOM = 'aecho=0.8:0.85:35|80:0.12|0.07'
FX = {
	'S05-1': (ROOM, -3.0),  # in the dark, his eyes still shut
	'S05-2': (ROOM, 0.0),
	'S16-2': ('aecho=0.8:0.85:60|130|230:0.2|0.13|0.07,vibrato=f=5:d=0.06,tremolo=f=5:d=0.12', 0.0),  # the old emperor in his hall, his voice shaking a little
	'S18-2': ('aecho=0.8:0.8:35|80|260|470:0.12|0.07|0.14|0.07', 0.0),  # off screen, out of the dream
}


def read_wav(p):
	with wave.open(str(p)) as w:
		assert w.getframerate() == SR and w.getnchannels() == 1 and w.getsampwidth() == 2, p
		return np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768


def write_wav(p, x, channels=1):
	"""16-bit WAV; channels=2 writes the same signal to both sides (Remotion plays a mono file 3 dB down)."""
	y = np.clip(np.round(x * 32767), -32768, 32767).astype(np.int16)
	if channels == 2:
		y = np.repeat(y, 2)
	with wave.open(str(p), 'wb') as w:
		w.setnchannels(channels)
		w.setsampwidth(2)
		w.setframerate(SR)
		w.writeframes(y.tobytes())


def db(v):
	return 20 * np.log10(max(v, 1e-9))


def frames_db(x, hop=0.01):
	n = int(SR * hop)
	k = len(x) // n
	return np.array([db(np.sqrt(np.mean(x[i * n:(i + 1) * n] ** 2))) for i in range(k)]), hop


def measure(x, text):
	"""Where the speech is: start and end (s), the longest pause inside it (s), characters per second."""
	d, hop = frames_db(x)
	peak = d.max()
	on = d > peak - 38
	idx = np.flatnonzero(on)
	start, end = idx[0] * hop, (idx[-1] + 1) * hop
	gaps, run = [], 0
	for v in on[idx[0]:idx[-1] + 1]:
		run = 0 if v else run + 1
		gaps.append(run)
	n = sum(ch not in PUNCT for ch in text)
	return {'start': round(start, 3), 'end': round(end, 3), 'speech': round(end - start, 3), 'pause': round(max(gaps) * hop, 3), 'cps': round(n / max(end - start, 0.1), 2), 'total': round(len(x) / SR, 3), 'f0': pitch(x)}


def pitch(x):
	"""Median pitch of the voiced frames (Hz), to catch a take whose voice has drifted from the others."""
	x = x[::4]  # 12 kHz is plenty for a speaking voice
	sr = SR // 4
	n, hop = int(0.04 * sr), int(0.02 * sr)
	lo, hi = sr // 320, sr // 60
	e = np.sqrt(np.mean(x ** 2))
	f = []
	for i in range(0, len(x) - n, hop):
		w = x[i:i + n] * np.hanning(n)
		if np.sqrt(np.mean(w ** 2)) < 0.6 * e:
			continue
		r = np.correlate(w, w, 'full')[n - 1:]
		k = lo + int(np.argmax(r[lo:hi]))
		if r[k] > 0.45 * r[0]:
			f.append(sr / k)
	return round(float(np.median(f)), 1) if f else 0.0


def ffmpeg_filter(x, chain):
	p = subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-f', 'f32le', '-ar', str(SR), '-ac', '1', '-i', 'pipe:0', '-af', chain, '-f', 'f32le', '-ar', str(SR), '-ac', '1', 'pipe:1'], input=x.astype(np.float32).tobytes(), capture_output=True, check=True)
	return np.frombuffer(p.stdout, dtype=np.float32).copy()


def voiced_rms(x):
	d, hop = frames_db(x)
	n = int(SR * hop)
	keep = d > d.max() - 30
	seg = np.concatenate([x[i * n:(i + 1) * n] for i in np.flatnonzero(keep)])
	return db(np.sqrt(np.mean(seg ** 2)))


MAX_PAUSE = 0.45  # s: a longer pause inside a line is tightened to this, as a dialogue editor would


def tighten(x):
	"""Shorten the pauses inside the speech that run longer than MAX_PAUSE, cutting from their middle."""
	d, hop = frames_db(x)
	quiet = d <= d.max() - 38
	n = int(SR * hop)
	fade = int(0.012 * SR)
	keep, i, out = int(MAX_PAUSE / hop), 0, []
	pos = 0
	while i < len(quiet):
		if quiet[i]:
			j = i
			while j < len(quiet) and quiet[j]:
				j += 1
			if i > 0 and j < len(quiet) and j - i > keep:  # inside the speech, too long
				a = (i + keep // 2) * n
				b = (j - (keep - keep // 2)) * n
				out.append(x[pos:a])
				pos = b
			i = j
		else:
			i += 1
	if not out:
		return x
	out.append(x[pos:])
	y = out[0]
	for seg in out[1:]:  # short crossfades across the cuts
		r = np.linspace(0, 1, fade, dtype=np.float32)
		y = np.concatenate([y[:-fade], y[-fade:] * (1 - r) + seg[:fade] * r, seg[fade:]])
	return y


def clean(line, takes, m):
	"""The chosen take (two of them at once for the messengers' call), trimmed, filtered and levelled."""
	pre, post = 0.04, 0.18
	parts = []
	for k in takes:
		x = read_wav(TAKES / f'{line["id"]}-t{k}.wav')
		mm = m[k]
		a = max(0, int((mm['start'] - pre) * SR))
		b = min(len(x), int((mm['end'] + post) * SR))
		parts.append(x[a:b] if line.get('keepPauses') else tighten(x[a:b]))
	if line.get('double'):  # the two messengers are twins: the same voice twice, the second a beat late
		parts = parts * 2
	if len(parts) > 1:  # two voices calling together, the second a beat late
		lag = int(0.045 * SR)
		n = max(len(parts[0]), len(parts[1]) + lag)
		mix = np.zeros(n, np.float32)
		mix[:len(parts[0])] += parts[0]
		mix[lag:lag + len(parts[1])] += 0.85 * parts[1]
		x = mix
	else:
		x = parts[0]
	chain = CHAIN[line['voice']]
	if line.get('stretch'):  # drawn out, at the same pitch (a call that should hang in the air)
		chain = f'atempo={line["stretch"]},' + chain
	fx, trim = FX.get(line['id'], (None, 0.0))
	tail = 0.0
	if fx:
		tail = 0.6
		x = np.concatenate([x, np.zeros(int(tail * SR), np.float32)])
		chain += ',' + fx
	y = ffmpeg_filter(x, chain)
	y *= 10 ** ((LEVEL + trim - voiced_rms(y)) / 20)
	pk = np.abs(y).max()
	if pk > 0.89:  # keep 1 dB of headroom
		y *= 0.89 / pk
	# fades: in quickly, out over the room tail
	fi = int(0.01 * SR)
	fo = int((0.06 + tail * 0.8) * SR)
	y[:fi] *= np.linspace(0, 1, fi)
	y[-fo:] *= np.linspace(1, 0, fo) ** 2
	# trim the room tail back to where it has died away
	d, hop = frames_db(y)
	last = np.flatnonzero(d > d.max() - 45)[-1]
	return y[:int((last + 1) * hop * SR)]


def pick(line, m, f0):
	"""The take to use: fewest problems, then the one that needs the shot lengthened least, then the voice closest to
	this voice's other lines."""
	if 'take' in line:
		return line['take'] if isinstance(line['take'], list) else [line['take']]
	ok = sorted(m)

	room = line['end'] - line.get('at', line['end'] - 3)

	def score(k):
		mm = m[k]
		drift = abs(mm['f0'] / f0 - 1) if f0 and mm['f0'] else 0
		bad = (mm['pause'] > 0.9) + (mm['cps'] > 7.0) + (mm['cps'] < 2.2) + (drift > 0.15)
		over = np.ceil(max(0, mm['speech'] - room) * 4) / 4  # how much longer the shot would have to be, in quarter seconds
		return (bad, over, round(drift, 2))
	return [min(ok, key=score)]


DREAM = {'S07', 'S08', 'S09', 'S10', 'S10B', 'S10C', 'S10A', 'S11', 'S11A', 'S12B', 'S12', 'S12A', 'S13', 'S13A', 'S14', 'S14A', 'S15', 'S15A', 'S16', 'S17'}
XF_INTO = {'S13A': 30, 'S14': 30, 'S14A': 30, 'S15': 30}  # as in src/Film.jsx
PAD = 0.3  # s of picture after a shot's last line
FPS = 24


def layout(lines, durs, order, lens):
	"""Where every line goes for these shot lengths: {id: seconds into its shot}, and where each shot starts.
	A line starts at its own time, after the line it follows, and never before the line before it has finished (so a
	line that runs over a cut pushes the next one)."""
	shot_from, acc = {}, 0
	for sid in order:
		shot_from[sid] = acc / FPS
		acc += round(lens[sid] * FPS)
	ats, ends, prev_end = {}, {}, 0.0
	for line in lines:
		lid, shot = line['id'], line['shot']
		if 'after' in line:
			at = ends[line['after']] + GAP
		else:
			at = max(line['at'], prev_end + 0.3 - shot_from[shot])
		dur = durs[lid]
		if lid == 'S18-2':  # the call stops dead as his eyes snap open
			dur = min(dur, line['end'] - at)
		ats[lid] = at
		ends[lid] = at + dur
		prev_end = shot_from[shot] + at + dur + line.get('holdAfter', 0)
	return ats, shot_from


def fit(lines, durs, clips):
	"""Lengthen the shots whose lines run past them, as far as their clips allow (and never past an edl maxDur): the
	length goes to the shot's voDur in edl.json (its dur stays the cut without voice-over). Starts from the cut without
	voice-over, so a line that has become shorter gives its shot back."""
	shots = clips['shots']
	order = [s['id'] for s in shots]
	edl_path = ROOT / 'edl.json'
	edl = json.loads(edl_path.read_text(encoding='utf-8'))
	base = {x['id']: x['dur'] for x in edl['shots']}
	edl_by = {x['id']: x for x in edl['shots']}
	lens = {s['id']: s['dur'] if 'variants' in edl_by[s['id']] else base[s['id']] for s in shots}  # the opening: as in use
	room = {}
	for i, s in enumerate(shots):
		nxt = order[i + 1] if i + 1 < len(order) else None
		tail = (XF_INTO.get(nxt, 12) if s['id'] in DREAM and nxt in DREAM else 0) / FPS
		r = (s['frames'] / FPS - s['in'] - tail - 2 / FPS) if s.get('file') else 99
		e = next(x for x in edl['shots'] if x['id'] == s['id'])
		if e.get('holdWhite'):  # it ends on white, and src/Film.jsx holds the white past the clip (holdWhy)
			r = 99
		room[s['id']] = np.floor(min(r, e.get('maxDur', 99)) * 8) / 8  # past maxDur the clip is not to be used (maxWhy)
	# shot by shot from the start: a line only ever pushes the lines after it, so each shot's length is settled once
	# the shots before it are
	need = {}
	for sid in order:
		ats, _ = layout(lines, durs, order, lens)
		n = max((ats[ln['id']] + durs[ln['id']] + ln.get('holdAfter', 0) + PAD for ln in lines if ln['shot'] == sid and ln['id'] != 'S18-2'), default=0)
		need[sid] = n  # S18-2 is cut off by his waking, on purpose
		lens[sid] = max(lens[sid], float(min(np.ceil(n * 4) / 4, room[sid])))
	for s in shots:
		e = next(x for x in edl['shots'] if x['id'] == s['id'])
		short = need.get(s['id'], 0) > lens[s['id']] + 0.05
		runs = f'  (its line runs {need.get(s["id"], 0) - PAD - lens[s["id"]]:.2f} s into the next shot: the clip allows no more)' if short else ''
		if 'variants' in e:  # the opening: its length is the opening in use, never lengthened
			continue
		if lens[s['id']] > e['dur']:
			print(f'FIT {s["id"]:5} {e["dur"]} -> {lens[s["id"]]} s{runs}')
			e['voDur'] = lens[s['id']]
		elif 'voDur' in e and lens[s['id']] <= e['dur']:
			del e['voDur']
		elif short:
			print(f'FIT {s["id"]:5} stays {s["dur"]} s{runs}')
	print(f'total {sum(lens.values()):.2f} s (without voice-over {sum(s['dur'] if 'variants' in edl_by[s['id']] else base[s['id']] for s in shots):.2f} s)')
	edl_path.write_text(json.dumps(edl, ensure_ascii=False, indent=1), encoding='utf-8')


def main():
	spec = json.loads((VO / 'lines.json').read_text(encoding='utf-8'))
	clips = json.loads((ROOT / 'src' / 'clips.json').read_text(encoding='utf-8'))
	order = [s['id'] for s in clips['shots']]
	shot_len = {s['id']: s['dur'] for s in clips['shots']}
	music = None
	mp = ROOT / 'public' / 'music.wav'
	if mp.exists():
		with wave.open(str(mp)) as w:
			ch, msr = w.getnchannels(), w.getframerate()
			music = (np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768).reshape(-1, ch).mean(axis=1), msr
	OUT.mkdir(parents=True, exist_ok=True)
	lines = [ln for ln in spec['lines'] if not ln.get('skip')]
	# measure every take first: a voice's usual pitch is the median over all its takes
	meas = {ln['id']: {int(p.stem.rsplit('-t', 1)[1]): measure(read_wav(p), ln['text']) for p in sorted(TAKES.glob(f'{ln["id"]}-t*.wav'))} for ln in lines}
	missing = [ln['id'] for ln in lines if not meas[ln['id']]]
	if missing:
		print('no take yet:', ', '.join(missing))
		return 1
	f0s = {}
	for ln in lines:
		f0s.setdefault(ln['voice'], []).extend(mm['f0'] for mm in meas[ln['id']].values() if mm['f0'])
	f0s = {v: float(np.median(x)) for v, x in f0s.items() if x}
	audio, takes = {}, {}
	for ln in lines:
		takes[ln['id']] = pick(ln, meas[ln['id']], f0s.get(ln['voice']))
		audio[ln['id']] = clean(ln, takes[ln['id']], meas[ln['id']])
	durs = {lid: len(y) / SR for lid, y in audio.items()}
	if '--fit' in sys.argv:
		fit(lines, durs, clips)
		print('now: npm run prep, npm run music, then this again without --fit')
		return 0
	ats, shot_from = layout(lines, durs, order, shot_len)
	placed, report = [], []
	for ln in lines:
		lid, shot, at = ln['id'], ln['shot'], ats[ln['id']]
		y = audio[lid]
		if lid == 'S18-2' and len(y) / SR > ln['end'] - at:  # the call stops dead as his eyes snap open
			y = y[:int((ln['end'] - at) * SR)].copy()
			f = int(0.03 * SR)
			y[-f:] *= np.linspace(1, 0, f)
		dur = len(y) / SR
		write_wav(OUT / f'{lid}.wav', y, channels=2)
		(VO / f'{lid}.wav').write_bytes((TAKES / f'{lid}-t{takes[lid][0]}.wav').read_bytes())
		start = shot_from[shot] + at
		duck = 1.0
		if music:
			x, msr = music
			seg = x[int(start * msr):int((start + dur) * msr)]
			if len(seg):
				duck = float(np.clip(10 ** ((LEVEL - UNDER - db(np.sqrt(np.mean(seg ** 2)))) / 20), 0.22, 1.0))
		cue = ln.get('cue', int(lid.split('-')[1]) - 1 if '-' in lid else 0)
		placed.append({'id': lid, 'shot': shot, 'cue': cue, 'at': round(at, 3), 'dur': round(dur, 3), 'file': f'vo/{lid}.wav', 'duck': round(duck, 3), 'take': takes[lid]})
		mk = ' '.join(f't{k}:{mm["speech"]:.2f}s/{mm["cps"]}cps/pause{mm["pause"]}/{mm["f0"]:.0f}Hz' for k, mm in meas[lid].items())
		over = at + dur - shot_len[shot]
		report.append(f'{lid:7} {"+".join(f"t{k}" for k in takes[lid])} {dur:5.2f}s  at {at:5.2f}-{at + dur:5.2f}  shot {shot_len[shot]:5.2f}{"  OVER THE CUT %.2f" % over if over > 0 else ""}  duck {duck:.2f}   [{mk}]')
	report.append('pitch by voice: ' + ', '.join(f'{v} {f:.0f} Hz' for v, f in f0s.items()))
	(ROOT / 'src' / 'vo.json').write_text(json.dumps({'_': 'voice-over lines placed by tools/vo_place.py: seconds into the shot; cue = the subtitle cue it says; duck = how far the score goes down under the line', 'lines': placed}, ensure_ascii=False, indent=1), encoding='utf-8')
	print('\n'.join(report))


if __name__ == '__main__':
	sys.exit(main())
