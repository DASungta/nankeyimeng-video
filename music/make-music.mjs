// Original score for 《南柯一梦》, synthesized from scratch: no samples, so no licensing issues.
// The brief (Claude doc, 音乐与声音): slow (about 60 BPM, often free time), low, with real dynamics, in D 羽调
// (D F G A C), one theme only:
//   片头        a low drone and the theme's first phrase in far harmonics while the old 槐 is painted onto silk, a
//                thump for the seal, a stone chime as an ant goes into the painted hollow (S00, the opening)
//   古琴 guqin   states it at the start, mostly in harmonics, with long silences between the notes
//   笙 / 琵琶    enlarge it into the splendour of the dream; 编钟 dots it; a low 箫 lies underneath;
//                at S10A (taking office in 南柯郡) 堂鼓 and bells join, the fullest point; the hunt (S10C) on drums and
//                hooves; the children's glory (S11A) holds the fullest chord until the war cuts it off
//   堂鼓 埙      the enemy marches out (S12B) and surrounds the city (S12); the drums scatter into hoofbeats (S12A)
//   箫 xiao      alone, one long mourning over a low string bed from the princess's death through the coffin's return
//                to her grave (S13–S14), each phrase fading into the next
//   unease      over the held D, a tremolo where E flat rubs against D, a quickening heartbeat drum, the 笙 on a sour
//                E flat: the guests at his gate and the king's suspicion (S14A), straight into the omen's bell (S15)
//                then low trembling strings, wind and the 埙 (S15), a lonely harmonic behind the barred gate (S15A),
//                the 琵琶's fourth (S16) and a crescendo into the white (S17); a dead stop on waking
//   古琴         returns note by note while the ant kingdom is uncovered; a low bell on the ant king (S22); the 箫
//                once more over the princess's grave (S24); no music in the storm (S25), only thunder and rain
//   古琴 + 箫    after a distant drum (S26A, answering S12) the theme comes back whole; the last harmonic falls on the title
// The theme: a rising fourth and a falling line — the dream lifting and sinking back.
//   TA  A | D C A | G F G        (ends open, on G)
//   TA2 A | D F | D C A          (ends on A)
//   TB  G A G F | D C | D        (the cadence, on D; withheld in the dream after the wedding)
// The guqin, xiao, strings, bells, drums and hall come from the Qingming score's engine (qingming-v6/music);
// the 笙, 埙, hooves, thunder and rain are new here. The engine is copied, not imported, so each film's score stays
// as it was rendered.
// Timed from src/clips.json (shot order and lengths, written by tools/prep_clips.py from edl.json).
// Output: public/music.wav (16-bit stereo, 48 kHz). Run: npm run music
import fs from 'node:fs';

const {shots} = JSON.parse(fs.readFileSync(new URL('../src/clips.json', import.meta.url), 'utf8'));
// lightning in S25, seconds into the shot; src/Film.jsx draws the flashes from the same list
// and the moment in S05 his eyes snap open on the messengers (the shock)
// and the opening's moments (S00: the ink, the title, the seal, the ant going into the hollow, the push)
const {flashes: FLASHES, eyes: EYES, opening: OPN, openingReal: ORL} = JSON.parse(fs.readFileSync(new URL('../src/cues.json', import.meta.url), 'utf8'));
// which opening is in use (src/opening.json): the painted one or the live-action one
const OPENING = JSON.parse(fs.readFileSync(new URL('../src/opening.json', import.meta.url), 'utf8')).use;
// T.S07 = the time S07 starts in the film, in seconds
const T = {};
const after = (id) => shots[shots.findIndex((s) => s.id === id) + 1].id; // the shot that follows id in the edit
let END = 0;
for (const s of shots) {
	T[s.id] = END;
	END += s.dur;
}
// WAR: the first shot of the war, right after the children's glory (S11A)
const WAR = T[after('S11A')];
const SR = 48000;
const N = Math.ceil(END * SR);
const TAU = 2 * Math.PI;

// ======== engine (from qingming-v6/music/make-music.mjs) ========
// ---------- utilities ----------
let seed = 20261014;
const rand = () => {
	seed = (seed + 0x6d2b79f5) | 0;
	let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
	t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
	return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const noise = () => rand() * 2 - 1;
const mtof = (m) => 440 * 2 ** ((m - 69) / 12);
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smooth = (a, b, x) => {
	const t = clamp01((x - a) / (b - a));
	return t * t * (3 - 2 * t);
};
const lpk = (fc) => 1 - Math.exp((-TAU * Math.min(fc, SR / 2.2)) / SR);
const panGains = (pan, g) => [Math.cos(((Math.max(-1, Math.min(1, pan)) + 1) * Math.PI) / 4) * g, Math.sin(((Math.max(-1, Math.min(1, pan)) + 1) * Math.PI) / 4) * g];
const blep = (t, dt) => {
	if (t < dt) {
		t /= dt;
		return t + t - t * t - 1;
	}
	if (t > 1 - dt) {
		t = (t - 1) / dt;
		return t * t + t + t + 1;
	}
	return 0;
};
// keyframes [[t, value], …] → smoothstep between them
const keyed = (keys, t) => {
	if (!keys) return 0;
	if (t <= keys[0][0]) return keys[0][1];
	for (let i = 1; i < keys.length; i++) if (t < keys[i][0]) return keys[i - 1][1] + (keys[i][1] - keys[i - 1][1]) * smooth(keys[i - 1][0], keys[i][0], t);
	return keys[keys.length - 1][1];
};

// RBJ biquad, transposed direct form II; set() may be called while running
class BQ {
	constructor(type, f, q = 0.707, db = 0) {
		this.z1 = 0;
		this.z2 = 0;
		this.set(type, f, q, db);
	}
	set(type, f, q = 0.707, db = 0) {
		const w = (TAU * Math.min(f, SR * 0.45)) / SR;
		const cs = Math.cos(w);
		const sn = Math.sin(w);
		const A = 10 ** (db / 40);
		const al = sn / (2 * q);
		let b0, b1, b2, a0, a1, a2;
		if (type === 'lp') [b0, b1, b2, a0, a1, a2] = [(1 - cs) / 2, 1 - cs, (1 - cs) / 2, 1 + al, -2 * cs, 1 - al];
		else if (type === 'hp') [b0, b1, b2, a0, a1, a2] = [(1 + cs) / 2, -(1 + cs), (1 + cs) / 2, 1 + al, -2 * cs, 1 - al];
		else if (type === 'bp') [b0, b1, b2, a0, a1, a2] = [al, 0, -al, 1 + al, -2 * cs, 1 - al];
		else if (type === 'peak') [b0, b1, b2, a0, a1, a2] = [1 + al * A, -2 * cs, 1 - al * A, 1 + al / A, -2 * cs, 1 - al / A];
		else {
			// 'low' or 'high' shelf, slope 1
			const s = Math.sqrt(A) * sn * Math.SQRT2;
			const g = type === 'low' ? 1 : -1;
			[b0, b1, b2] = [A * (A + 1 - g * (A - 1) * cs + s), 2 * g * A * (A - 1 - g * (A + 1) * cs), A * (A + 1 - g * (A - 1) * cs - s)];
			[a0, a1, a2] = [A + 1 + g * (A - 1) * cs + s, -2 * g * (A - 1 + g * (A + 1) * cs), A + 1 + g * (A - 1) * cs - s];
		}
		this.b0 = b0 / a0;
		this.b1 = b1 / a0;
		this.b2 = b2 / a0;
		this.a1 = a1 / a0;
		this.a2 = a2 / a0;
	}
	run(x) {
		const y = this.b0 * x + this.z1;
		this.z1 = this.b1 * x - this.a1 * y + this.z2;
		this.z2 = this.b2 * x - this.a2 * y;
		return y;
	}
}

// ---------- buses ----------
// each family writes to its own stereo bus (so the mix can be measured per family) plus one mono hall send
const BUS = {};
const bus = (name) => (BUS[name] ??= {L: new Float32Array(N), R: new Float32Array(N)});
const SEND = new Float32Array(N);
const put = (B, i, v, gl, gr, send) => {
	if (i < 0 || i >= N) return;
	B.L[i] += v * gl;
	B.R[i] += v * gr;
	SEND[i] += v * (gl + gr) * 0.5 * send;
};

// ---------- strings ----------
// a sustained chord for a bowed section: per note several detuned saws, each with its own slow drift and delayed
// vibrato; brightness follows the dynamic, so a crescendo opens up the way real strings do. trem = bowed tremolo.
function strings(t0, len, notes, gain, o = {}) {
	const {attack = 1.2, release = 1.6, cutoff = 1300, voices = 4, trem = 0, send = 0.45, dyn = null, spread = 0.7, vib = 1, b = 'str'} = o;
	const B = bus(b);
	const i0 = Math.round(t0 * SR);
	const n1 = Math.round(len * SR);
	const env = new Float32Array(n1);
	for (let n = 0; n < n1; n++) {
		const t = n / SR;
		env[n] = Math.sin((Math.PI / 2) * clamp01(t / attack)) * clamp01((len - t) / release) * (dyn ? dyn(t0 + t) : 1);
	}
	for (const m of notes) {
		const low = m < 45;
		const nv = low ? Math.max(2, voices - 1) : voices;
		const f = mtof(m);
		for (let k = 0; k < nv; k++) {
			const cents = (nv === 1 ? 0 : (k / (nv - 1) - 0.5) * (low ? 7 : 12)) + (rand() - 0.5) * 3;
			const fk = f * 2 ** (cents / 1200);
			const pan = low ? (rand() - 0.5) * 0.3 : spread * (nv === 1 ? 0 : (k / (nv - 1)) * 2 - 1) * (0.55 + 0.45 * rand());
			const [gl, gr] = panGains(pan, (gain / Math.sqrt(nv)) * (low ? 0.8 : 1));
			const dr = 0.08 + rand() * 0.22;
			const dph = rand() * TAU;
			const vr = 4.6 + rand() * 1.3;
			const vph = rand() * TAU;
			const vd = (0.0035 + 0.0022 * rand()) * vib;
			const late = 0.3 + rand() * 0.6;
			const tr = 10 + rand() * 4;
			const tph = rand() * TAU;
			let ph = rand();
			let y1 = 0;
			let y2 = 0;
			let k1 = lpk(cutoff);
			for (let n = 0; n < n1; n++) {
				const t = n / SR;
				const e = env[n];
				if ((n & 31) === 0) k1 = lpk(cutoff * (0.5 + 0.55 * e));
				const dt = (fk * (1 + 0.0018 * Math.sin(TAU * dr * t + dph) + vd * smooth(0, late, t) * Math.sin(TAU * vr * t + vph))) / SR;
				ph += dt;
				if (ph >= 1) ph -= 1;
				y1 += k1 * (2 * ph - 1 - blep(ph, dt) - y1);
				y2 += k1 * (y1 - y2);
				const a = trem ? e * (1 - trem * 0.75 * (0.5 + 0.5 * Math.sin(TAU * tr * t + tph))) : e;
				put(B, i0 + n, y2 * a, gl, gr, send);
			}
		}
	}
}

// ---------- legato lines (xiao, cellos, violins) ----------
// notes: [[midi, beats, {grace, acc}], …] played as one breath / one bow from t0. Returns per-sample pitch (midi),
// amplitude, vibrato depth (0..1) and an onset transient (for the xiao's chiff).
function trace(t0, notes, {beat = 1, glide = 0.09, attack = 0.14, release = 0.35} = {}) {
	const segs = [];
	let t = t0;
	for (const [m, bt, o = {}] of notes) {
		segs.push({m, s: t, e: t + bt * beat, o});
		t += bt * beat;
	}
	const n1 = Math.round((t - t0) * SR);
	const P = new Float32Array(n1);
	const A = new Float32Array(n1);
	const V = new Float32Array(n1);
	const O = new Float32Array(n1);
	let j = 0;
	for (let n = 0; n < n1; n++) {
		const tt = t0 + n / SR;
		while (j < segs.length - 1 && tt >= segs[j + 1].s) j++;
		const g = segs[j];
		const d = tt - g.s;
		const len = g.e - g.s;
		let p = j > 0 && d < glide ? segs[j - 1].m + (g.m - segs[j - 1].m) * smooth(0, glide, d) : g.m;
		if (g.o.grace && d < 0.12) p = g.m + g.o.grace * (1 - smooth(0.05, 0.12, d));
		let a = j === 0 ? Math.sin((Math.PI / 2) * clamp01(d / attack)) : 1 - 0.16 * Math.exp(-d / 0.06);
		if (len > 1.2) a *= 0.86 + 0.14 * Math.sin(Math.PI * clamp01(d / len));
		a *= g.o.acc ?? 1;
		if (j === segs.length - 1) a *= clamp01((g.e - tt) / Math.min(release, len * 0.6));
		P[n] = p;
		A[n] = a;
		V[n] = smooth(0.22, 0.7, d) * (len > 0.7 ? 1 : 0.3);
		O[n] = Math.exp(-d / 0.05) * (j === 0 ? 1 : 0.3);
	}
	let s = 0;
	const k = lpk(35);
	for (let n = 0; n < n1; n++) {
		s += k * (A[n] - s);
		A[n] = s;
	}
	return {i0: Math.round(t0 * SR), n1, P, A, V, O};
}

// 洞箫: a nearly pure tone with a little 2nd and 3rd harmonic, breath noise band-passed around the 2nd harmonic
// (strongest at the onset), a slow pitch drift and vibrato that grows into long notes
function xiao(t0, notes, gain, {beat = 1, pan = 0.08, send = 0.55, vib = 0.1, breath = 0.1, dyn = null, b = 'lead'} = {}) {
	const tr = trace(t0, notes, {beat, glide: 0.08, attack: 0.16, release: 0.4});
	const B = bus(b);
	const [gl, gr] = panGains(pan, gain);
	const bp = new BQ('bp', 1000, 1.3);
	const air = new BQ('hp', 4500, 0.7);
	const lp = new BQ('lp', 5200, 0.7);
	const vr = 4.9 + rand() * 0.5;
	let ph = 0;
	for (let n = 0; n < tr.n1; n++) {
		const t = n / SR;
		const p = tr.P[n] + vib * tr.V[n] * Math.sin(TAU * vr * t) + 0.04 * Math.sin(TAU * 0.37 * t);
		const f = 440 * 2 ** ((p - 69) / 12);
		if ((n & 31) === 0) bp.set('bp', Math.min(f * 2.1, 9000), 1.3);
		ph += f / SR;
		if (ph >= 1) ph -= 1;
		const tone = Math.sin(TAU * ph) + 0.16 * Math.sin(2 * TAU * ph) + 0.05 * Math.sin(3 * TAU * ph) + 0.015 * Math.sin(4 * TAU * ph);
		const nz = noise();
		const br = bp.run(nz) * (breath + 0.35 * tr.O[n]) * 6 + air.run(nz) * 0.02;
		const a = tr.A[n] * (dyn ? dyn(t0 + t) : 1) * (1 + 0.025 * Math.sin(TAU * 3.1 * t));
		put(B, tr.i0 + n, lp.run((tone * 0.8 + br) * a), gl, gr, send);
	}
}

// a bowed line for a string section (cellos, basses, violins): detuned saws following one legato pitch trace
function bow(t0, notes, gain, {beat = 1, voices = 3, cutoff = 1400, pan = -0.25, spread = 0.35, send = 0.45, vib = 0.13, dyn = null, b = 'str', attack = 0.35} = {}) {
	const tr = trace(t0, notes, {beat, glide: 0.12, attack, release: 0.6});
	const B = bus(b);
	for (let k = 0; k < voices; k++) {
		const det = (voices === 1 ? 0 : (k / (voices - 1) - 0.5) * 0.12) + (rand() - 0.5) * 0.03;
		const [gl, gr] = panGains(pan + spread * (voices === 1 ? 0 : (k / (voices - 1)) * 2 - 1), gain / Math.sqrt(voices));
		const vr = 4.8 + rand();
		const vph = rand() * TAU;
		let ph = rand();
		let y1 = 0;
		let y2 = 0;
		let k1 = lpk(cutoff);
		for (let n = 0; n < tr.n1; n++) {
			const t = n / SR;
			const a = tr.A[n] * (dyn ? dyn(t0 + t) : 1);
			const dt = (440 * 2 ** ((tr.P[n] + det + vib * tr.V[n] * Math.sin(TAU * vr * t + vph) - 69) / 12)) / SR;
			if ((n & 31) === 0) k1 = lpk(cutoff * (0.5 + 0.6 * a));
			ph += dt;
			if (ph >= 1) ph -= 1;
			y1 += k1 * (2 * ph - 1 - blep(ph, dt) - y1);
			y2 += k1 * (y1 - y2);
			put(B, tr.i0 + n, y2 * a, gl, gr, send);
		}
	}
}

// ---------- plucked strings ----------
// Karplus–Strong with a fractional, time-varying delay: the string keeps sounding while the pitch moves, which is
// the guqin's 走手音 (slides 上 / 下 after the pluck, the waver 吟 and the wider 猱).
// path: [[t, semitones], …] relative to midi; vib: [[from, to, rate Hz, depth semitones], …].
// eq 'qin' = long wooden box (low-mid bloom, dark top); 'zheng' = brighter, for ostinatos and runs.
function ks(t0, midi, gain, o = {}) {
	const {pan = -0.12, path = null, vib = null, bright = 0.5, pos = 0.13, S = 0.45, send = 0.42, b = 'pluck', eq = 'qin', squeak = 0.1} = o;
	const f0 = mtof(midi);
	const t60 = o.t60 ?? Math.min(9, Math.max(2.2, 6.5 * Math.sqrt(130 / f0)));
	const len = o.len ?? Math.min(10, t60 * 0.9);
	const pitch = (t) => {
		let p = keyed(path, t);
		if (vib) for (const [a, z, rate, depth] of vib) if (t > a && t < z) p += depth * Math.sin(TAU * rate * (t - a)) * smooth(a, a + 0.3, t) * (1 - smooth(z - 0.4, z, t));
		return p;
	};
	let lowest = 0;
	if (path) for (const [, v] of path) lowest = Math.min(lowest, v);
	if (vib) for (const v of vib) lowest -= Math.abs(v[3]);
	const maxD = SR / mtof(midi + lowest - 0.5) + 4;
	let size = 64;
	while (size < maxD + 4) size <<= 1;
	const mask = size - 1;
	const buf = new Float32Array(size);
	// excitation: one period of low-passed noise, combed for the plucking point, DC removed
	const P0 = SR / f0;
	const exN = Math.max(2, Math.round(P0));
	const raw = new Float32Array(exN);
	let lp = 0;
	let mean = 0;
	for (let i = 0; i < exN; i++) {
		lp += bright * (noise() - lp);
		raw[i] = lp;
		mean += lp / exN;
	}
	const pd = Math.max(1, Math.round(pos * P0));
	const ex = new Float32Array(exN);
	for (let i = 0; i < exN; i++) ex[i] = raw[i] - mean - (i >= pd ? raw[i - pd] - mean : 0);
	const g = 0.001 ** (1 / (f0 * t60));
	const B = bus(b);
	const [gl, gr] = panGains(pan, gain);
	const filt = eq === 'qin' ? [new BQ('peak', 150, 0.8, 5), new BQ('peak', 2500, 0.9, -4), new BQ('lp', 4000, 0.6)] : [new BQ('hp', 90, 0.7), new BQ('peak', 1800, 1, 2), new BQ('lp', 7500, 0.7)];
	const sq = new BQ('bp', 2600, 1.2);
	const i0 = Math.round(t0 * SR);
	const n1 = Math.round(len * SR);
	let w = 0;
	let p = pitch(0);
	let D = SR / (f0 * 2 ** (p / 12)) - S;
	let slide = 0;
	for (let n = 0; n < n1; n++) {
		const t = n / SR;
		if ((n & 15) === 0) {
			const q = pitch(t);
			slide = (Math.abs(q - p) * SR) / 16;
			p = q;
			D = SR / (f0 * 2 ** (p / 12)) - S;
		}
		const r = w - D;
		const i1 = Math.floor(r);
		const fr = r - i1;
		const a0 = buf[i1 & mask];
		const a1 = buf[(i1 + 1) & mask];
		const am = buf[(i1 - 1) & mask];
		let y = g * ((1 - S) * (a0 + (a1 - a0) * fr) + S * (am + (a0 - am) * fr));
		if (n < exN) y += ex[n];
		buf[w & mask] = y;
		w++;
		let v = y;
		for (const fq of filt) v = fq.run(v);
		if (path && squeak) v += sq.run(noise()) * Math.min(1, slide / 6) * squeak;
		put(B, i0 + n, v * Math.min(1, (len - t) / 0.08), gl, gr, send);
	}
}
// 筝 / 琵琶: the same string, brighter, shorter, plucked nearer the end
const zheng = (t0, midi, gain, o = {}) => ks(t0, midi, gain, {eq: 'zheng', bright: 0.7, pos: 0.18, S: 0.5, t60: 2.2, send: 0.35, pan: 0.2, ...o});
// 泛音: a guqin harmonic — the string touched at a node, almost a sine, glassy and long
function harm(t0, midi, gain, {pan = -0.12, send = 0.6, len = 4.5, b = 'pluck'} = {}) {
	const f = mtof(midi);
	const B = bus(b);
	const [gl, gr] = panGains(pan, gain);
	const parts = [[1, 1, 2.6], [2, 0.1, 1.2], [3, 0.04, 0.6]];
	const ph = parts.map(() => rand());
	const i0 = Math.round(t0 * SR);
	const n1 = Math.round(len * SR);
	for (let n = 0; n < n1; n++) {
		const t = n / SR;
		let v = 0;
		for (let k = 0; k < parts.length; k++) v += parts[k][1] * Math.sin(TAU * (f * parts[k][0] * t + ph[k])) * Math.exp(-t / parts[k][2]);
		v = v * Math.min(1, t / 0.002, (len - t) / 0.1) + noise() * 0.06 * Math.exp(-t / 0.004);
		put(B, i0 + n, v, gl, gr, send);
	}
}
// a quick run over the strings (an up or down sweep): notes spread evenly over `dur`
const run = (t0, dur, notes, gain, o = {}) => notes.forEach((m, i) => zheng(t0 + (i * dur) / notes.length, m, gain * (o.taper ? 1 - (0.5 * i) / notes.length : 1), {pan: -0.5 + i / notes.length, t60: 1.6, ...o}));
// 轮指 tremolo: one pitch re-plucked fast, with a dynamic
const tremolo = (t0, dur, midi, gain, dyn = () => 1, o = {}) => {
	for (let t = 0; t < dur; t += 0.07) zheng(t0 + t, midi, gain * dyn(t / dur) * (0.8 + 0.2 * rand()), {t60: 0.9, len: 0.5, ...o});
};

// ---------- bells ----------
// partials [ratio, amp, decay s], each split into two slightly detuned components so it beats like real bronze
function bell(t0, f, gain, parts, {pan = 0, send = 0.5, len = 6, beat = 0.0012, strike = 0.2, strikeLp = 2500, thud = 0, attack = 0.003, b = 'bell'} = {}) {
	const B = bus(b);
	const [gl, gr] = panGains(pan, gain);
	const comps = [];
	for (const [r, a, d] of parts) {
		const db = beat * (0.5 + rand());
		comps.push([f * r * (1 + db), a * 0.5, d, rand()], [f * r * (1 - db), a * 0.5, d * 0.92, rand()]);
	}
	const i0 = Math.round(t0 * SR);
	const n1 = Math.round(len * SR);
	const k = lpk(strikeLp);
	let lp = 0;
	for (let n = 0; n < n1; n++) {
		const t = n / SR;
		let v = 0;
		for (const [fr, a, d, ph] of comps) v += a * Math.sin(TAU * (fr * t + ph)) * Math.exp(-t / d);
		lp += k * (noise() - lp);
		v = v * Math.min(1, t / attack) + lp * strike * Math.exp(-t / 0.03);
		if (thud) v += thud * Math.sin(TAU * 58 * t) * Math.exp(-t / 0.12) * Math.min(1, t / 0.004);
		put(B, i0 + n, v * Math.min(1, (len - t) / 0.3), gl, gr, send);
	}
}
// 梵钟: a big temple bell struck with a swinging log — soft attack, a low hum, slow beating
const zhong = (t0, midi, gain, o = {}) => bell(t0, mtof(midi), gain, [[0.5, 0.6, 12], [1, 1, 8.5], [1.19, 0.42, 5.5], [1.5, 0.3, 4.2], [2, 0.45, 3.6], [2.52, 0.22, 2.4], [3.01, 0.16, 1.7], [4.07, 0.1, 1.1], [5.2, 0.06, 0.7]], {len: 10, beat: 0.0016, strike: 0.25, strikeLp: 900, thud: 0.25, attack: 0.006, send: 0.6, ...o});
// 编钟: bronze chime bell
const bianzhong = (t0, midi, gain, o = {}) => bell(t0, mtof(midi), gain, [[1, 1, 3.2], [2.42, 0.32, 1.5], [2.98, 0.42, 1.2], [4.1, 0.18, 0.7], [5.4, 0.1, 0.45]], {len: 4.5, beat: 0.0008, strike: 0.3, strikeLp: 4000, ...o});
// 磬: stone chime — brighter, glassier, shorter
const qing = (t0, midi, gain, o = {}) => bell(t0, mtof(midi), gain, [[1, 1, 2.2], [2.76, 0.55, 1.1], [5.4, 0.28, 0.5], [8.93, 0.12, 0.25]], {len: 3.5, beat: 0.0004, strike: 0.4, strikeLp: 6000, ...o});
// a camel's neck bell: a dull, low clank
const camelBell = (t0, midi, gain, o = {}) => bell(t0, mtof(midi), gain, [[1, 1, 1.3], [2.3, 0.5, 0.6], [3.6, 0.35, 0.35], [5.1, 0.2, 0.2]], {len: 2, beat: 0.002, strike: 0.5, strikeLp: 3000, send: 0.3, b: 'amb', ...o});
// small harness bells on the donkeys
const jingle = (t0, len, gain, {period = 0.47, midi = 88, pan = 0.4} = {}) => {
	for (let t = t0; t < t0 + len - 0.3; t += period * (0.85 + rand() * 0.3)) {
		const e = Math.min(1, (t - t0) / 1.2, (t0 + len - t) / 1.2);
		bell(t, mtof(midi + (rand() < 0.5 ? 0 : 3)), gain * e * (0.6 + 0.4 * rand()), [[1, 1, 0.35], [2.7, 0.4, 0.18], [5.2, 0.2, 0.1]], {len: 0.8, beat: 0.003, strike: 0.3, strikeLp: 8000, send: 0.3, b: 'amb', pan: pan + (rand() - 0.5) * 0.3});
	}
};

// ---------- percussion ----------
// 堂鼓: membrane modes with a falling pitch, the skin's slap and a click
function gu(t0, gain, {f = 60, decay = 0.8, pan = 0, send = 0.35, skin = 0.5, b = 'perc'} = {}) {
	const B = bus(b);
	const [gl, gr] = panGains(pan, gain);
	const modes = [[1, 1, 1], [1.5, 0.32, 0.5], [1.98, 0.2, 0.33], [2.44, 0.12, 0.22], [2.9, 0.07, 0.15]];
	const len = Math.min(4.5, decay * 5);
	const i0 = Math.round(t0 * SR);
	const n1 = Math.round(len * SR);
	const ph = modes.map(() => 0);
	const k1 = lpk(1100);
	let lp = 0;
	for (let n = 0; n < n1; n++) {
		const t = n / SR;
		const bend = 1 + 0.4 * Math.exp(-t / 0.025);
		let v = 0;
		for (let m = 0; m < modes.length; m++) {
			ph[m] += (f * modes[m][0] * bend) / SR;
			v += modes[m][1] * Math.sin(TAU * ph[m]) * Math.exp(-t / (decay * modes[m][2]));
		}
		const nz = noise();
		lp += k1 * (nz - lp);
		v = v * Math.min(1, t / 0.0015) + skin * (lp * 2.2 * Math.exp(-t / 0.04) + (nz - lp) * 0.25 * Math.exp(-t / 0.004));
		put(B, i0 + n, v * Math.min(1, (len - t) / 0.05), gl, gr, send);
	}
}
const xiaogu = (t0, gain, o = {}) => gu(t0, gain, {f: 210, decay: 0.09, skin: 0.9, send: 0.25, pan: 0.15, ...o}); // a small, dry drum (板鼓-like)
// 木鱼 / woodblock
function muyu(t0, gain, {f = 820, pan = 0.25, send = 0.25, b = 'perc'} = {}) {
	const B = bus(b);
	const [gl, gr] = panGains(pan, gain);
	const i0 = Math.round(t0 * SR);
	const n1 = Math.round(0.2 * SR);
	for (let n = 0; n < n1; n++) {
		const t = n / SR;
		put(B, i0 + n, Math.sin(TAU * f * t) * Math.exp(-t / 0.035) + 0.4 * Math.sin(TAU * 2.71 * f * t) * Math.exp(-t / 0.012) + noise() * 0.3 * Math.exp(-t / 0.002), gl, gr, send);
	}
}
// 醒木: the storyteller's clapper slapped on the table
function xingmu(t0, gain, {pan = -0.1, send = 0.4} = {}) {
	const B = bus('perc');
	const [gl, gr] = panGains(pan, gain);
	const bp = new BQ('bp', 2200, 0.7);
	const i0 = Math.round(t0 * SR);
	const n1 = Math.round(0.3 * SR);
	for (let n = 0; n < n1; n++) {
		const t = n / SR;
		put(B, i0 + n, bp.run(noise()) * 3 * Math.exp(-t / 0.01) + Math.sin(TAU * 210 * t) * Math.exp(-t / 0.03) + 0.5 * Math.sin(TAU * 520 * t) * Math.exp(-t / 0.02), gl, gr, send);
	}
}
// 钹: cymbal crash — high noise plus a cloud of inharmonic partials
function bo(t0, gain, {decay = 1.2, pan = 0, send = 0.5} = {}) {
	const B = bus('perc');
	const [gl, gr] = panGains(pan, gain);
	const hp = new BQ('hp', 3000, 0.7);
	const parts = Array.from({length: 14}, () => [3000 + rand() * 5500, rand()]);
	const i0 = Math.round(t0 * SR);
	const n1 = Math.round(Math.min(4, decay * 3.5) * SR);
	for (let n = 0; n < n1; n++) {
		const t = n / SR;
		let v = hp.run(noise()) * Math.exp(-t / decay);
		for (const [f, ph] of parts) v += 0.03 * Math.sin(TAU * (f * t + ph)) * Math.exp(-t / (decay * 0.7));
		put(B, i0 + n, v * Math.min(1, t / 0.001, (n1 - n) / (0.1 * SR)), gl, gr, send);
	}
}
// a soft cymbal roll swelling into a downbeat
function swell(t0, len, gain, {pan = 0, send = 0.5} = {}) {
	const B = bus('perc');
	const [gl, gr] = panGains(pan, gain);
	const hp = new BQ('hp', 2500, 0.7);
	const lp = new BQ('lp', 9000, 0.7);
	const i0 = Math.round(t0 * SR);
	const n1 = Math.round(len * SR);
	for (let n = 0; n < n1; n++) {
		const t = n / SR;
		put(B, i0 + n, lp.run(hp.run(noise())) * (t / len) ** 2.2 * Math.min(1, (len - t) / 0.04), gl, gr, send);
	}
}
// 小锣: the opera small gong, whose pitch rises after the strike
function xiaoluo(t0, gain, {f = 880, pan = 0.3, send = 0.35} = {}) {
	const B = bus('perc');
	const [gl, gr] = panGains(pan, gain);
	const parts = [[1, 1, 0.7], [1.49, 0.45, 0.5], [2.12, 0.28, 0.35], [2.9, 0.15, 0.25]];
	const ph = parts.map(() => 0);
	const i0 = Math.round(t0 * SR);
	const n1 = Math.round(1.6 * SR);
	for (let n = 0; n < n1; n++) {
		const t = n / SR;
		const rise = 1 + 0.09 * smooth(0, 0.28, t);
		let v = 0;
		for (let k = 0; k < parts.length; k++) {
			ph[k] += (f * parts[k][0] * rise) / SR;
			v += parts[k][1] * Math.sin(TAU * ph[k]) * Math.exp(-t / parts[k][2]);
		}
		put(B, i0 + n, v * Math.min(1, t / 0.001, (1.6 - t) / 0.1) + noise() * 0.3 * Math.exp(-t / 0.005), gl, gr, send);
	}
}

// ---------- ambience ----------
// white noise → one-pole high/low pass (either may be a function of t) → envelope
function noiseBed(t0, len, gain, {hp = 60, lp = 800, pan = 0, send = 0.2, env = () => 1, b = 'amb'} = {}) {
	const B = bus(b);
	const [gl, gr] = panGains(pan, gain);
	const i0 = Math.round(t0 * SR);
	const n1 = Math.round(len * SR);
	let lo = 0;
	let y = 0;
	for (let n = 0; n < n1; n++) {
		const t = n / SR;
		const x = noise();
		lo += lpk(typeof hp === 'number' ? hp : hp(t)) * (x - lo);
		y += lpk(typeof lp === 'number' ? lp : lp(t)) * (x - lo - y);
		put(B, i0 + n, y * env(t) * Math.min(1, t / 0.05, (len - t) / 0.05), gl, gr, send);
	}
}
const wind = (t0, len, gain) => {
	for (const [pan, rate, base] of [[-0.6, 0.09, 380], [0.6, 0.07, 520]]) noiseBed(t0, len, gain, {pan, hp: 60, lp: (t) => base + 260 * Math.sin(TAU * rate * t + pan), env: (t) => Math.min(1, t / 2.5, (len - t) / 2.5) * (0.65 + 0.35 * Math.sin(TAU * rate * 1.7 * t + 1))});
};
const water = (t0, len, gain) => {
	for (const [pan, rate] of [[-0.5, 0.31], [0.5, 0.43]]) noiseBed(t0, len, gain, {pan, hp: 90, lp: (t) => 520 + 220 * Math.sin(TAU * rate * t), env: (t) => Math.min(1, t / 1.5, (len - t) / 1.5) * (0.55 + 0.45 * Math.sin(TAU * rate * 1.9 * t + pan) ** 2)});
	// small laps against the hulls and the bank
	for (let t = t0 + 0.5; t < t0 + len - 0.5; t += 0.35 + rand() * 0.9) noiseBed(t, 0.12, gain * (0.6 + rand()), {hp: 250, lp: 700 + rand() * 500, pan: rand() * 1.4 - 0.7, send: 0.25, env: (x) => Math.sin((Math.PI * x) / 0.12) ** 2 * Math.min(1, (t - t0) / 1.5, (t0 + len - t) / 1.5)});
};
const birds = (t0, len, gain) => {
	for (let t = t0 + 0.4; t < t0 + len - 0.5; t += 0.8 + rand() * 2.2) {
		const f = 2600 + rand() * 2200;
		const n = 1 + Math.floor(rand() * 3);
		const pan = rand() * 1.6 - 0.8;
		const B = bus('amb');
		for (let k = 0; k < n; k++) {
			const [gl, gr] = panGains(pan, gain * (0.5 + rand() * 0.5) * Math.min(1, (t - t0) / 1.5, (t0 + len - t) / 1.5));
			const i0 = Math.round((t + k * 0.11) * SR);
			let ph = 0;
			for (let m = 0; m < 0.07 * SR; m++) {
				const x = m / SR;
				ph += (f * (1 + 2.8 * x) * (1 + 0.04 * Math.sin(x * 400))) / SR;
				put(B, i0 + m, Math.sin(TAU * ph) * Math.sin((Math.PI * x) / 0.07) ** 2, gl, gr, 0.35);
			}
		}
	}
};


// ---------- instruments new for this film ----------
// 笙: a free-reed mouth organ. Each pipe is a reed tone with many harmonics and a nasal formant; the harmonics thin
// out when it plays softly. The player's breath gives a slight, slow swell. P and A are per-sample pitch (midi)
// and amplitude, as trace() returns them.
const REED = [1, 0.72, 0.55, 0.38, 0.3, 0.2, 0.15, 0.1, 0.07, 0.05];
function reed(i0, n1, P, A, gain, {pan = 0, send = 0.45, cents = 0, b = 'sheng'} = {}) {
	const B = bus(b);
	const [gl, gr] = panGains(pan, gain);
	const hp = new BQ('hp', 110, 0.7);
	const form = new BQ('peak', 1250, 1.1, 5);
	const lp = new BQ('lp', 5800, 0.7);
	const fr = 0.35 + rand() * 0.3;
	const fph = rand() * TAU;
	let ph = rand();
	for (let n = 0; n < n1; n++) {
		const a = A[n];
		const f = mtof(P[n] + cents / 100);
		ph += f / SR;
		if (ph >= 1) ph -= 1;
		if (a < 1e-5) {
			hp.run(0);
			put(B, i0 + n, lp.run(form.run(0)), gl, gr, send);
			continue;
		}
		const br = 0.3 + 0.7 * Math.min(1, a);
		let v = 0;
		for (let k = 1; k <= REED.length && k * f < SR * 0.45; k++) v += REED[k - 1] * (k > 2 ? br : 1) * Math.sin(TAU * k * ph);
		v *= a * (1 + 0.04 * Math.sin(TAU * fr * (n / SR) + fph));
		put(B, i0 + n, lp.run(form.run(hp.run(v))) * 0.35, gl, gr, send);
	}
}
// the 笙's 和音: each melody note is doubled a fourth or fifth below, whichever stays in the mode (D F G A C)
const MODE = new Set([0, 2, 5, 7, 9]);
const below = (m) => (MODE.has((m - 5 + 120) % 12) ? m - 5 : MODE.has((m - 7 + 120) % 12) ? m - 7 : m - 12);
function sheng(t0, notes, gain, {beat = 1, pan = 0.15, send = 0.45, dyn = null, octave = false} = {}) {
	const lines = [notes, notes.map(([m, bt, o]) => [below(m), bt, o])];
	if (octave) lines.push(notes.map(([m, bt, o]) => [m - 12, bt, o]));
	lines.forEach((ln, k) => {
		const tr = trace(t0, ln, {beat, glide: 0.05, attack: 0.1, release: 0.4});
		if (dyn) for (let n = 0; n < tr.n1; n++) tr.A[n] *= dyn(t0 + n / SR);
		reed(tr.i0, tr.n1, tr.P, tr.A, gain * (k ? 0.62 : 1), {pan: pan + (k - 0.5) * 0.3, send, cents: (k - 1) * 2.5});
	});
}
// a held 笙 chord (several pipes at once), with its own swell
function shengChord(t0, len, notes, gain, {attack = 1.2, release = 1.2, dyn = null, pan = 0.1, send = 0.5} = {}) {
	const n1 = Math.round(len * SR);
	const A = new Float32Array(n1);
	for (let n = 0; n < n1; n++) {
		const t = n / SR;
		A[n] = Math.sin((Math.PI / 2) * clamp01(t / attack)) * clamp01((len - t) / release) * (dyn ? dyn(t0 + t) : 1);
	}
	notes.forEach((m, k) => {
		const P = new Float32Array(n1).fill(m);
		reed(Math.round(t0 * SR), n1, P, A, gain / Math.sqrt(notes.length), {pan: pan + (k / Math.max(1, notes.length - 1) - 0.5) * 0.6, send, cents: (rand() - 0.5) * 6});
	});
}
// 琵琶: a bright pluck; notes longer than about a second are played as 轮指 tremolo that swells and dies
function pipa(t0, notes, gain, {beat = 1, pan = 0.25, trem = 0.9} = {}) {
	let t = t0;
	for (const [m, bt] of notes) {
		const d = bt * beat;
		if (d >= trem) tremolo(t, d - 0.08, m, gain * 0.75, (x) => 0.55 + 0.45 * Math.sin(Math.PI * Math.min(1, x * 1.3)), {pan, eq: 'zheng', bright: 0.75});
		else zheng(t, m, gain, {pan, bright: 0.75, t60: 1.8});
		t += d;
	}
}
// 埙: the clay vessel flute — darker and more breathy than the 箫, almost no vibrato
const xun = (t0, notes, gain, o = {}) => xiao(t0, notes, gain, {vib: 0.035, breath: 0.22, pan: -0.2, send: 0.6, ...o});
// hooves on packed earth: a short, low, woody thump
const hoof = (t0, gain, pan) => gu(t0, gain, {f: 120 + rand() * 30, decay: 0.05, skin: 0.95, send: 0.2, pan, b: 'amb'});
// a horse at the gallop, passing from one side to the other; its three-beat stride repeats every `stride` s
function gallop(t0, len, gain, {stride = 0.4, from = -0.7, to = 0.7, env = (x) => Math.sin(Math.PI * x)} = {}) {
	for (let t = 0; t < len; t += stride * (0.95 + 0.1 * rand())) {
		const x = t / len;
		const pan = from + (to - from) * x;
		[0, 0.085, 0.18].forEach((d, k) => hoof(t0 + t + d, gain * env(x) * [0.7, 0.8, 1][k] * (0.8 + 0.3 * rand()), pan));
	}
}
// thunder: a crack (bright noise burst with a few aftershocks) and a long low rumble in uneven rolls
function thunder(t0, gain, {len = 6, crack = 0.6, pan = 0, send = 0.35} = {}) {
	const B = bus('amb');
	const [gl, gr] = panGains(pan, gain);
	const i0 = Math.round(t0 * SR);
	const n1 = Math.round(len * SR);
	const rolls = Array.from({length: 5}, (_, k) => [0.05 + k * (0.35 + rand() * 0.5), 0.5 + rand() * 0.6, 0.6 + rand() * 0.5]);
	const shots2 = [0, 0.06 + rand() * 0.05, 0.19 + rand() * 0.08];
	const k1 = lpk(140);
	const k2 = lpk(70);
	const hp = new BQ('hp', 900, 0.7);
	let l1 = 0;
	let l2 = 0;
	for (let n = 0; n < n1; n++) {
		const t = n / SR;
		const x = noise();
		l1 += k1 * (x - l1);
		l2 += k2 * (l1 - l2);
		let env = 0;
		for (const [at, amp, dec] of rolls) if (t > at) env += amp * Math.min(1, (t - at) / 0.12) * Math.exp(-(t - at) / dec);
		let v = l2 * 9 * env * Math.exp(-t / (len * 0.45));
		let c = 0;
		for (const s of shots2) if (t > s) c += Math.exp(-(t - s) / 0.05);
		v += hp.run(x) * crack * c;
		put(B, i0 + n, v * Math.min(1, (len - t) / 0.4), gl, gr, send);
	}
}
// rain: a wide hiss with a softer low body, swelling with the gusts
const rain = (t0, len, gain) => {
	for (const [pan, rate] of [[-0.6, 0.23], [0.6, 0.31]]) {
		noiseBed(t0, len, gain, {pan, hp: 1100, lp: 7200, send: 0.15, env: (t) => Math.min(1, t / 0.6, (len - t) / 1.5) * (0.75 + 0.25 * Math.sin(TAU * rate * t + pan))});
		noiseBed(t0, len, gain * 0.5, {pan: pan * 0.5, hp: 180, lp: 900, send: 0.1, env: (t) => Math.min(1, t / 0.6, (len - t) / 1.5)});
	}
};

// =====================================================================================================
// SCORE
// =====================================================================================================
// the theme, in beats ([midi, beats, {grace: semitones above}])
const TA = [[69, 2], [74, 1, {grace: 3}], [72, 0.5], [69, 0.5], [67, 2], [65, 1], [67, 1]];
const TA2 = [[69, 2], [74, 1], [77, 1, {grace: 2}], [74, 1.5], [72, 0.5], [69, 2]];
const TB = [[67, 1], [69, 0.5], [67, 0.5], [65, 1], [62, 1], [60, 1], [62, 3]];
const down = (ph, k = 12) => ph.map(([m, b, o]) => [m - k, b, o]);
// relative levels (the mix is normalized at the end)
const PAD = 0.03;
const XIAO = 0.13;
const QIN = 0.42;
const PIPA = 0.22;
const HARM = 0.09;
const GU = 0.2;
const SHENG = 0.05;

// ---- 片头 · S00 (added 2026-10-17): bare silk; the old 槐 soaks in as ink; an ant walks into the painted hollow; the
// title and the seal; the camera pushes into the hollow and the painting becomes the real tree. A low D–A drone
// breathes in with the ink; the theme's first phrase (A | D C A) in far harmonics while the tree and the title appear;
// a soft thump as the seal is pressed; the stone chime that will mark the cart going into the hollow (S06) marks the
// ant going in; the drone swells a little as the camera goes in, and hands over to the open D under the real tree ----
if (OPENING === 'silk') {
	strings(T.S00 + 0.3, T.S00A - T.S00 + 1.2, [38, 45], PAD * 0.7, {attack: 3.0, release: 2.2, cutoff: 420, dyn: (t) => (0.55 + 0.45 * smooth(T.S00 + OPN.push[0], T.S00 + OPN.push[1], t)) * (1 - smooth(T.S00A - 0.6, T.S00A + 1.0, t))});
	[[OPN.reveal[0] + 0.5, 69, 0.55], [OPN.reveal[0] + 1.8, 74, 0.6], [OPN.title + 0.5, 72, 0.5], [OPN.title + 1.3, 69, 0.45]].forEach(([d, m, g]) => harm(T.S00 + d, m, HARM * g, {len: 5}));
	gu(T.S00 + OPN.seal, GU * 0.18, {f: 95, decay: 0.18, skin: 0.85, send: 0.3});
	qing(T.S00 + OPN.antGone - 0.15, 74, 0.07, {pan: -0.2, send: 0.75});
}
// ---- 片头（写实）· S00, the live-action opening (added 2026-10-17): only the two shots' own sound (wind in the leaves,
// autumn insects) until the black; on the title card one deep note, the big bell and the guqin's lowest open D
// together, and a far harmonic as the seal comes down; then the open D under the real tree (S00A) ----
if (OPENING === 'real') {
	zhong(T.S00 + ORL.title + 0.1, 38, 0.12, {send: 0.75});
	ks(T.S00 + ORL.title + 0.1, 38, QIN * 0.5, {t60: 9});
	harm(T.S00 + ORL.seal + 0.2, 69, HARM * 0.5, {len: 6});
}

// ---- 古槐与蚁穴 · S00A–S00B: before the theme, the open low D under the old tree, two far harmonics; over the ants,
// small high harmonics stepping down and back, quiet and a little odd (the ant kingdom, unnoticed) ----
ks(T.S00A + 0.5, 50, QIN * 0.55, {vib: [[0.8, 3.6, 3.2, 0.12]], t60: 8});
harm(T.S00A + 2.7, 74, HARM * 0.6, {len: 5});
harm(T.S00A + 4.4, 69, HARM * 0.55, {len: 5});
[[0.5, 81, 0.4], [1.0, 79, 0.35], [1.5, 81, 0.4], [2.3, 77, 0.35], [2.8, 79, 0.3]].forEach(([d, m, g]) => harm(T.S00B + d, m, HARM * g, {len: 2.5}));
// ---- 醉卧槐下 · S01–S05: the guqin alone, the theme's first statement, very soft ----
ks(T.S01 + 0.4, 50, QIN * 0.4, {vib: [[0.8, 3.2, 3.2, 0.12]]});
// TA in harmonics, with long silences
harm(T.S01 + 1.9, 69, HARM * 0.8);
harm(T.S01 + 3.3, 74, HARM * 0.8);
harm(T.S01 + 4.4, 72, HARM * 0.6);
harm(T.S02 + 0.0, 69, HARM * 0.6);
harm(T.S02 + 1.3, 67, HARM * 0.7);
harm(T.S02 + 3.2, 65, HARM * 0.6);
harm(T.S03 + 0.4, 67, HARM * 0.75, {len: 5});
// TB an octave below, in stopped notes, the left hand sliding
ks(T.S03 + 2.4, 55, QIN * 0.5);
ks(T.S03 + 3.6, 57, QIN * 0.45, {path: [[0.45, 0], [0.75, -2]]}); // 下: A slides down to G
ks(T.S04 + 1.1, 53, QIN * 0.5);
ks(T.S04 + 2.3, 50, QIN * 0.5);
ks(T.S04 + 3.3, 48, QIN * 0.45, {path: [[0.3, 0], [0.6, 2]]}); // 上: C slides up to D
// ---- S05 · the summons, seen through his eyes ----
// he dozes off as the cadence lands on D. In the dark a voice calls him, and the theme's rising fourth answers, high
// and far, in harmonics; a low unease gathers while his eyes open, heavy; the sight of the two messengers is a shock
// (a struck stone chime, the big drum, a cluster with a semitone in it); then only a thin, uneasy tremolo under
// their invitation, and the lowest string, which becomes the hum of the way in (S06)
ks(T.S05 + 0.2, 50, QIN * 0.45, {vib: [[0.5, 3.6, 3.0, 0.14]], t60: 7});
harm(T.S05 + 0.9, 81, HARM * 0.5, {len: 4.5});
harm(T.S05 + 1.9, 86, HARM * 0.45, {len: 5});
const opens = T.S05 + EYES.open;
const shock = T.S05 + EYES.snap;
strings(T.S05 + 1.0, shock - T.S05 - 0.9, [38, 45], PAD * 1.1, {attack: 2.2, release: 0.15, cutoff: 320, dyn: (t) => smooth(T.S05 + 1, shock, t)});
strings(opens, shock - opens + 0.05, [69, 74], PAD * 0.55, {attack: 1.2, release: 0.08, cutoff: 1800, trem: 0.7, dyn: (t) => smooth(opens, shock, t) ** 1.5});
swell(opens + 0.3, shock - opens - 0.28, 0.035);
qing(shock, 81, 0.09, {pan: 0.1, send: 0.6}); // a start, not a battle: kept well under the war drums (S12)
gu(shock, GU * 0.42, {f: 50, decay: 1.0, skin: 0.5});
strings(shock, 1.6, [50, 57, 62, 63], PAD * 1.4, {attack: 0.02, release: 1.3, cutoff: 2600, voices: 3});
strings(shock + 0.5, T.S06 - shock - 0.9, [74, 75], PAD * 0.35, {attack: 0.8, release: 1.0, cutoff: 2000, trem: 0.8});
ks(T.S06 - 1.0, 38, QIN * 0.6, {t60: 9, len: 6});

// ---- 入梦 · S06: the cart crosses the courtyard to the old tree and drives into the hole at its roots (reshot
// 2026-10-16, so that the tree is plainly the one in the courtyard): the low hum, the theme's rising fourth once, far off,
// as they near the tree; a stone chime as the cart goes into the hollow; silence in the dark ----
const black = T.S06 + 8.5; // S06 is fully black from here (measured: mean level under 1 from 8.5 s)
strings(T.S06 - 0.6, black - T.S06 + 0.5, [38, 50], PAD * 1.4, {attack: 2.4, release: 1.4, cutoff: 420, dyn: (t) => 0.45 + 0.55 * smooth(T.S06, T.S06 + 6, t)});
harm(T.S06 + 1.6, 69, HARM * 0.45, {len: 4});
harm(T.S06 + 2.8, 74, HARM * 0.5, {len: 5});
strings(T.S06 + 3.5, black - T.S06 - 3.6, [57, 62], PAD * 0.6, {attack: 1.6, release: 1.2, cutoff: 700});
qing(T.S06 + 5.6, 74, 0.11, {pan: -0.15, send: 0.7}); // the cart passes into the hollow (5–6.5 s)

// ---- 梦中盛景 · S07–S11: the theme on 笙 and 琵琶, 编钟, a low 箫 underneath; S10A–S11 the fullest ----
// S07: the 笙 opens as the ink spreads; the 琵琶 takes up TA
shengChord(T.S07 + 0.2, 7.6, [50, 57, 62, 69], SHENG * 1.1, {attack: 2.2, release: 1.6, dyn: (t) => 0.5 + 0.5 * smooth(T.S07, T.S07 + 3, t)});
bianzhong(T.S07 + 1.5, 74, 0.1, {pan: 0.3});
const B1 = 0.8; // the dream's beat (75 per minute, still slow, with eighths inside it)
pipa(T.S07 + 1.3, TA, PIPA, {beat: B1});
xiao(T.S07 + 0.8, [[62, 6], [60, 3], [62, 6]], XIAO * 0.45, {beat: B1, vib: 0.05, breath: 0.14, pan: -0.25, send: 0.6});
// S08 the city gate: the bells mark the cut; the 笙 takes up TA2 with the 琵琶 under it
bianzhong(T.S08 + 0.05, 62, 0.11, {pan: -0.2});
bianzhong(T.S08 + 0.06, 74, 0.08, {pan: 0.25});
shengChord(T.S08 + 2.0, 6.5, [53, 60, 65], SHENG * 0.7, {attack: 1.6, release: 1.4});
sheng(T.S08 + 3.0, TA2, SHENG, {beat: B1});
pipa(T.S08 + 3.0, [[57, 2], [62, 2], [65, 1.5], [60, 0.5], [57, 2]], PIPA * 0.6, {beat: B1, pan: -0.3});
// S09 the audience before the king: a stately row of bells under the end of TA2
[[0.05, 62, 0.11], [1.3, 69, 0.09], [2.6, 74, 0.08], [3.9, 72, 0.07]].forEach(([d, m, g]) => bianzhong(T.S09 + d, m, g, {pan: (m - 68) / 20}));
strings(T.S09, 6, [38, 50, 57], PAD * 0.9, {attack: 1.5, release: 1.4, cutoff: 650});
// S10 the wedding: TB, the cadence — the only time the dream resolves
sheng(T.S10 - 0.2, TB, SHENG * 1.05, {beat: B1});
pipa(T.S10 - 0.2, down(TB), PIPA * 0.55, {beat: B1, pan: -0.3});
bianzhong(T.S10 + 0.05, 65, 0.09, {pan: 0.2});
strings(T.S10, 6.5, [41, 53, 57, 60], PAD * 0.9, {attack: 1.4, release: 1.2, cutoff: 900});
const drum = (t, g = 1, o = {}) => gu(t, GU * 0.5 * g, {f: 62, decay: 0.75, ...o}); // under the 笙, not over it
// S10B old friends at the wedding feast: chimes and a bright little figure on the 琵琶 as the cadence dies away
bianzhong(T.S10B + 0.05, 69, 0.09, {pan: -0.2});
bianzhong(T.S10B + 0.55, 74, 0.08, {pan: 0.25});
pipa(T.S10B + 1.3, [[74, 0.5], [72, 0.5], [69, 0.5], [72, 0.5], [74, 1.5], [77, 1]], PIPA * 0.6, {beat: 0.5, pan: 0.25});
strings(T.S10B, T.S10C - T.S10B + 1.0, [41, 53, 57, 62], PAD * 0.8, {attack: 1.2, release: 1.0, cutoff: 1000});
// S10C the hunt at 灵龟山: drums at a canter, bells, hooves, the 笙 in short swells, a 琵琶 run over the hunters
[[0, 1], [0.5, 0.55], [0.75, 0.6], [1, 0.9], [1.5, 0.55], [1.75, 0.6], [2, 0.9], [2.5, 0.55], [2.75, 0.6], [3, 0.95], [3.5, 0.6], [3.75, 0.65], [4, 0.9]].forEach(([d, g]) => drum(T.S10C + d, g, {f: 70, decay: 0.45}));
jingle(T.S10C + 0.1, T.S10A - T.S10C, 0.03, {period: 0.38, midi: 93, pan: -0.3});
gallop(T.S10C + 0.2, T.S10A - T.S10C - 0.2, 0.11, {stride: 0.38, from: -0.6, to: 0.6});
[0.2, 1.2, 2.2, 3.2].forEach((d, k) => shengChord(T.S10C + d, 0.85, [50, 57, 62, 69], SHENG * (0.8 + 0.1 * k), {attack: 0.15, release: 0.5}));
run(T.S10C + 0.4, 0.7, [62, 65, 67, 69, 72, 74, 77], PIPA * 0.5, {taper: true});
run(T.S10C + 2.4, 0.7, [62, 65, 67, 69, 72, 74, 77], PIPA * 0.5, {taper: true});
// the hunt runs on to the end of its shot and hands straight over to the welcome at 南柯郡 (S10A): it used to stop
// a second early and leave a hole (2026-10-17)
[[4.5, 0.6], [4.75, 0.65]].forEach(([d, g]) => drum(T.S10C + d, g, {f: 70, decay: 0.45}));
shengChord(T.S10C + 4.1, T.S10A - T.S10C - 3.9, [50, 57, 62, 69], SHENG * 0.9, {attack: 0.6, release: 0.4});
strings(T.S10C, T.S10A - T.S10C + 1.2, [50, 57, 62], PAD * 0.8, {attack: 1.0, release: 1.2, cutoff: 1100});
// S10A taking office: 堂鼓 and bells join on the held D, then TA2 in full
[[0, 1], [1, 0.7], [1.5, 0.55], [2, 0.9], [3, 0.7], [3.5, 0.55], [4, 0.95], [4.5, 0.6]].forEach(([d, g]) => drum(T.S10A + d, g));
jingle(T.S10A + 0.1, 9.5, 0.035, {period: 0.5, midi: 91, pan: 0.3});
bianzhong(T.S10A + 0.04, 62, 0.12, {pan: -0.25});
bianzhong(T.S10A + 0.05, 69, 0.1, {pan: 0.25});
const full = (t) => 0.75 + 0.25 * smooth(T.S10A, T.S10A + 2, t);
sheng(T.S10A + 0.9, TA2, SHENG * 1.25, {beat: B1, octave: true, dyn: full});
pipa(T.S10A + 0.9, TA2, PIPA * 0.85, {beat: B1, pan: -0.2});
strings(T.S10A, WAR - T.S10A + 0.3, [38, 50, 57, 62, 65], PAD * 1.2, {attack: 1.2, release: 1.0, cutoff: 1100, dyn: (t) => 0.7 + 0.3 * smooth(T.S10A, T.S11, t)});
// S11 twenty years in office: the fullest; the theme rises to its high F and is held, unresolved, until war cuts it off
[[0, 0.8], [2, 0.6], [4, 0.7]].forEach(([d, g]) => drum(T.S11 + d, g));
shengChord(T.S11 + 1.2, WAR - T.S11 - 1.1, [50, 57, 62, 69, 74], SHENG * 1.25, {attack: 1.0, release: 0.15, dyn: (t) => 0.8 + 0.2 * smooth(T.S11 + 1, WAR - 0.5, t)});
pipa(T.S11 + 1.2, [[77, 1.5], [74, 0.5], [72, 1], [74, 2]], PIPA * 0.8, {beat: B1, pan: 0.3});
[[0.4, 74, 0.09], [2.4, 69, 0.08], [4.0, 81, 0.06]].forEach(([d, m, g]) => bianzhong(T.S11 + d, m, g, {pan: (m - 72) / 20}));
// S11A the children ennobled, 一时之盛: the held chord goes on; a ring of bells and the 琵琶 trembling on its high D
[[0, 0.85], [2, 0.7], [3.5, 0.75]].forEach(([d, g]) => drum(T.S11A + d, g));
[[0.1, 86, 0.06], [0.5, 81, 0.07], [0.9, 77, 0.07], [1.3, 74, 0.08], [2.6, 69, 0.08]].forEach(([d, m, g]) => bianzhong(T.S11A + d, m, g, {pan: (m - 78) / 16}));
tremolo(T.S11A + 1.0, WAR - T.S11A - 1.2, 74, PIPA * 0.55, (x) => 0.5 + 0.5 * Math.sin(Math.PI * Math.min(1, x * 1.2)), {pan: 0.3, eq: 'zheng', bright: 0.75});

// ---- 兵败与丧 · S12B–S14A: war drums and 埙; the drums scatter into hooves; the 箫 alone ----
// S12B: the 檀萝 army comes out of the valley (added 2026-10-17, producer: show the enemy) — a march on the big drum,
// low and steady, getting louder; the low tremolo comes in under it and the 埙 starts TA, darkened
for (let d = 0.15, k = 0; d < T.S12 - WAR; d += 0.75, k++) gu(WAR + d, GU * 0.62 * (0.45 + 0.4 * Math.min(1, d / (T.S12 - WAR))) * (k % 2 ? 0.7 : 1), {f: 54, decay: 0.7, skin: 0.5});
strings(WAR, T.S13 - WAR + 0.3, [38, 45, 50], PAD * 1.5, {attack: 0.8, release: 0.8, cutoff: 900, trem: 0.6, dyn: (t) => (0.45 + 0.55 * smooth(WAR, T.S12 + 1, t)) * (1 - 0.65 * smooth(T.S12A, T.S13, t))});
xun(WAR + 1.2, down(TA), XIAO * 1.1, {beat: 0.55});
// S12: they surround the city — the heavy drums
const war = [[0, 1.3], [1, 1], [1.33, 0.7], [2, 1.15], [3, 1], [3.33, 0.75], [3.66, 0.8], [4, 1.2], [4.5, 0.9]];
war.forEach(([d, g]) => gu(T.S12 + d, GU * 0.62 * g, {f: 52, decay: 0.9, skin: 0.6}));
// S12A: the drums thin out and fall away; only the galloping horse is left
[[0, 1], [0.9, 0.55], [2.1, 0.3]].forEach(([d, g]) => gu(T.S12A + d, GU * 0.62 * g, {f: 50, decay: 1.0, send: 0.4 + d * 0.2}));
gallop(T.S12A + 0.15, 3.0, 0.16, {from: -0.6, to: 0.5, env: (x) => Math.min(1, x * 4) * (1 - 0.7 * x)});
// ---- 丧 · S13–S14: one long mourning, not three cues (producer, 2026-10-17: the music died with the princess's shot
// and left a hole) ----
// a low string bed rises under her death, carries the coffin home and the burial, and thins out only over the grave
strings(T.S13 + 0.2, T.S14A - T.S13 + 2.5, [50, 57, 62], PAD * 0.95, {attack: 2.5, release: 3.0, cutoff: 620, dyn: (t) => smooth(T.S13, T.S13 + 3.5, t) * (1 - 0.55 * smooth(T.S14 + 1, T.S14A + 1.5, t))});
strings(T.S13 + 1.5, T.S15 - T.S13, [38, 50], PAD * 0.55, {attack: 2.5, release: 2, cutoff: 380});
// S13: the drums gone; the 箫 alone plays TA, slower, its last note held and fading out through the dissolve into S13A
const xiaoFade = (a, b) => (t) => 1 - 0.92 * smooth(a, b, t);
const TAlast = [[69, 2], [74, 1, {grace: 3}], [72, 0.5], [69, 0.5], [67, 2], [65, 1], [67, 3.2]];
xiao(T.S13 + 0.4, TAlast, XIAO * 0.7, {beat: 0.82, vib: 0.12, breath: 0.12, dyn: xiaoFade(T.S13 + 6.0, T.S13 + 8.9)});
ks(T.S13 + 0.5, 38, QIN * 0.35, {t60: 9, len: 7}); // the lowest string under it, left to ring
// S13A: he brings the coffin back to the capital — a low bell as the hearse nears the gate; as the court bows, the 箫
// again, low and falling, and it fades into the burial (S14)
zhong(T.S13A + 0.6, 38, 0.1, {send: 0.7});
xiao(T.S13A + 2.7, [[69, 1.5], [67, 0.5], [65, 1], [62, 3.2]], XIAO * 0.52, {beat: 0.85, vib: 0.1, breath: 0.13, dyn: xiaoFade(T.S13A + 5.6, T.S13A + 8.0)});
// S14: the funeral on 盘龙冈 — the cadence, its last D held long and dying away into S14A, where it stays as the pedal
xiao(T.S14 + 1.4, [[65, 1], [62, 1], [60, 1], [62, 5.5, {grace: 3}]], XIAO * 0.62, {beat: 0.8, vib: 0.12, breath: 0.12, dyn: xiaoFade(T.S14 + 4.6, T.S14 + 8.6)});
harm(T.S14 + 4.6, 74, HARM * 0.45, {len: 6});
// ---- 疑 · S14A: guests crowd his gate, the king watches — something is about to turn (producer, 2026-10-17: the
// music has to carry a quiet unease here). Over the held D: a thin tremolo where E flat rubs against D, creeping up
// in loudness; a slow heartbeat on the drum that quickens and grows; the 笙 alone rising to the sour E flat; one low
// bell on E flat as the narration says the king grew suspicious. It runs straight into the omen's bell (S15). ----
const susp = (t) => smooth(T.S14A + 0.8, T.S15 + 0.2, t);
strings(T.S14A + 0.2, T.S15 - T.S14A + 2.8, [74, 75], PAD * 0.55, {attack: 1.8, release: 2.4, cutoff: 1900, trem: 0.9, dyn: (t) => (0.35 + 0.65 * susp(t) ** 1.4) * (1 - 0.85 * smooth(T.S15 + 0.3, T.S15 + 2.6, t))});
strings(T.S14A - 0.4, T.S15 - T.S14A + 0.9, [38, 45], PAD * 1.0, {attack: 1.6, release: 0.5, cutoff: 360, dyn: (t) => 0.6 + 0.4 * susp(t)});
sheng(T.S14A + 1.8, [[69, 1.5], [74, 1], [77, 1.5], [75, 2.6]], SHENG * 0.7, {beat: 0.75, pan: 0.2});
for (let t = T.S14A + 2.0, gap = 1.25; t < T.S15 - 0.1; gap = Math.max(0.62, gap * 0.9), t += gap) gu(t, GU * (0.22 + 0.3 * susp(t)), {f: 47, decay: 1.1, skin: 0.3});
bianzhong(T.S14A + 4.2, 51, 0.05, {pan: -0.25, send: 0.8});

// ---- 失势与遣归 · S15–S17: a low pedal and a bell; fragments; then a crescendo into the white ----
zhong(T.S15 + 0.15, 38, 0.15);
// S15, the omen (7 s since 2026-10-17): after the bell the unease of S14A thins away, low strings tremble, wind rises
// with the darkening sky, and the 埙 plays the theme darkened, an octave down; it ends on the gate's bar (S15A)
strings(T.S15 + 0.1, T.S15A - T.S15 + 1.0, [38, 45, 50], PAD * 1.1, {attack: 0.8, release: 1.2, cutoff: 700, trem: 0.7, dyn: (t) => 0.8 - 0.3 * smooth(T.S15 + 3, T.S15A + 0.5, t)});
swell(T.S15 + 0.6, T.S15A - T.S15 - 0.4, 0.03, {pan: -0.2});
xun(T.S15 + 1.4, down(TA), XIAO * 0.95, {beat: 0.62});
// WAKE: the first shot out of the dream (the cup, S20); UNCOVER: the first shot after his eyes open (S21)
const WAKE = T[after('S17')];
const UNCOVER = T[after('S18A')];
strings(T.S15, WAKE - T.S15 + 0.2, [26, 38], PAD * 1.5, {attack: 2, release: 0.1, cutoff: 300, dyn: (t) => 0.55 + 0.45 * smooth(T.S17, WAKE, t)});
// S15A confined to his house: the gate's bar drops, a dull wooden thud, then only the low pedal
gu(T.S15A + 0.35, GU * 0.45, {f: 75, decay: 0.22, skin: 0.95});
qing(T.S15A + 1.4, 62, 0.04, {pan: -0.2, send: 0.85});
// alone behind the gate: two far harmonics, the theme's falling step
harm(T.S15A + 3.0, 69, HARM * 0.4, {len: 5});
harm(T.S15A + 4.5, 67, HARM * 0.35, {len: 5});
// S16 "卿本人间，家非在此": the theme's rising fourth on the 琵琶, which falls back and stops
zheng(T.S16 + 0.6, 69, PIPA * 0.7, {pan: 0.2, t60: 2.4});
zheng(T.S16 + 1.5, 74, PIPA * 0.65, {pan: 0.2, t60: 2.6, path: [[0.6, 0], [1.1, -2]]});
zheng(T.S16 + 3.0, 69, PIPA * 0.45, {pan: 0.2, t60: 2.0});
bianzhong(T.S16 + 3.2, 50, 0.05, {pan: -0.3, send: 0.8});
// S17: everything swells into the white and is cut off on the cut to S18
const cres = (t) => smooth(T.S17 - 0.5, WAKE - 0.05, t) ** 1.6;
strings(T.S17 - 0.5, WAKE - T.S17 + 0.6, [38, 45, 50, 57, 62, 69], PAD * 2.6, {attack: 0.6, release: 0.1, cutoff: 2400, trem: 0.5, dyn: (t) => 0.15 + 0.85 * cres(t)});
shengChord(T.S17, WAKE - T.S17 + 0.1, [62, 69, 74, 79, 81, 86], SHENG * 1.6, {attack: 0.5, release: 0.05, dyn: (t) => 0.05 + 0.95 * cres(t)});
swell(T.S17 + 1.0, WAKE - T.S17 - 0.95, 0.07);
// (the gap has a floor: the shrinking gaps add up to only about 3.1 s, and with the voice-over S17 runs longer than that)
for (let t = T.S17 + 1.6, gap = 0.5; t < WAKE - 0.08; gap = Math.max(0.1, gap * 0.84), t += gap) gu(t, GU * 0.55 * (0.3 + 0.7 * cres(t)), {f: 55, decay: 0.5});

// ---- 惊醒 · S20 S18 S18A: nothing (the master is muted, see gate below): the cup and the friends' laughter, his sleeping
// face, the call, his eyes snapping open ----

// ---- 揭穿 · S21–S24: the guqin returns, one note at a time ----
ks(UNCOVER + 0.5, 50, QIN * 0.5, {vib: [[0.6, 2.6, 3.0, 0.12]]});
ks(UNCOVER + 2.2, 57, QIN * 0.45, {vib: [[0.5, 2.4, 3.4, 0.16]]}); // 吟 on A
harm(UNCOVER + 3.6, 74, HARM * 0.55);
// S22: the ant king uncovered — one low bell
zhong(T.S22 + 0.6, 38, 0.13, {send: 0.7});
harm(T.S22 + 3.6, 69, HARM * 0.5, {len: 5});
ks(T.S23 + 0.6, 62, QIN * 0.4);
harm(T.S23 + 2.4, 74, HARM * 0.5);
// S24: the princess's grave — the 箫 once more, the cadence, very soft
xiao(T.S24 + 0.25, [[67, 1], [69, 0.5], [67, 0.5], [65, 1], [62, 1], [60, 1], [62, 5]], XIAO * 0.6, {beat: 0.56, vib: 0.1, breath: 0.13, dyn: (t) => 1 - 0.9 * smooth(T.S24 + 3.4, T.S25 + 0.3, t)}); // its last D fades into the rain (2026-10-17)

// ---- 风雨 · S25: no music — thunder and rain; each thunder follows its flash (FLASHES, from src/cues.json) ----
rain(T.S25 - 0.15, T.S26 - T.S25 + 1.4, 0.05);
wind(T.S25 - 0.2, T.S26 - T.S25 + 1.2, 0.04);
thunder(T.S25 + FLASHES[0] + 0.35, 0.5, {len: 4, crack: 0.5, pan: -0.2});
thunder(T.S25 + FLASHES[1] + 0.7, 0.42, {len: 5.5, crack: 0.25, pan: 0.25});

// ---- 尾声 · S26–S28: a dawn harmonic; a distant drum (檀萝, answering S12); the theme whole on guqin and 箫 ----
harm(T.S26 + 1.4, 74, HARM * 0.45, {len: 5});
gu(T.S26A + 0.5, GU * 0.55, {f: 52, decay: 1.1, send: 0.95, skin: 0.25, pan: 0.35});
const B2 = 0.68;
// TA on the guqin, each note plucked, the long ones with a slide or a waver
const qinLine = (t0, ph, g, beat) => {
	let t = t0;
	for (const [m, bt, o = {}] of ph) {
		const d = bt * beat;
		ks(t, m - 12, g, d > 1 ? {vib: [[0.3, d, 3.2, 0.12]]} : o.grace ? {path: [[0, o.grace], [0.12, 0]]} : {});
		t += d;
	}
	return t;
};
const tB = qinLine(T.S26A + 1.3, TA, QIN * 0.5, B2);
// TB on the 箫, slowing to the end, the guqin doubling it an octave below; its last D arrives with the title
const TBrit = [[67, 1], [69, 0.5], [67, 0.5], [65, 1.1], [62, 1.2], [60, 1.4], [62, 3.4]];
xiao(tB, TBrit, XIAO * 0.75, {beat: B2, vib: 0.11, breath: 0.11});
qinLine(tB, TBrit, QIN * 0.32, B2);
// the last harmonic falls on the title
harm(T.S28 + 1.3, 74, HARM * 0.7, {len: 4});
strings(tB - 1, END - tB + 1, [38, 50], PAD * 0.5, {attack: 2.5, release: 2.5, cutoff: 360});

// the master's gate: total silence in the black before the dream (S06→S07), and a dead stop on waking (from the cup, S20, until his eyes are open)
const GATES = [[black + 0.15, black + 0.75, T.S07 + 0.05, T.S07 + 0.3], [WAKE - 0.005, WAKE + 0.02, UNCOVER - 0.1, UNCOVER]];
const gate = (t) => {
	for (const [a, b, c, d] of GATES) if (t > a && t < d) return t < b ? 1 - smooth(a, b, t) : t < c ? 0 : smooth(c, d, t);
	return 1;
};

// =====================================================================================================
// MIX
// =====================================================================================================
// family balance; the hall is a 16-line feedback delay network (Householder matrix, per-line damping, slow
// delay modulation) behind four diffusing all-passes: about 3 s at low and mid frequencies, darker in the highs
const MIX = {str: 1.0, lead: 1.0, pluck: 1.0, perc: 1.0, bell: 1.0, amb: 1.0};
const WET = 0.65;
function hall(input, {rt60 = 3.0, damp = 5200, pre = 0.028} = {}) {
	// 16 lines, 31–101 ms, mutually prime; every line slowly modulated (±12 samples, under 1.5 cents of wobble) so the modes never settle
	// into a metallic ring
	const lens = [1499, 1601, 1709, 1811, 1931, 2053, 2213, 2357, 2477, 2647, 2797, 3061, 3329, 3593, 3877, 4861];
	const K = lens.length;
	const g = lens.map((d) => 10 ** ((-3 * d) / (SR * rt60)));
	const size = lens.map((d) => d + 24);
	const lines = size.map((d) => new Float32Array(d));
	const w = new Int32Array(K);
	const st = new Float64Array(K);
	const kd = lpk(damp);
	const mod = lens.map(() => [0.07 + 0.4 * rand(), rand() * TAU]);
	const aps = [449, 347, 233, 131].map((d) => ({b: new Float32Array(d), i: 0}));
	const hp = new BQ('hp', 120, 0.7);
	const outL = new Float32Array(N);
	const outR = new Float32Array(N);
	const preN = Math.round(pre * SR);
	const d = new Float64Array(K);
	const sgnL = lens.map((_, k) => (k % 2 ? -1 : 1));
	const sgnR = lens.map((_, k) => ((k >> 1) % 2 ? -1 : 1));
	for (let n = 0; n < N; n++) {
		let x = hp.run(n >= preN ? input[n - preN] : 0);
		for (const a of aps) {
			const v = a.b[a.i];
			const y = v - 0.6 * x;
			a.b[a.i] = x + 0.6 * y;
			if (++a.i >= a.b.length) a.i = 0;
			x = y;
		}
		let sum = 0;
		for (let k = 0; k < K; k++) {
			let delay = lens[k];
			delay += 12 * Math.sin(TAU * mod[k][0] * (n / SR) + mod[k][1]);
			let r = w[k] - delay;
			while (r < 0) r += size[k];
			const i0 = Math.floor(r);
			const fr = r - i0;
			const a0 = lines[k][i0 % size[k]];
			const v = a0 + (lines[k][(i0 + 1) % size[k]] - a0) * fr;
			st[k] += kd * (v - st[k]);
			d[k] = st[k] * g[k];
			sum += d[k];
		}
		const h = (2 * sum) / K;
		let l = 0;
		let rr = 0;
		for (let k = 0; k < K; k++) {
			lines[k][w[k]] = d[k] - h + x * (k % 2 ? 0.25 : -0.25);
			if (++w[k] >= size[k]) w[k] = 0;
			l += d[k] * sgnL[k];
			rr += d[k] * sgnR[k];
		}
		outL[n] = l * 0.7;
		outR[n] = rr * 0.7;
	}
	return [outL, outR];
}
// sections for the report (and the per-family levels, measured before the families are summed)
const SECTIONS = [['opening', 0, T.S00A], ['drunk', T.S00A, T.S06], ['into', T.S06, T.S07], ['dream', T.S07, T.S10A], ['office', T.S10A, WAR], ['war', WAR, T.S13], ['mourning', T.S13, T.S15], ['fall', T.S15, T.S17], ['white', T.S17, WAKE], ['waking', WAKE, UNCOVER], ['uncover', UNCOVER, T.S25], ['storm', T.S25, T.S26], ['coda', T.S26, END]];
const rms = (A, B, a, b) => {
	let s = 0;
	for (let n = a; n < b; n++) s += A[n] ** 2 + B[n] ** 2;
	return Math.sqrt(s / (2 * Math.max(1, b - a)));
};
const EQ = {str: () => [new BQ('peak', 280, 0.9, 1.5), new BQ('peak', 2800, 0.8, -3.5), new BQ('lp', 7000, 0.7)]};
for (const [k, make] of Object.entries(EQ)) {
	if (!BUS[k]) continue;
	for (const ch of ['L', 'R']) {
		const fs = make();
		const a = BUS[k][ch];
		for (let n = 0; n < N; n++) {
			let v = a[n];
			for (const f of fs) v = f.run(v);
			a[n] = v;
		}
	}
}
const FAMILIES = Object.keys(BUS);
const famLevels = SECTIONS.map(([, a, b]) => FAMILIES.map((k) => rms(BUS[k].L, BUS[k].R, Math.round(a * SR), Math.round(b * SR)) * (MIX[k] ?? 1)));
const L = new Float32Array(N);
const R = new Float32Array(N);
for (const k of FAMILIES) {
	const gain = MIX[k] ?? 1;
	for (let n = 0; n < N; n++) {
		L[n] += BUS[k].L[n] * gain;
		R[n] += BUS[k].R[n] * gain;
	}
	delete BUS[k];
}
const dryRms = rms(L, R, 0, N);
let wetRms;
{
	const [wl, wr] = hall(SEND);
	wetRms = rms(wl, wr, 0, N) * WET;
	for (let n = 0; n < N; n++) {
		L[n] += wl[n] * WET;
		R[n] += wr[n] * WET;
	}
}
// 40 Hz high-pass, fade in/out, the gate, normalize to about −19 dBFS RMS, then a look-ahead peak limiter at −1 dBFS
{
	const hl = new BQ('hp', 40, 0.7);
	const hr = new BQ('hp', 40, 0.7);
	let sum = 0;
	for (let n = 0; n < N; n++) {
		const t = n / SR;
		const f = Math.min(1, t / 0.01) * (t > END - 0.8 ? Math.max(0, (END - t) / 0.8) : 1) * gate(t);
		L[n] = hl.run(L[n]) * f;
		R[n] = hr.run(R[n]) * f;
		sum += L[n] ** 2 + R[n] ** 2;
	}
	const scale = 0.112 / Math.sqrt(sum / (2 * N));
	const ceil = 0.89;
	const look = Math.round(0.005 * SR);
	const need = new Float32Array(N);
	for (let n = 0; n < N; n++) {
		L[n] *= scale;
		R[n] *= scale;
		need[n] = Math.min(1, ceil / Math.max(1e-9, Math.abs(L[n]), Math.abs(R[n])));
	}
	// minimum over the look-ahead window (twice its length), then a box average, then a slow release
	const minW = new Float32Array(N);
	const dq = [];
	const W = 2 * look;
	for (let n = N - 1; n >= 0; n--) {
		while (dq.length && need[dq[dq.length - 1]] >= need[n]) dq.pop();
		dq.push(n);
		while (dq[0] > n + W) dq.shift();
		minW[n] = need[dq[0]];
	}
	let acc = 0;
	let g = 1;
	const rel = 1 - Math.exp(-1 / (0.15 * SR));
	for (let n = 0; n < N; n++) {
		acc += minW[n] - (n >= look ? minW[n - look] : 0);
		const box = (acc + (n < look ? look - n - 1 : 0)) / look;
		g = box < g ? box : g + (box - g) * rel;
		L[n] = Math.tanh((L[n] * g) / 0.98) * 0.98;
		R[n] = Math.tanh((R[n] * g) / 0.98) * 0.98;
	}
}

// ---------- report ----------
const db = (x) => (20 * Math.log10(Math.max(x, 1e-9))).toFixed(1).padStart(6);
let peakAll = 0;
let sumAll = 0;
for (let n = 0; n < N; n++) {
	peakAll = Math.max(peakAll, Math.abs(L[n]), Math.abs(R[n]));
	sumAll += L[n] ** 2 + R[n] ** 2;
}
const rmsAll = Math.sqrt(sumAll / (2 * N));
if (!Number.isFinite(rmsAll) || peakAll >= 1 || rmsAll < 0.05 || rmsAll > 0.25) throw new Error(`bad mix: rms ${rmsAll} peak ${peakAll}`);
console.log(`hall: wet ${db(wetRms / dryRms)} dB against the dry mix`);
console.log(`section              master rms   peak  | families, dB re the loudest family-section: ${FAMILIES.map((k) => k.padStart(6)).join('')}`);
const famTop = Math.max(...famLevels.flat());
SECTIONS.forEach(([name, a, b], s) => {
	const i = Math.round(a * SR);
	const j = Math.round(b * SR);
	let p = 0;
	for (let n = i; n < j; n++) p = Math.max(p, Math.abs(L[n]), Math.abs(R[n]));
	console.log(`${name.padEnd(9)} ${a.toFixed(1).padStart(5)}–${b.toFixed(1).padStart(5)}s ${db(rms(L, R, i, j))} ${db(p)}  |                                           ${famLevels[s].map((v) => db(v / famTop)).join('')}`);
});
// 16-bit with triangular dither
const buf = Buffer.alloc(44 + N * 4);
buf.write('RIFF', 0);
buf.writeUInt32LE(36 + N * 4, 4);
buf.write('WAVEfmt ', 8);
buf.writeUInt32LE(16, 16);
buf.writeUInt16LE(1, 20);
buf.writeUInt16LE(2, 22);
buf.writeUInt32LE(SR, 24);
buf.writeUInt32LE(SR * 4, 28);
buf.writeUInt16LE(4, 32);
buf.writeUInt16LE(16, 34);
buf.write('data', 36);
buf.writeUInt32LE(N * 4, 40);
const q = (x) => Math.max(-32768, Math.min(32767, Math.round(x * 32767 + rand() - rand())));
for (let n = 0; n < N; n++) {
	buf.writeInt16LE(q(L[n]), 44 + n * 4);
	buf.writeInt16LE(q(R[n]), 46 + n * 4);
}
fs.writeFileSync(new URL('../public/music.wav', import.meta.url), buf);
console.log(`public/music.wav  ${END}s  ${SR} Hz  rms ${db(rmsAll)} dBFS  peak ${db(peakAll)} dBFS`);
