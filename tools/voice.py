"""Record the voice-over takes with VoxCPM2 (a self-hosted Gradio service; its /generate takes text, style, reference, transcript).

    python -I tools/voice.py [--takes 1,2] [--only S05-1,S18-2]

Reads muse/vo/lines.json and, for every line and take that is not on disk yet, asks the service for one recording:
the line's voice reference is uploaded and cloned, and its style is the voice's style plus the line's mood. Each take
is saved as muse/vo/takes/<id>-t<k>.wav with the service's metrics next to it (.json). The service runs one job at a
time and loads the model for each (about a minute a line), so the lines go one after another; a busy GPU or a
dropped connection is retried. Credentials: ~/.config/voxcpm2-gateway/client.json ({base_url, api_key}).
"""
import argparse
import json
import shutil
import sys
import time
from pathlib import Path

from gradio_client import Client, handle_file

ROOT = Path(__file__).resolve().parent.parent
VO = ROOT / 'muse' / 'vo'
TAKES = VO / 'takes'


def client():
	cred = json.loads((Path.home() / '.config/voxcpm2-gateway/client.json').read_text())
	return Client(cred['base_url'], headers={'Authorization': 'Bearer ' + cred['api_key']}, verbose=False)


def style_of(voices, line, k):
	"""The service gives the same recording for the same request, so a second take asks for it differently: its own
	mood (mood2) if the line has one, else the first mood read a little faster."""
	style = voices[line['voice']]['style']
	mood = line.get('mood', '')
	if line.get(f'style{k}') is not None:  # a whole style of its own for this take
		return line[f'style{k}']
	if line.get(f'mood{k}'):
		mood = line[f'mood{k}']
	elif k == 2:
		mood = mood + '，语速稍快一些' if mood else '语速稍快一些'
	return style + '，' + mood if mood else style


def ref_of(voices, line, k):
	"""The voice to clone, and its transcript when the take continues from a recording (refK / transcriptK in the
	line: the service then takes the reference as the start of the speech and ignores the style)."""
	ref = line.get(f'ref{k}') or voices[line['voice']]['ref']
	if ref == 'none':  # no voice to clone: the style alone designs it
		return None, ''
	return ROOT / ref, line.get(f'transcript{k}', '')


def record(c, voices, line, out, patience, k):
	text = line.get(f'say{k}') or line.get('say', line['text'])
	style = style_of(voices, line, k)
	assert 1 <= len(text.strip()) <= 240 and len(style) <= 200, line['id']
	ref, transcript = ref_of(voices, line, k)
	if transcript:
		style = ''
	deadline = time.time() + patience * 60
	attempt = 0
	while True:
		try:
			job = c.submit(text=text, style=style, reference=handle_file(str(ref)) if ref else None, transcript=transcript, api_name='/generate')
			path, metrics = job.result(timeout=900)
			shutil.copyfile(path, out)
			meta = {'text': line['text'], 'say': text, 'style': style, 'voice': line['voice'], 'ref': str(ref.relative_to(ROOT)) if ref else '', 'transcript': transcript, 'metrics': metrics}
			out.with_suffix('.json').write_text(json.dumps(meta, ensure_ascii=False, indent=1), encoding='utf-8')
			return metrics
		except Exception as e:  # busy GPU, full queue, a failed worker, dropped connection: wait and try again
			attempt += 1
			if attempt == 1 or attempt % 10 == 0:
				print(f'  {line["id"]}: attempt {attempt} failed ({time.strftime("%H:%M:%S")}): {type(e).__name__}', flush=True)
			if time.time() > deadline:
				raise RuntimeError(f'{line["id"]}: no take after {attempt} attempts') from e
			time.sleep(12)


def main():
	ap = argparse.ArgumentParser()
	ap.add_argument('--takes', default='1')
	ap.add_argument('--only', default='')
	ap.add_argument('--patience', type=float, default=120, help='minutes to keep retrying one take')
	a = ap.parse_args()
	spec = json.loads((VO / 'lines.json').read_text(encoding='utf-8'))
	only = set(filter(None, a.only.split(',')))
	takes = [int(k) for k in a.takes.split(',')]
	TAKES.mkdir(parents=True, exist_ok=True)
	todo = [(k, ln) for k in takes for ln in spec['lines'] if (not only or ln['id'] in only) and not (TAKES / f'{ln["id"]}-t{k}.wav').exists()]
	print(f'{len(todo)} takes to record', flush=True)
	c = client()
	for i, (k, ln) in enumerate(todo):
		t0 = time.time()
		if i:
			time.sleep(12)  # the service frees the GPU after each job; a job sent straight away is refused
		m = record(c, spec['voices'], ln, TAKES / f'{ln["id"]}-t{k}.wav', a.patience, k)
		print(f'[{i + 1}/{len(todo)}] {ln["id"]} t{k}: {m.get("audio_seconds")} s audio, {time.time() - t0:.0f} s, rms {m.get("rms")}, clip {m.get("clipping_fraction")}', flush=True)


if __name__ == '__main__':
	sys.exit(main())
