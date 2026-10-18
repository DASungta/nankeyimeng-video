"""Download the media that git leaves out, check it and unpack it into place.

    python -I tools/fetch_assets.py                   # the two packages needed to render the film
    python -I tools/fetch_assets.py --all             # also the rejected takes, the poster PNGs and the finished films
    python -I tools/fetch_assets.py --only nanke-vo.mp4
    python -I tools/fetch_assets.py --from D:/Downloads   # already downloaded (e.g. from a mirror): only check and unpack

Reads assets.json (written by tools/pack_assets.py): each file's name, size and SHA-256. Files go through release/
(a download that stops halfway resumes where it stopped); zips are unpacked into the repo root (muse/, public/,
posters/), films are put in out/. A file whose checksum does not match is not unpacked.
"""
import argparse
import hashlib
import json
import shutil
import sys
import urllib.request
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / 'release'


def sha256(path):
	h = hashlib.sha256()
	with open(path, 'rb') as f:
		for block in iter(lambda: f.read(1 << 22), b''):
			h.update(block)
	return h.hexdigest()


def download(url, dst, size):
	part = dst.with_name(dst.name + '.part')
	have = part.stat().st_size if part.exists() else 0
	if have >= size:  # finished last time, just not renamed
		part.replace(dst)
		return
	req =urllib.request.Request(url, headers={'Range': f'bytes={have}-'} if have else {})
	with urllib.request.urlopen(req, timeout=60) as r:
		if have and r.status != 206:  # the server ignored the range: start over
			have = 0
		with open(part, 'ab' if have else 'wb') as f:
			done, shown = have, -1
			while block := r.read(1 << 20):
				f.write(block)
				done += len(block)
				pct = done * 100 // size
				if pct // 5 != shown:
					shown = pct // 5
					print(f'\r  {dst.name}: {done / 1e6:.0f} / {size / 1e6:.0f} MB ({pct}%)', end='', flush=True)
	print()
	part.replace(dst)


def unpack(path):
	with zipfile.ZipFile(path) as z:
		for name in z.namelist():  # nothing may land outside the repo
			target = (ROOT / name).resolve()
			if ROOT not in target.parents and target != ROOT:
				raise RuntimeError(f'{path.name}: refusing to write {name}')
		z.extractall(ROOT)
		return len(z.namelist())


def main():
	ap = argparse.ArgumentParser()
	ap.add_argument('--all', action='store_true', help='also the optional files')
	ap.add_argument('--only', default='', help='comma-separated file names')
	ap.add_argument('--from', dest='src', default='', help='a folder that already holds the files')
	ap.add_argument('--keep', action='store_true', help='keep the downloads in release/ after unpacking')
	a = ap.parse_args()
	manifest = json.loads((ROOT / 'assets.json').read_text(encoding='utf-8'))
	only = set(filter(None, a.only.split(',')))
	if only:
		todo = [f for f in manifest['files'] if f['name'] in only]
	else:
		todo = [f for f in manifest['files'] if a.all or f['required']]
	unknown = only - {f['name'] for f in manifest['files']}
	if unknown:
		sys.exit(f'not in assets.json: {", ".join(sorted(unknown))}')
	CACHE.mkdir(exist_ok=True)
	for f in todo:
		name = f['name']
		path = Path(a.src) / name if a.src else CACHE / name
		if not (path.exists() and path.stat().st_size == f['bytes'] and sha256(path) == f['sha256']):
			if a.src:
				sys.exit(f'{name}: missing from {a.src}, or not the published file (size or SHA-256 differs)')
			print(f'downloading {name} ({f["bytes"] / 1e6:.0f} MB): {f["desc"]}', flush=True)
			download(manifest['download'] + name, path, f['bytes'])
			if sha256(path) != f['sha256']:
				path.unlink()
				sys.exit(f'{name}: SHA-256 does not match assets.json; deleted, run again')
		if f['unzip']:
			print(f'  {name}: unpacked {unpack(path)} files', flush=True)
		else:
			(ROOT / 'out').mkdir(exist_ok=True)
			shutil.copy2(path, ROOT / 'out' / name)
			print(f'  {name}: copied to out/', flush=True)
		if not a.src and not a.keep:
			path.unlink()
	print('done')


if __name__ == '__main__':
	sys.exit(main())
