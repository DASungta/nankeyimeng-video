"""Pack the media that git leaves out (see .gitignore) for the GitHub release.

    python -I tools/pack_assets.py [--only nanke-muse.zip,nanke-public.zip]

Writes release/<name> for each package below, and assets.json (name, size, SHA-256, what is in it), which
tools/fetch_assets.py reads to download, check and unpack them. The zips are stored, not compressed: the media in them
is compressed already. Upload everything in release/ to the release tagged TAG (each file must stay under 2 GiB).
"""
import argparse
import fnmatch
import hashlib
import json
import os
import shutil
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'release'
REPO = 'DASungta/nankeyimeng-video'
TAG = 'assets-v1'

PACKAGES = [
	{'name': 'nanke-muse.zip', 'required': True,
	 'desc': 'Muse 的设定图、定稿关键帧和视频（含补帧、拉匀、题字、合成后的版本），配音的全部录音和参考声音',
	 'include': ['muse/**'], 'exclude': ['muse/alt/**', 'muse/vo/lines.json']},
	{'name': 'nanke-public.zip', 'required': True,
	 'desc': '片头素材、海报和封面的底图、字体',
	 'include': ['public/opening/**', 'public/posters/**', 'public/fonts/*.ttf']},
	{'name': 'nanke-muse-alt.zip', 'required': False,
	 'desc': '候选和落选的图与视频（审片记录里提到的 alt 版本）',
	 'include': ['muse/alt/**']},
	{'name': 'nanke-posters-png.zip', 'required': False,
	 'desc': '海报和封面的 PNG 原图，含第一版 B站封面',
	 'include': ['posters/*.png', 'posters/alt/**']},
	{'name': 'nanke-vo.mp4', 'required': False, 'desc': '成片，配音版（244.7 秒）', 'file': 'out/nanke-vo.mp4'},
	{'name': 'nanke.mp4', 'required': False, 'desc': '成片，无配音版（222.7 秒）', 'file': 'out/nanke.mp4'},
]
LIMIT = 2 * 1024 ** 3  # GitHub's limit for one release file


def match(rel, patterns):
	return any(fnmatch.fnmatchcase(rel, p.replace('**', '*')) for p in patterns)


def members(pkg):
	"""Files of a zip package, as paths relative to the repo root with forward slashes, sorted."""
	found = set()
	for pat in pkg['include']:
		base = ROOT / pat.split('*')[0]
		for path in (base.rglob('*') if base.is_dir() else [base]):
			rel = path.relative_to(ROOT).as_posix()
			if path.is_file() and match(rel, pkg['include']) and not match(rel, pkg.get('exclude', [])):
				found.add(rel)
	return sorted(found)


def sha256(path):
	h = hashlib.sha256()
	with open(path, 'rb') as f:
		for block in iter(lambda: f.read(1 << 22), b''):
			h.update(block)
	return h.hexdigest()


def build(pkg):
	dst = OUT / pkg['name']
	if 'file' in pkg:
		src = ROOT / pkg['file']
		if dst.exists():
			dst.unlink()
		try:
			os.link(src, dst)  # the same disk: no second copy of a 350 MB film
		except OSError:
			shutil.copy2(src, dst)
		return 1
	files = members(pkg)
	tmp = dst.with_suffix('.part')
	with zipfile.ZipFile(tmp, 'w', zipfile.ZIP_STORED, allowZip64=True) as z:
		for rel in files:
			z.write(ROOT / rel, rel)
	tmp.replace(dst)
	return len(files)


def main():
	ap = argparse.ArgumentParser()
	ap.add_argument('--only', default='', help='comma-separated package names; the others keep their entry in assets.json')
	a = ap.parse_args()
	only = set(filter(None, a.only.split(',')))
	OUT.mkdir(exist_ok=True)
	manifest_path = ROOT / 'assets.json'
	old = {f['name']: f for f in json.loads(manifest_path.read_text(encoding='utf-8'))['files']} if manifest_path.exists() else {}
	entries = []
	for pkg in PACKAGES:
		name = pkg['name']
		if only and name not in only:
			if name in old:
				entries.append(old[name])
			continue
		n = build(pkg)
		size = (OUT / name).stat().st_size
		assert size < LIMIT, f'{name} is {size / 1e9:.2f} GB, over the 2 GiB limit of a release file'
		entries.append({'name': name, 'bytes': size, 'sha256': sha256(OUT / name), 'required': pkg['required'],
		                'unzip': name.endswith('.zip'), 'desc': pkg['desc']})
		print(f'{name}: {n} files, {size / 1e6:.0f} MB', flush=True)
	manifest = {
		'_': 'Media kept out of git. tools/pack_assets.py writes this; tools/fetch_assets.py downloads, checks and unpacks it.',
		'release': f'https://github.com/{REPO}/releases/tag/{TAG}',
		'download': f'https://github.com/{REPO}/releases/download/{TAG}/',
		'files': entries,
	}
	manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
	print(f'wrote assets.json; upload release/* to {manifest["release"]}')


if __name__ == '__main__':
	sys.exit(main())
