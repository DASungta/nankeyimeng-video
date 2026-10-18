// 《南柯一梦》, the edit. Shot order, in-points and lengths come from src/clips.json (tools/prep_clips.py writes it
// from edl.json); the subtitles from src/subs.js; the score is public/music.wav (music/make-music.mjs).
// - The two changes of style are baked into the clips by tools/prep_clips.py: S07 opens out of S06's black like
//   ink spreading through silk, S20 (the cup) comes through S17's white. In the waking world the cuts are hard; inside the
//   dream each shot dissolves into the next over half a second (the earlier shot plays on under it).
// - S04→S05 is not a cut but a doze: his eyes close over the cup and the slanting sun, lift once, shut. S05 is his
//   point of view: in the dark a voice calls him; his eyes open slowly, heavy, on the two messengers kneeling and
//   staring at him, then snap wide in shock (Eyelids below, timed from src/cues.json; the score follows the same cues).
// - The waking mirrors the falling asleep, which closed on the cup (S04): out of the white, the cup again (S20) and his
//   friends laughing (their laughter runs on under S18, CARRY); then his sleeping face (S18), the call, and S18→S18A:
//   the camera closes in on his sleeping face (PUSH), cuts in to his eyes, they snap
//   open, and the film cuts from them to the digging (S21); S19, sitting up, was dropped.
// - S09's prostrating 淳于棼 is composited into the clip by tools/s09_figure.py, the plaques by tools/plaque_text.py.
// - S25 gets rain and two flashes of lightning here (Muse would not draw a storm); the thunder is in the score,
//   both timed from src/cues.json.
// - Muse's own sound is the ambient bed: each clip at the gain prep_clips measured, pulled down in the dream and
//   brought up where there is no music (waking, the storm).
import React from 'react';
import {AbsoluteFill, Html5Audio, Img, OffthreadVideo, Sequence, interpolate, random, staticFile, useCurrentFrame} from 'remotion';
import clips from './clips.json';
import cues from './cues.json';
import vo from './vo.json';
import {SUBS, SUBS_EN} from './subs';
import {KAI} from './fonts';
import opening from './opening.json';
import voice from './voice.json';

export const FPS = clips.fps;
const XF = 12; // dissolve inside the dream, frames
// slower dissolves (frames) into these shots: from the princess's death to the king's suspicion the story moves through
// several turns in a few shots, and half-second dissolves made it feel rushed (director, 2026-10-17)
const XF_INTO = {S13A: 30, S14: 30, S14A: 30, S15: 30};
const xfInto = (id) => XF_INTO[id] ?? XF;
const DREAM = new Set(['S07', 'S08', 'S09', 'S10', 'S10B', 'S10C', 'S10A', 'S11', 'S11A', 'S12B', 'S12', 'S12A', 'S13', 'S13A', 'S14', 'S14A', 'S15', 'S15A', 'S16', 'S17']);
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'};
// frames a shot starts early, fading in over the end of the shot before it (none at present: S18A did, but two
// differently moving AI camera moves dissolving into each other read as a stutter, so S18→S18A is now a cut-in)
const LEAD_IN = {};
// shots that may run past their clip, holding the white they end on: S17, the cart into the light (with the voice-over
// its line needs a moment to land before he wakes, director 2026-10-18, and the clip has nothing more after its white)
const HOLD_WHITE = new Set(['S17']);

let acc = 0;
export const SHOTS = clips.shots.map((s) => {
	const len = Math.round(s.dur * FPS);
	const shot = {...s, from: acc, len};
	acc += len;
	return shot;
});
export const TOTAL = acc;
SHOTS.forEach((s, i) => {
	const next = SHOTS[i + 1];
	const prev = SHOTS[i - 1];
	s.tail = next && DREAM.has(s.id) && DREAM.has(next.id) ? xfInto(next.id) : 0;
	s.xf = xfInto(s.id); // how long this shot takes to dissolve in
	s.dissolveIn = Boolean(prev && DREAM.has(s.id) && DREAM.has(prev.id));
	// a shot that would run past the end of its clip while the next one dissolves in starts a little earlier; one that
	// ends on white (HOLD_WHITE) keeps its in-point and holds the white past the clip's last frame instead
	s.start = s.file ? (HOLD_WHITE.has(s.id) ? Math.round(s.in * FPS) : Math.min(Math.round(s.in * FPS), (s.frames ?? 240) - s.len - s.tail - 1)) : 0;
	s.avail = s.file ? (s.frames ?? 240) - s.start : s.len; // frames of clip there are from the in-point on
	// a shot that fades in over the end of the one before it (instead of the one before running on under it)
	s.lead = LEAD_IN[s.id] ?? 0;
});
const at = Object.fromEntries(SHOTS.map((s) => [s.id, s]));

// ---------- S04→S05: falling asleep, and opening his eyes on the messengers ----------
// how open his eyes are, frames relative to the cut into S05: heavy, a drowsy lift, shut; dark while the voice calls;
// slowly half open, a droop, half open again; then wide in three frames
const EYE_OPEN = Math.round(cues.eyes.open * FPS);
const EYE_SNAP = Math.round(cues.eyes.snap * FPS);
const LIDS = [[-30, 1], [-17, 0.42], [-12, 0.58], [-1, 0], [EYE_OPEN, 0], [EYE_OPEN + 22, 0.36], [EYE_OPEN + 28, 0.3], [EYE_SNAP, 0.5], [EYE_SNAP + 3, 1]];
const openAt = (f) => {
	const t = f - at.S05.from;
	if (t <= LIDS[0][0] || t >= LIDS[LIDS.length - 1][0]) return 1;
	let i = 1;
	while (t > LIDS[i][0]) i++;
	const [a, va] = LIDS[i - 1];
	const [b, vb] = LIDS[i];
	const x = (t - a) / (b - a);
	return va + (vb - va) * x * x * (3 - 2 * x);
};
const Eyelids = () => {
	const f = useCurrentFrame();
	const o = openAt(f);
	if (o >= 0.999) return null;
	// the opening is an almond between two curved lids; the upper lid travels further, and they meet a little below
	// the middle. At o = 1 the lids are well off the frame, corners included.
	const hh = 1500 * o * o;
	const cy = 560 - 20 * o;
	const d = `M -400 -400 H 2320 V 1480 H -400 Z M -700 ${cy} Q 960 ${cy - 2.3 * hh} 2620 ${cy} Q 960 ${cy + 1.7 * hh} -700 ${cy} Z`;
	return (
		<svg width={1920} height={1080} style={{position: 'absolute', inset: 0}}>
			<defs>
				<filter id="lid" x="-10%" y="-30%" width="120%" height="160%">
					<feGaussianBlur stdDeviation={16 + 24 * (1 - o)} />
				</filter>
			</defs>
			<path d={d} fill="#0b0605" fillRule="evenodd" filter="url(#lid)" />
		</svg>
	);
};

// ---------- S18→S18A: the camera closes in on his sleeping face, then a cut-in to his eyes ----------
// S18 adds a gentle push (1.12x around the middle of his eyes) that eases in and out, so at the cut only Muse's own
// slow camera is moving. S18A is shown tighter (1.25x around a point chosen so his eyes stay near where they were in
// S18): a clearly bigger shot reads as a cut to a close-up, where a matched framing made the two clips' different
// camera moves read as a hitch. Seconds into the shot; scale; the fixed point as fractions of the frame.
// Muse's camera in S18A pans while it pushes in, so his face slides about 14% of the frame left and 11% down over the
// shot (median optical flow from 0.6 s into the clip, measured 2026-10-16): [seconds after 0.6 s, x, y] as fractions
// of the clip's frame. `t0` is where the shot's in-point falls on that scale (3.2 s into the clip = 2.6), so the drift
// held off before the in-point stays held off and the framing is the one the cut was judged on.
// `hold` cancels that share of it, so the close-up becomes a steady push that keeps his eyes where the cut put them.
const S18A_DRIFT = [[0, 0, 0], [0.5, -0.022, 0.009], [1, -0.048, 0.021], [1.5, -0.071, 0.036], [2, -0.091, 0.05], [2.5, -0.105, 0.06], [3, -0.114, 0.071], [3.5, -0.117, 0.081], [4, -0.121, 0.091], [4.5, -0.131, 0.099], [5, -0.14, 0.107], [5.5, -0.153, 0.104]];
const PUSH = {
	S18: {from: 2.6, to: 119 / 24, scale: 1.12, ox: 0.65, oy: 0.445},
	S18A: {from: 0, to: 0, scale: 1.25, ox: 0.85, oy: 0.2, hold: 0.9, drift: S18A_DRIFT, t0: 2.6},
};
const pushAt = (s, f) => {
	const p = PUSH[s.id];
	if (!p) return null;
	let x = p.to > p.from ? interpolate(f / FPS, [p.from, p.to], [0, 1], clamp) : 1;
	x = x * x * (3 - 2 * x);
	const scale = 1 + (p.scale - 1) * x;
	let tx = 0;
	let ty = 0;
	if (p.drift) {
		const t = f / FPS + (p.t0 ?? 0);
		const times = p.drift.map((d) => d[0]);
		tx = -p.hold * scale * interpolate(t, times, p.drift.map((d) => d[1]), clamp);
		ty = -p.hold * scale * interpolate(t, times, p.drift.map((d) => d[2]), clamp);
	}
	return {scale, origin: `${p.ox * 100}% ${p.oy * 100}%`, tx, ty};
};

// ---------- the voice-over ----------
// one entry per spoken line (src/vo.json, written by tools/vo_place.py from muse/vo/lines.json): where it starts in its
// shot, how long it is, which subtitle cue it says (cue), and how far the score goes down under it (duck). The score
// dips 0.25 s before a line and comes back over half a second after it; the ambient bed dips a little too.
// src/voice.json can turn it off: the cut as it was before the voice-over
const VOICE = (voice.use ? vo.lines : []).filter((l) => at[l.shot]).map((l) => {
	const from = at[l.shot].from + Math.round(l.at * FPS);
	return {...l, from, len: Math.ceil(l.dur * FPS), to: from + Math.ceil(l.dur * FPS)};
});
const speaking = (f, dip) => {
	let v = 0;
	for (const l of VOICE) {
		if (f < l.from - 6 || f > l.to + 12) continue;
		v = Math.max(v, interpolate(f, [l.from - 6, l.from, l.to, l.to + 12], [0, 1, 1, 0], clamp) * (dip ? 1 - l.duck : 1));
	}
	return v;
};
const musicVolume = (f) => 1 - speaking(f, true);
const bedVolume = (f) => 1 - 0.5 * speaking(f, false);
const Voice = () => (
	<>
		{VOICE.map((l) => (
			<Sequence key={l.id} from={l.from} durationInFrames={l.len + 2} name={'vo ' + l.id}>
				<Html5Audio src={staticFile(l.file)} />
			</Sequence>
		))}
	</>
);

// ---------- sound: the ambient bed ----------
// a shot's own sound running on under the next shot and fading out: the friends' laughter (S20) goes on, further off,
// while the camera finds him asleep (S18)
// [shot, the shot it runs under, seconds, starting level]: the laughter gets louder just after the cut, so it starts
// lower and fades, staying behind the sleeping face
const CARRY = [['S20', 'S18', 2.4, 0.45]].map(([a, b, sec, lv]) => ({from: at[a], to: at[b], frames: Math.round(sec * FPS), lv}));
const level = (id) => (id === 'S20' || id === 'S18' || id === 'S18A' ? 1.5 : id === 'S25' ? 1.6 : DREAM.has(id) ? 0.8 : 1);
const volume = (s) => (f) => {
	let v = s.gain * level(s.id);
	v *= interpolate(f, [0, s.dissolveIn ? s.xf : 3], [0, 1], clamp);
	v *= s.tail ? interpolate(f, [s.len, s.len + s.tail], [1, 0], clamp) : interpolate(f, [s.len - 3, s.len], [1, 0], clamp);
	if (s.id === 'S06') v *= interpolate(f, [7.0 * FPS, 8.5 * FPS], [1, 0], clamp); // silence in the black
	if (s.id === 'S07') v *= interpolate(f, [0.4 * FPS, 1.6 * FPS], [0, 1], clamp); // and back as the ink spreads
	if (s.id === 'S04') v *= interpolate(f, [s.len - 30, s.len], [1, 0.35], clamp); // the world recedes as he dozes
	if (s.id === 'S05') v *= interpolate(f, [0, EYE_OPEN, EYE_SNAP, EYE_SNAP + 3], [0.15, 0.25, 0.5, 1.1], clamp); // muffled while asleep
	return v * bedVolume(s.from + f); // and a little lower under the voice-over
};

// ---------- S25: rain and lightning ----------
const PULSE = [1, 0.5, 0.2, 0.85, 0.45, 0.22, 0.1, 0.04];
const flashAt = (f) => {
	let v = 0;
	for (const t of cues.flashes) {
		const k = f - Math.round(t * FPS);
		if (k >= 0 && k < PULSE.length) v = Math.max(v, PULSE[k]);
	}
	return v;
};
const Rain = ({flash}) => {
	const f = useCurrentFrame();
	const drops = [];
	for (let i = 0; i < 720; i++) {
		const near = i < 170;
		const speed = (near ? 150 : 95) * (0.85 + 0.3 * random(`v${i}`)); // px per frame
		const len = near ? 70 + 50 * random(`l${i}`) : 28 + 24 * random(`l${i}`);
		const y = ((random(`y${i}`) * 1400 + f * speed) % 1400) - 160;
		const x = random(`x${i}`) * 2300 - 250 + y * 0.2;
		const op = (near ? 0.32 : 0.2) * (0.6 + 0.4 * random(`o${i}`)) * (1 + 1.6 * flash);
		drops.push(<line key={i} x1={x} y1={y} x2={x + len * 0.2} y2={y + len} stroke="#d6e0ee" strokeOpacity={Math.min(0.9, op)} strokeWidth={near ? 2 : 1.1} strokeLinecap="round" />);
	}
	return (
		<svg width={1920} height={1080} style={{position: 'absolute', inset: 0}}>
			{drops}
		</svg>
	);
};

// ---------- name seals: introducing the people, as a film introduces its cast ----------
// A vermilion seal with the name cut in white is stamped beside each person the first time we meet him: his two
// drinking friends 周弁 and 田子华 under the tree (S01), 淳于棼 in his close-up (S02), and the same two seals again
// on the friends he meets at the wedding feast in the dream (S10B), so the two meetings read as one (director,
// 2026-10-16). Names in traditional characters, like the plaques. `track` is the head of the person in the clip,
// [seconds into the shot, x, y] as fractions of the frame, read off gridded frames; the seal sits `gap` to his
// left (side -1) or right (side 1), centred on his head, and follows him through the camera move.
const SEALS = [
	{shot: 'S01', text: '周弁', at: 1.6, side: -1, gap: 0.075, track: [[0, 0.39, 0.69], [2, 0.354, 0.615], [3, 0.365, 0.575], [4, 0.354, 0.54], [5, 0.34, 0.5]]},
	{shot: 'S01', text: '田子華', at: 2.3, side: 1, gap: 0.075, track: [[0, 0.6, 0.685], [2, 0.63, 0.61], [3, 0.65, 0.574], [4, 0.66, 0.537], [5, 0.69, 0.49]]},
	{shot: 'S02', text: '淳于棼', at: 0.5, side: 1, gap: 0.15, track: [[0, 0.39, 0.22], [2, 0.33, 0.21], [4, 0.25, 0.21]]},
	{shot: 'S10B', text: '周弁', at: 0.6, side: -1, gap: 0.1, track: [[0, 0.33, 0.3], [4, 0.354, 0.3]]},
	{shot: 'S10B', text: '田子華', at: 1.1, side: 1, gap: 0.1, track: [[0, 0.68, 0.3], [4, 0.667, 0.31]]},
];
const SEAL_FONT = 54;
// one seal, its characters in a column, centred on (x, y) in pixels; `press` is frames since it was stamped
export const SealMark = ({text, x, y, k, press, fade = 1, tilt = 0, font = SEAL_FONT, shadow = 'drop-shadow(0 2px 5px rgba(0,0,0,0.45))', worn = true}) => {
	if (press < 0) return null;
	const n = [...text].length;
	const w = font + 24;
	const h = n * (font + 4) + 20;
	// the press: comes down a little large and settles in four frames
	const sc = interpolate(press, [0, 4], [1.28, 1], {...clamp, easing: (v) => 1 - (1 - v) ** 3});
	const op = interpolate(press, [0, 3], [0, 0.94], clamp) * fade;
	const id = `seal${k}`;
	return (
		<div style={{position: 'absolute', left: x - w / 2, top: y - h / 2, width: w, height: h, opacity: op, transform: `scale(${sc.toFixed(3)}) rotate(${tilt}deg)`, filter: shadow}}>
			<svg width={w} height={h} style={{overflow: 'visible'}}>
				<defs>
					{/* worn ink: small specks where the paper did not take the colour, and slightly ragged edges */}
					<filter id={id} x="-10%" y="-10%" width="120%" height="120%">
						<feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed={7 + k} result="grain" />
						<feColorMatrix in="grain" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -3.2 2.25" result="specks" />
						{/* on black the specks would show the black through, so a seal there is printed clean (worn = false) */}
						<feComposite in="SourceGraphic" in2={worn ? 'specks' : 'SourceGraphic'} operator="in" result="inked" />
						<feTurbulence type="fractalNoise" baseFrequency="0.06" numOctaves="2" seed={31 + k} result="warp" />
						<feDisplacementMap in="inked" in2="warp" scale="3.5" xChannelSelector="R" yChannelSelector="G" />
					</filter>
				</defs>
				<g filter={`url(#${id})`}>
					<rect x={0} y={0} width={w} height={h} rx={5} fill="#b4261c" />
					{[...text].map((ch, i) => (
						<text key={i} x={w / 2} y={12 + (i + 0.5) * (font + 4)} textAnchor="middle" dominantBaseline="central" fontFamily={KAI} fontSize={font} fill="#f3e6cc" stroke="#f3e6cc" strokeWidth={font / 25}>
							{ch}
						</text>
					))}
				</g>
			</svg>
		</div>
	);
};
const Seal = ({seal, k}) => {
	const s = at[seal.shot];
	const f = useCurrentFrame();
	const t = f / FPS;
	const times = seal.track.map((p) => p[0]);
	const x = interpolate(t, times, seal.track.map((p) => p[1]), clamp) + seal.side * seal.gap;
	const y = interpolate(t, times, seal.track.map((p) => p[2]), clamp);
	// in the dream it fades with the shot
	const fade = s.tail ? interpolate(f, [s.len, s.len + s.tail], [1, 0], clamp) : 1;
	return <SealMark text={seal.text} x={x * 1920} y={y * 1080} k={k} press={f - Math.round(seal.at * FPS)} fade={fade} tilt={seal.side * -2} />;
};
const Seals = () => (
	<>
		{SEALS.map((seal, k) => {
			const s = at[seal.shot];
			return (
				<Sequence key={k} from={s.from} durationInFrames={s.len + s.tail} name={`seal ${seal.text}`}>
					<Seal seal={seal} k={k} />
				</Sequence>
			);
		})}
	</>
);

// ---------- picture ----------
const Shot = ({s}) => {
	const f = useCurrentFrame() - s.lead; // frames into the shot proper (negative while it fades in early)
	const opacity = s.dissolveIn ? interpolate(f, [0, s.xf], [0, 1], clamp) : s.lead ? interpolate(f, [-s.lead, 0], [0, 1], clamp) : 1;
	const flash = s.id === 'S25' ? flashAt(f) : 0;
	const eye = s.id === 'S04' || s.id === 'S05' ? openAt(s.from + f) : 1; // out of focus and dimmer as the eyes close
	// the shock: as his eyes snap wide the picture jumps sharp, a touch brighter, and lurches closer
	const k = s.id === 'S05' ? f - EYE_SNAP : -1;
	const jolt = k >= 0 ? interpolate(k, [0, 3], [0, 1], clamp) : 0;
	const push = pushAt(s, f);
	const scale = push ? push.scale : 1 + jolt * (0.025 + 0.03 * Math.exp(-Math.max(0, k - 3) / 10));
	const lift = k >= 0 ? 0.12 * Math.exp(-k / 5) : 0;
	const filter = flash
		? `brightness(${1 + 2.4 * flash}) saturate(${1 - 0.45 * flash})`
		: eye < 1
			? `blur(${(9 * (1 - eye) ** 0.8).toFixed(2)}px) brightness(${(0.72 + 0.28 * eye).toFixed(3)})`
			: lift > 0.002
				? `brightness(${(1 + lift).toFixed(3)})`
				: undefined;
	return (
		<AbsoluteFill style={{opacity}}>
			{f < s.avail - 1 ? <OffthreadVideo
				src={staticFile(s.file)}
				trimBefore={s.start - s.lead}
				volume={(v) => volume(s)(v - s.lead)}
				style={{width: '100%', height: '100%', objectFit: 'cover', filter, transform: push && (push.tx || push.ty) ? `translate(${(push.tx * 100).toFixed(3)}%, ${(push.ty * 100).toFixed(3)}%) scale(${scale.toFixed(4)})` : scale > 1 ? `scale(${scale.toFixed(4)})` : undefined, transformOrigin: push ? push.origin : undefined}}
			/> : null}
			{s.id === 'S25' ? (
				<>
					<AbsoluteFill style={{background: '#d4e0ff', mixBlendMode: 'screen', opacity: 0.22 * flash}} />
					<Rain flash={flash} />
				</>
			) : null}
			{/* out of the dream: whatever Muse's light does, the last 0.8 s of S17 (or of its clip, when the white is held past it)
			goes to the warm white that S20 comes out of */}
			{s.id === 'S17' ? <AbsoluteFill style={{background: '#fcf6eb', opacity: interpolate(f, [Math.min(s.len, s.avail) - 19, Math.min(s.len, s.avail) - 1], [0, 1], {...clamp, easing: (v) => v * v})}} /> : null}
		</AbsoluteFill>
	);
};

// ---------- subtitles ----------
const SUB_DELAY = {S07: 20, S20: 20, S14: 26}; // S14: after its slow dissolve // wait for the ink and the white to clear (S00A, S05, S18 and the other shots with
// more than one line time their own lines in subs.js)
const SUB_END = {S17: 72}; // S17 turns white after about 3.2 s, where the words could not be read
// every line as a cue {from, to, line, en, by} in film frames; en is the English under it (SUBS_EN)
const CUES = SHOTS.flatMap((s) => {
	const t = SUBS[s.id];
	if (!t) return [];
	const en = SUBS_EN[s.id];
	const said = (c, i) => {
		// a line that is spoken comes up with the voice and stays until the voice has finished
		const v = VOICE.filter((l) => l.shot === s.id && l.cue === i);
		if (!v.length) return c;
		return {...c, from: Math.min(...v.map((l) => l.from)) - 4, to: Math.max(c.to, Math.max(...v.map((l) => l.to)) + 10)};
	};
	if (Array.isArray(t) && typeof t[0] === 'object') {
		return t.map((c, i) => said({from: s.from + Math.round(c.at * FPS), to: s.from + (c.end == null ? s.len - 5 : Math.round(c.end * FPS)), line: c.text, en: en?.[i], by: c.by}, i));
	}
	const [line, by] = Array.isArray(t) ? t : [t];
	return [said({from: s.from + (SUB_DELAY[s.id] ?? 6), to: s.from + (SUB_END[s.id] ?? s.len - 5), line, en, by}, 0)];
});
// a line held for its voice gives way to the next one
CUES.forEach((c, i) => {
	const next = CUES[i + 1];
	if (next && c.to > next.from - 1) c.to = next.from - 1;
});
// the shade behind the words: on a little before and after each line, so that it stays on across cuts between
// lines and fades only where there are no words (or where the words wait for the picture)
const hasSub = (f) => (CUES.some((c) => f >= c.from - 6 && f <= c.to + 5) ? 1 : 0);
const Subtitle = () => {
	const f = useCurrentFrame();
	let shade = 0;
	for (let k = -8; k <= 8; k++) shade += hasSub(f + k) / 17;
	const c = CUES.find((x) => f >= x.from && f < x.to);
	const op = c ? interpolate(f, [c.from, c.from + 7, c.to - 7, c.to], [0, 1, 1, 0], clamp) : 0;
	return (
		<AbsoluteFill>
			<AbsoluteFill style={{opacity: shade, background: 'linear-gradient(to top, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.2) 14%, rgba(0,0,0,0) 28%)'}} />
			{c ? (
				<div
					style={{
						position: 'absolute',
						left: 60,
						right: 60,
						bottom: 56,
						textAlign: 'center',
						opacity: op,
						fontFamily: KAI,
						fontSize: 50,
						lineHeight: 1.3,
						letterSpacing: '0.06em',
						color: '#f4ecd9',
						textShadow: '0 0 12px rgba(0,0,0,0.75), 0 2px 4px rgba(0,0,0,0.9)',
					}}
				>
					{c.line}
					{c.by ? <span style={{fontSize: 34, marginLeft: 26, color: '#ddd0b4'}}>——{c.by}</span> : null}
					{/* the English, smaller, under the Chinese (director, 2026-10-17) */}
					{c.en ? <div style={{marginTop: 6, fontFamily: "'Times New Roman', Georgia, serif", fontSize: 31, lineHeight: 1.25, letterSpacing: '0.01em', color: '#e8dfca'}}>{c.en}</div> : null}
				</div>
			) : null}
		</AbsoluteFill>
	);
};

// ---------- title ----------
const Title = () => {
	const f = useCurrentFrame();
	const len = at.S28.len;
	const out = interpolate(f, [len - 20, len], [1, 0], clamp);
	return (
		<AbsoluteFill style={{background: '#050505', alignItems: 'center', justifyContent: 'center'}}>
			<div style={{fontFamily: KAI, fontSize: 132, letterSpacing: '0.32em', paddingLeft: '0.32em', color: '#e6d6b0', opacity: interpolate(f, [6, 34], [0, 1], clamp) * out}}>南柯一梦</div>
			{/* what the idiom means, for those who meet it here first (director, 2026-10-16) */}
			<div style={{marginTop: 14, fontFamily: "'Times New Roman', Georgia, serif", fontSize: 30, letterSpacing: '0.36em', paddingLeft: '0.36em', color: '#c9bb9b', opacity: interpolate(f, [16, 44], [0, 1], clamp) * out}}>A DREAM UNDER THE SOUTHERN BOUGH</div>
			<div style={{marginTop: 46, fontFamily: KAI, fontSize: 44, letterSpacing: '0.1em', color: '#d8c9a6', opacity: interpolate(f, [30, 58], [0, 1], clamp) * out}}>后来，人们用这四个字比喻一场空欢喜的大梦</div>
			<div style={{marginTop: 8, fontFamily: "'Times New Roman', Georgia, serif", fontSize: 30, color: '#cdbf9f', opacity: interpolate(f, [30, 58], [0, 1], clamp) * out}}>Ever since, “a dream under the southern bough” has meant a grand dream of joy that comes to nothing.</div>
			<div style={{marginTop: 34, fontFamily: KAI, fontSize: 30, letterSpacing: '0.18em', color: '#9d907a', opacity: interpolate(f, [52, 80], [0, 1], clamp) * out}}>据唐·李公佐《南柯太守传》</div>
			<div style={{marginTop: 6, fontFamily: "'Times New Roman', Georgia, serif", fontSize: 22, letterSpacing: '0.06em', color: '#8f846f', opacity: interpolate(f, [52, 80], [0, 1], clamp) * out}}>After “The Governor of the Southern Tributary State” by Li Gongzuo, Tang dynasty</div>
		</AbsoluteFill>
	);
};

// ---------- the opening ----------
// Before the story (S00; added 2026-10-17, the director asked for an opening made from the film's own material):
// bare silk; the old 槐 of the courtyard soaks into it as an ink painting, from the hollow at its roots outwards
// (Muse's OP-a; the reveal is baked by tools/make_opening.py); a small ink ant comes up from the bottom of the silk,
// stops, and walks into the painted hollow, as the ants will in S00B and he will in S06; the title inks in down the
// bare silk on the right, with the source beside it and a seal under that, 槐安 (the kingdom in the tree, S08's
// plaque); then the camera pushes into the hollow until the painted hollow sits where the real one is in S00A's first
// frame, and the painting dissolves into the real tree, which then starts to move. Positions are fractions of the
// frame; times come from src/cues.json (the score reads the same ones).
const OP = cues.opening;
const OPEN = {
	hollow: [0.306, 0.835], // the painted hollow (tools/make_opening.py, HOLLOW)
	match: {scale: 1.75, to: [0.517, 0.855]}, // the real hollow in S00A's first frame (measured 2026-10-17)
	title: {text: '南柯一梦', x: 0.862, y: 0.27, size: 112},
	credit: {cols: [[0.808, '据唐·李公佐'], [0.782, '︽南柯太守传︾改编']], y: 0.3, size: 32, gap: 0.3},
	seal: {text: '槐安', x: 0.782, y: 0.665, font: 36},
	// the ant: up from the bottom edge onto the bare ground under the roots, a pause, then over the roots into the hollow
	path: [[0.7, 1.04], [0.665, 0.965], [0.6, 0.936], [0.52, 0.916], [0.44, 0.896], [0.38, 0.872], [0.34, 0.852], [0.305, 0.838]],
};
const ss = (a, b, v) => {
	const x = Math.min(1, Math.max(0, (v - a) / (b - a)));
	return x * x * (3 - 2 * x);
};
// the ant's path as a smooth curve (Catmull-Rom through OPEN.path), measured along its length
const ANT_PATH = (() => {
	const P = OPEN.path.map(([x, y]) => [x * 1920, y * 1080]);
	const pts = [];
	for (let i = 0; i < P.length - 1; i++) {
		const [p0, p1, p2, p3] = [P[Math.max(0, i - 1)], P[i], P[i + 1], P[Math.min(P.length - 1, i + 2)]];
		for (let k = 0; k < 24; k++) {
			const s = k / 24;
			pts.push([0, 1].map((d) => 0.5 * (2 * p1[d] + (p2[d] - p0[d]) * s + (2 * p0[d] - 5 * p1[d] + 4 * p2[d] - p3[d]) * s * s + (3 * p1[d] - p0[d] - 3 * p2[d] + p3[d]) * s ** 3)));
		}
	}
	pts.push(P[P.length - 1]);
	const len = [0];
	for (let i = 1; i < pts.length; i++) len.push(len[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
	return {pts, len, total: len[len.length - 1]};
})();
const antAlong = (d) => {
	const {pts, len} = ANT_PATH;
	let i = 1;
	while (i < len.length - 1 && len[i] < d) i++;
	const x = Math.min(1, Math.max(0, (d - len[i - 1]) / (len[i] - len[i - 1] || 1)));
	const [a, b] = [pts[i - 1], pts[i]];
	return {x: a[0] + (b[0] - a[0]) * x, y: a[1] + (b[1] - a[1]) * x, angle: (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI};
};
// distance walked: a steady walk with short speed-ups and slow-downs, the stop, and on into the hollow
const ramp = (u, r = 0.18) => {
	const v = 1 / (1 - r);
	return u < r ? (0.5 * v * u * u) / r : u < 1 - r ? v * (u - r / 2) : 1 - (0.5 * v * (1 - u) ** 2) / r;
};
const antDist = (t) => {
	const [a, b] = OP.antPause;
	const w1 = a - OP.antIn;
	const w2 = OP.antGone - b;
	const L1 = (ANT_PATH.total * w1) / (w1 + w2);
	if (t <= OP.antIn) return 0;
	if (t < a) return L1 * ramp((t - OP.antIn) / w1);
	if (t < b) return L1;
	return L1 + (ANT_PATH.total - L1) * ramp(Math.min(1, (t - b) / w2));
};
// an ant drawn the way the dream's painters would: solid ink for the body, a hairline for each leg; heading +x, in
// units of ANT_K pixels (about 65 px nose to tail). Legs move in two tripods; the feet stay put while on the ground.
const ANT_K = 2;
const INK = '#1d140d';
const LEGS = [
	{hip: [8, 2.2], foot: [16, 10], knee: [1.5, 3], tri: 0},
	{hip: [5, 2.6], foot: [4, 12.5], knee: [0, 3.5], tri: 1},
	{hip: [2, 2.4], foot: [-8, 11.5], knee: [-1.5, 3], tri: 0},
];
const rot = ([x, y], deg) => {
	const r = (deg * Math.PI) / 180;
	return [x * Math.cos(r) - y * Math.sin(r), x * Math.sin(r) + y * Math.cos(r)];
};
const Ant = ({x, y, angle, travel, t, still, opacity, scale}) => {
	const stride = 7;
	const phase = travel / stride;
	const parts = [];
	for (const side of [1, -1]) {
		LEGS.forEach((L, k) => {
			const tri = side === 1 ? L.tri : 1 - L.tri;
			const u = (((phase + tri * 0.5) % 1) + 1) % 1;
			const dx = u < 0.5 ? stride * (0.25 - u) : stride * (u - 0.75); // back along the ground, then swung forward
			const lift = u < 0.5 ? 0 : 0.8 * Math.sin(Math.PI * (u - 0.5) * 2);
			const [hx, hy] = [L.hip[0], side * L.hip[1]];
			const [fx, fy] = [L.foot[0] + dx, side * (L.foot[1] + lift)];
			const [kx, ky] = [hx + 0.45 * (fx - hx) + L.knee[0], hy + 0.45 * (fy - hy) + side * L.knee[1]];
			parts.push(<polyline key={`l${side}${k}`} points={`${hx},${hy} ${kx},${ky} ${fx},${fy}`} fill="none" stroke={INK} strokeWidth={0.7} strokeLinecap="round" strokeLinejoin="round" />);
		});
		// the antennae feel about as it walks, and more while it stands
		const tw = (still ? 14 : 6) * Math.sin(2 * Math.PI * (still ? 2.3 : 1.6) * t + side * 1.3);
		const base = [16.3, side * 1.5];
		const s1 = rot([4.5, side * 5], 0.5 * tw);
		const elbow = [base[0] + s1[0], base[1] + s1[1]];
		const s2 = rot([6.2, -side * 0.6], tw);
		parts.push(<polyline key={`a${side}`} points={`${base[0]},${base[1]} ${elbow[0]},${elbow[1]} ${elbow[0] + s2[0]},${elbow[1] + s2[1]}`} fill="none" stroke={INK} strokeWidth={0.5} strokeLinecap="round" strokeLinejoin="round" />);
	}
	const sway = still ? 0 : 2.5 * Math.sin(2 * Math.PI * phase);
	return (
		<g transform={`translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${(angle + sway).toFixed(2)}) scale(${(ANT_K * scale).toFixed(3)})`} opacity={opacity}>
			{parts}
			<ellipse cx={-7.5} cy={0} rx={6.8} ry={5} fill={INK} />
			<ellipse cx={0.6} cy={0} rx={1.5} ry={1.3} fill={INK} />
			<ellipse cx={6.5} cy={0} rx={5.2} ry={2.4} fill={INK} />
			<ellipse cx={14.5} cy={0} rx={3.8} ry={3.3} fill={INK} />
			<path d="M 17.6 -1.4 Q 19.8 -1.2 19.6 0.2 M 17.6 1.4 Q 19.8 1.2 19.6 -0.2" fill="none" stroke={INK} strokeWidth={0.6} strokeLinecap="round" />
			{/* fine lighter lines, as a painter picks out the segments of the abdomen and the sheen of the head */}
			<path d="M -12 -2.6 Q -7.5 -4.5 -3 -2.9 M -9.6 -4.6 Q -8.4 0 -9.6 4.6 M -6 -4.9 Q -4.9 0 -6 4.9" fill="none" stroke="#8b7660" strokeWidth={0.35} opacity={0.6} />
			<path d="M 12.6 -1.8 Q 14.5 -2.9 16.4 -1.8" fill="none" stroke="#8b7660" strokeWidth={0.3} opacity={0.55} />
		</g>
	);
};
// a character inking into the silk: it comes out of a blur and a wobble, with a faint bleed round it that dries away
const InkChar = ({ch, x, y, size, q, k, color = '#22170f'}) => {
	if (q <= 0) return null;
	const e = 1 - q;
	return (
		<g>
			<defs>
				<filter id={`ink${k}`} x="-30%" y="-30%" width="160%" height="160%">
					<feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed={3 + k} result="n" />
					<feDisplacementMap in="SourceGraphic" in2="n" scale={(1.6 + 16 * e * e).toFixed(2)} xChannelSelector="R" yChannelSelector="G" result="d" />
					<feGaussianBlur in="d" stdDeviation={(4 * e * e).toFixed(2)} />
				</filter>
				<filter id={`bleed${k}`} x="-30%" y="-30%" width="160%" height="160%">
					<feGaussianBlur stdDeviation={size / 22} />
				</filter>
			</defs>
			<text x={x} y={y} textAnchor="middle" dominantBaseline="central" fontFamily={KAI} fontSize={size} fill={color} opacity={0.16 * Math.min(1, q * 2) * (0.4 + 0.6 * e)} filter={`url(#bleed${k})`}>
				{ch}
			</text>
			<text x={x} y={y} textAnchor="middle" dominantBaseline="central" fontFamily={KAI} fontSize={size} fill={color} stroke={color} strokeWidth={size / 90} opacity={0.92 * ss(0, 0.6, q)} filter={`url(#ink${k})`}>
				{ch}
			</text>
		</g>
	);
};
const Opening = () => {
	const f = useCurrentFrame();
	const t = f / FPS;
	const [W, H] = [1920, 1080];
	const [hx, hy] = OPEN.hollow;
	const u = ss(OP.push[0], OP.push[1], t);
	const s = 1 + (OPEN.match.scale - 1) * u;
	const tx = (OPEN.match.to[0] - hx) * W * u;
	const ty = (OPEN.match.to[1] - hy) * H * u;
	const words = 1 - ss(OP.push[0] + 0.3, OP.push[0] + 1.4, t); // the title and the seal go as the camera moves in
	const d = antDist(t);
	const a = antAlong(d);
	const gone = ss(OP.antGone - 0.6, OP.antGone, t); // into the dark of the hollow
	const {title, credit, seal} = OPEN;
	const step = title.size * 1.06;
	return (
		<AbsoluteFill style={{background: '#000'}}>
			<AbsoluteFill style={{transform: `translate(${tx.toFixed(2)}px, ${ty.toFixed(2)}px) scale(${s.toFixed(4)})`, transformOrigin: `${hx * 100}% ${hy * 100}%`}}>
				<OffthreadVideo src={staticFile('opening/op-reveal.mp4')} muted style={{width: '100%', height: '100%', objectFit: 'cover'}} />
				<svg width={W} height={H} style={{position: 'absolute', inset: 0, mixBlendMode: 'multiply'}}>
					{t > OP.antIn && gone < 1 ? <Ant x={a.x} y={a.y} angle={a.angle} travel={d / ANT_K} t={t} still={t > OP.antPause[0] && t < OP.antPause[1]} opacity={1 - gone} scale={1 - 0.25 * gone} /> : null}
					<g opacity={words}>
						{[...title.text].map((ch, i) => (
							<InkChar key={`t${i}`} ch={ch} k={i} x={title.x * W} y={title.y * H + (i + 0.5) * step} size={title.size} q={ss(0, 1.1, t - OP.title - 0.42 * i)} />
						))}
						{credit.cols.map(([cx, text], c) =>
							[...text].map((ch, i) => (
								<InkChar key={`c${c}-${i}`} ch={ch} k={10 + c * 20 + i} x={cx * W} y={credit.y * H + (i + 0.5) * credit.size * 1.1} size={credit.size} color="#3a2b1f" q={ss(0, 0.9, t - OP.credit - credit.gap * c)} />
							)),
						)}
					</g>
				</svg>
				<div style={{position: 'absolute', inset: 0, opacity: words, mixBlendMode: 'multiply'}}>
					<SealMark text={seal.text} x={seal.x * W} y={seal.y * H} k={90} font={seal.font} press={f - Math.round(OP.seal * FPS)} tilt={-1.5} shadow="none" />
				</div>
			</AbsoluteFill>
			{/* the painting becomes the tree: S00A's first frame, exactly as the clip will start */}
			<AbsoluteFill style={{opacity: ss(OP.dissolve[0], OP.dissolve[1], t)}}>
				<Img src={staticFile('opening/s00a-first.png')} style={{width: '100%', height: '100%', objectFit: 'cover'}} />
			</AbsoluteFill>
			<AbsoluteFill style={{background: '#000', opacity: 1 - ss(0, 1.2, t)}} />
		</AbsoluteFill>
	);
};

// ---------- the opening, live action ----------
// The second opening (2026-10-17, the director asked for a realistic one in the manner of good Chinese films, with the
// film's title), chosen by src/opening.json. A cold open the way 侯孝贤 opens 《刺客聂隐娘》: two still, quiet shots
// with only their own sound, a lone ant climbing the furrowed bark of the old 槐 in the low sun (OR1), backlit 槐
// leaves in a shaft of dusty light, one yellowed leaflet letting go (OR2); then black, and the title card the way
// 《一代宗师》 and 《卧虎藏龙》 set theirs: the four characters large in brush calligraphy on black (Muse wrote them,
// tools/make_title.py lifts the ink off the paper), a vermilion seal, the English title small beneath, the source;
// one deep note. S00A then comes up out of the black. Times from src/cues.json (openingReal).
// Tightened the same day (director: more compact; 15 s down to 11.5) and given opening credits over the two shots.
// Then (director: put the credits a real film's opening would show, in the right roles; I am dasungta; and English
// throughout) the cast list the way Chinese films open: the presenter and producer first, the heads of department,
// the director last, just before the title, each role with its English beneath. dasungta set the project going and
// had the final say on every cut (出品人 · 制片人); Opus 5.5 wrote and edited it and made the music and the sound; Muse
// made every picture and moving shot (摄影 · 美术). 13.5 s with five cards.
const OPR = cues.openingReal;
const OPEN_REAL = {
	r1: {file: 'opening/or1.mp4', in: 0, gain: 2.1}, // Muse's OR1-v1 (from OR1-a): the ant leaves the top at about 4.5 s; a second one comes in at 6 s
	// gains bring their own sound (-37 dB) up to the level of the other live-action shots' ambient bed (about -30 dB)
	r2: {file: 'opening/or2.mp4', in: 3.2, gain: 2.3}, // OR2-v1 (from OR2-a): the yellowed leaflet falls from about 4.5 s to 7.5 s
	title: {file: 'opening/title.png', width: 0.58, aspect: 2.744, y: 0.44}, // the calligraphy, ink white on transparent (tools/make_title.py)
	seal: {text: '槐安', font: 38},
	english: 'A DREAM UNDER THE SOUTHERN BOUGH',
	source: '据唐·李公佐《南柯太守传》改编',
	sourceEn: 'Based on “The Governor of the Southern Tributary State” by Li Gongzuo, Tang dynasty',
	// [role, the role in English, name], shown at OPR.credits: the role in 楷书, its English small beneath, then the name
	credits: [
		['出品人 · 制片人', 'PRESENTED AND PRODUCED BY', 'dasungta'],
		['编剧 · 剪辑', 'WRITTEN AND EDITED BY', 'Opus 5.5'],
		['摄影 · 美术', 'CINEMATOGRAPHY AND ART DIRECTION', 'Muse'],
		['音乐 · 声音', 'MUSIC AND SOUND', 'Opus 5.5'],
		['导　演', 'DIRECTED BY', 'Opus 5.5'],
	],
};
const RealShot = ({shot, from, to, fadeIn}) => {
	const f = useCurrentFrame(); // frames since this shot came on
	const len = Math.round((to - from) * FPS);
	const op = fadeIn ? interpolate(f, [0, Math.round(fadeIn * FPS)], [0, 1], clamp) : 1;
	return (
		<AbsoluteFill style={{opacity: op}}>
			<OffthreadVideo
				src={staticFile(shot.file)}
				trimBefore={Math.round(shot.in * FPS)}
				volume={(v) => shot.gain * interpolate(v, [0, 18, len - 30, len], [0, 1, 1, 0], clamp)}
				style={{width: '100%', height: '100%', objectFit: 'cover'}}
			/>
		</AbsoluteFill>
	);
};
const OpeningReal = () => {
	const f = useCurrentFrame();
	const t = f / FPS;
	const {r1, r2, title, seal} = OPEN_REAL;
	// black: out of it at the start, back into it after the leaves, and the title card sits on it
	const black = Math.max(1 - ss(0, 1.0, t), ss(OPR.dark[0], OPR.dark[1], t));
	const q = ss(OPR.title, OPR.title + 1.3, t); // the title comes up left to right, out of a soft blur, like ink taking
	const out = 1 - ss(OPR.out[0], OPR.out[1], t);
	const drift = 1.045 - 0.045 * ss(OPR.title, OPR.out[1], t); // a very slow settle while it is up
	const w = title.width * 1920;
	const h = w / title.aspect;
	const below = title.y * 1080 + h / 2; // where the lines under the title start
	return (
		<AbsoluteFill style={{background: '#000'}}>
			<Sequence from={0} durationInFrames={Math.round(OPR.r1[1] * FPS)} name="OR1">
				<RealShot shot={r1} from={OPR.r1[0]} to={OPR.r1[1]} />
			</Sequence>
			<Sequence from={Math.round(OPR.r2[0] * FPS)} durationInFrames={Math.round((OPR.r2[1] - OPR.r2[0]) * FPS)} name="OR2">
				<RealShot shot={r2} from={OPR.r2[0]} to={OPR.r2[1]} fadeIn={OPR.r1[1] - OPR.r2[0]} />
			</Sequence>
			<AbsoluteFill style={{background: '#000', opacity: black}} />
			{/* the credits, low in the frame over the two shots; the director's lingers a moment into the black */}
			{OPEN_REAL.credits.map(([role, roleEn, name], i) => {
				const [a, b] = OPR.credits[i];
				const op = ss(a, a + 0.35, t) * (1 - ss(b - 0.4, b, t));
				if (op <= 0) return null;
				return (
					<div key={i} style={{position: 'absolute', left: 0, right: 0, top: 0.7 * 1080, textAlign: 'center', opacity: op, textShadow: '0 0 14px rgba(0,0,0,0.85), 0 2px 4px rgba(0,0,0,0.9)'}}>
						<div style={{fontFamily: KAI, fontSize: 34, letterSpacing: '0.3em', paddingLeft: '0.3em', color: '#e6dcc6'}}>{role}</div>
						<div style={{marginTop: 4, fontFamily: "'Times New Roman', Georgia, serif", fontSize: 17, letterSpacing: '0.32em', paddingLeft: '0.32em', color: '#cbbfa6'}}>{roleEn}</div>
						<div style={{marginTop: 8, fontFamily: "'Times New Roman', Georgia, serif", fontSize: 46, letterSpacing: '0.2em', paddingLeft: '0.2em', color: '#f1e8d4'}}>{name}</div>
					</div>
				);
			})}
			{t >= OPR.title ? (
				<AbsoluteFill style={{opacity: out, transform: `scale(${drift.toFixed(4)})`}}>
					<Img
						src={staticFile(title.file)}
						style={{
							position: 'absolute',
							left: (1920 - w) / 2,
							top: title.y * 1080 - h / 2,
							width: w,
							height: h,
							filter: `blur(${(5 * (1 - q) ** 2).toFixed(2)}px)`,
							WebkitMaskImage: `linear-gradient(90deg, #000 ${(q * 130 - 30).toFixed(1)}%, transparent ${(q * 130).toFixed(1)}%)`,
							maskImage: `linear-gradient(90deg, #000 ${(q * 130 - 30).toFixed(1)}%, transparent ${(q * 130).toFixed(1)}%)`,
						}}
					/>
					<SealMark text={seal.text} x={960 + w / 2 + 10} y={title.y * 1080 + h * 0.18} k={91} font={seal.font} press={f - Math.round(OPR.seal * FPS)} tilt={-1.5} shadow="none" worn={false} />
					<div style={{position: 'absolute', left: 0, right: 0, top: below + 34, textAlign: 'center', fontFamily: "'Times New Roman', Georgia, serif", fontSize: 24, letterSpacing: '0.42em', paddingLeft: '0.42em', color: '#b9ad95', opacity: ss(OPR.english, OPR.english + 1.0, t)}}>
						{OPEN_REAL.english}
					</div>
					<div style={{position: 'absolute', left: 0, right: 0, top: below + 92, textAlign: 'center', fontFamily: KAI, fontSize: 30, letterSpacing: '0.16em', paddingLeft: '0.16em', color: '#958a76', opacity: ss(OPR.source, OPR.source + 1.0, t)}}>
						{OPEN_REAL.source}
					</div>
					<div style={{position: 'absolute', left: 0, right: 0, top: below + 136, textAlign: 'center', fontFamily: "'Times New Roman', Georgia, serif", fontSize: 21, letterSpacing: '0.06em', color: '#857a67', opacity: ss(OPR.source, OPR.source + 1.0, t)}}>
						{OPEN_REAL.sourceEn}
					</div>
				</AbsoluteFill>
			) : null}
		</AbsoluteFill>
	);
};

export const Film = () => {
	const f = useCurrentFrame();
	// fade up from black at the start, and down into black before the title
	// after the live-action opening's title card the tree comes up out of the black (the painted opening dissolves into it)
	const rise = opening.use === 'real' && f >= at.S00A.from ? interpolate(f, [at.S00A.from, at.S00A.from + 20], [1, 0], clamp) : 0;
	const black = Math.max(interpolate(f, [0, 18], [1, 0], clamp), interpolate(f, [at.S28.from - 18, at.S28.from], [0, 1], clamp), rise);
	return (
		<AbsoluteFill style={{background: '#000'}}>
			{SHOTS.filter((s) => s.file).map((s) => (
				<Sequence key={s.id} from={s.from - s.lead} durationInFrames={s.lead + s.len + s.tail} name={s.id}>
					<Shot s={s} />
				</Sequence>
			))}
			{at.S00 ? (
				<Sequence from={at.S00.from} durationInFrames={at.S00.len} name="S00 opening">
					{opening.use === 'real' ? <OpeningReal /> : <Opening />}
				</Sequence>
			) : null}
			<Seals />
			<Eyelids />
			<AbsoluteFill style={{background: '#000', opacity: black}} />
			<Subtitle />
			<Sequence from={at.S28.from} durationInFrames={at.S28.len} name="S28">
				<Title />
			</Sequence>
			{CARRY.map((c) => (
				<Sequence key={'carry-' + c.from.id} from={c.to.from} durationInFrames={c.frames} name={'carry ' + c.from.id}>
					<Html5Audio src={staticFile(c.from.file)} trimBefore={c.from.start + c.from.len} volume={(f) => c.from.gain * level(c.from.id) * c.lv * interpolate(f, [0, c.frames], [1, 0], clamp) ** 1.5 * bedVolume(c.to.from + f)} />
				</Sequence>
			))}
			<Html5Audio src={staticFile('music.wav')} volume={musicVolume} />
			<Voice />
		</AbsoluteFill>
	);
};
