// 《南柯一梦》 posters (2026-10-17, the producer asked for stills and posters in the manner of films). Portrait 2:3,
// 2000x3000, rendered as stills: npx remotion still src/index.jsx PosterMain posters/poster-main.png (and PosterDream,
// PosterTeaser). The art is Muse's (public/posters/*.webp, chosen from its PA, PB, PC); the lettering is laid on here,
// the way Chinese film posters set theirs: the title in brush calligraphy (the opening's, tools/make_title.py) or, on
// the silk, in 楷书 down the blank column with a seal; a tagline; the billing block at the foot, Chinese over English.
import React, {useEffect, useState} from 'react';
import {AbsoluteFill, Img, cancelRender, continueRender, delayRender, staticFile} from 'remotion';
import {KAI} from './fonts';
import {SealMark} from './Film';

const W = 2000;
const H = 3000;
const SERIF = "'Times New Roman', Georgia, serif";
const TITLE_ASPECT = 2.744; // public/opening/title.png
const CREDITS_ZH = [['出品人', 'dasungta'], ['编剧 · 导演', 'Opus 5.5'], ['摄影 · 美术', 'Muse'], ['音乐 · 声音', 'Opus 5.5']];
const CREDITS_EN = 'PRESENTED AND PRODUCED BY dasungta   ·   WRITTEN AND DIRECTED BY OPUS 5.5   ·   CINEMATOGRAPHY AND ART DIRECTION BY MUSE   ·   MUSIC AND SOUND BY OPUS 5.5';
const SOURCE_ZH = '原著　唐 · 李公佐《南柯太守传》';
const SOURCE_EN = 'BASED ON “THE GOVERNOR OF THE SOUTHERN TRIBUTARY STATE” BY LI GONGZUO';

// the billing block: on dark art in warm white, on the silk in ink
const Billing = ({ink = false, bottom = 120, lead = null}) => {
	const c1 = ink ? '#2b2017' : '#efe6d2';
	const c2 = ink ? '#4a3b2c' : '#c9bea6';
	return (
		<div style={{position: 'absolute', left: 120, right: 120, bottom, textAlign: 'center'}}>
			{lead ? <div style={{marginBottom: 30, fontFamily: SERIF, fontStyle: 'italic', fontSize: 38, letterSpacing: '0.04em', color: c1}}>{lead}</div> : null}
			<div style={{display: 'flex', justifyContent: 'center', gap: 64, fontFamily: KAI, color: c1}}>
				{CREDITS_ZH.map(([role, name]) => (
					<div key={role} style={{whiteSpace: 'nowrap'}}>
						<span style={{fontSize: 34, letterSpacing: '0.12em', color: c2}}>{role}</span>
						<span style={{marginLeft: 16, fontFamily: SERIF, fontSize: 44, letterSpacing: '0.04em'}}>{name}</span>
					</div>
				))}
			</div>
			<div style={{marginTop: 22, fontFamily: KAI, fontSize: 32, letterSpacing: '0.16em', color: c2}}>{SOURCE_ZH}</div>
			<div style={{marginTop: 26, fontFamily: SERIF, fontSize: 21, letterSpacing: '0.16em', color: c2, lineHeight: 1.7}}>
				{CREDITS_EN}
				<br />
				{SOURCE_EN}
			</div>
		</div>
	);
};

// the calligraphed title, white ink (or black ink with dark = true), horizontally centred at y
const Calligraphy = ({y, width, dark = false, seal = true}) => {
	const h = width / TITLE_ASPECT;
	return (
		<>
			<Img
				src={staticFile('opening/title.png')}
				style={{position: 'absolute', left: (W - width) / 2, top: y - h / 2, width, height: h, filter: dark ? 'brightness(0.12) sepia(0.4)' : 'drop-shadow(0 0 30px rgba(0,0,0,0.55))', opacity: dark ? 0.9 : 1}}
			/>
			{seal ? <SealMark text="槐安" x={W / 2 + width / 2 + 20} y={y + h * 0.16} k={80} font={58} press={10} tilt={-1.5} shadow="none" worn={false} /> : null}
		</>
	);
};

const Art = ({file, position = 'center'}) => <Img src={staticFile(file)} style={{position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: position}} />;

// 正式海报 (art: Muse's PA-d): the dream grows out of the sleeping man's tree. The title high in a darkened sky of
// leaves with the English title under it; the tagline down the pale sky left of the trunk in ink, like an inscription
// on the painting; the man, the fallen cup and the billing block below.
export const PosterMain = () => (
	<AbsoluteFill style={{background: '#000'}}>
		<Art file="posters/art-main.webp" />
		<AbsoluteFill style={{background: 'linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.5) 15%, rgba(0,0,0,0) 27%, rgba(0,0,0,0) 84%, rgba(0,0,0,0.6) 91%, rgba(0,0,0,0.88) 100%)'}} />
		<Calligraphy y={300} width={1250} />
		<div style={{position: 'absolute', left: 0, right: 0, top: 536, textAlign: 'center', fontFamily: SERIF, fontSize: 40, letterSpacing: '0.42em', paddingLeft: '0.42em', color: '#efe6d2', textShadow: '0 0 16px rgba(0,0,0,0.9), 0 0 4px rgba(0,0,0,0.9)'}}>A DREAM UNDER THE SOUTHERN BOUGH</div>
		<div style={{position: 'absolute', left: TAG.x - 40, top: TAG.y, width: 80, mixBlendMode: 'multiply'}}>
			{[...'梦里二十年'].map((ch, i) => (
				<div key={i} style={{height: 88, fontFamily: KAI, fontSize: 76, lineHeight: 1, textAlign: 'center', color: '#231810'}}>{ch}</div>
			))}
		</div>
		<div style={{position: 'absolute', left: TAG.x - 40 - 96, top: TAG.y + 88, width: 80, mixBlendMode: 'multiply'}}>
			{[...'人间一下午'].map((ch, i) => (
				<div key={i} style={{height: 88, fontFamily: KAI, fontSize: 76, lineHeight: 1, textAlign: 'center', color: '#231810'}}>{ch}</div>
			))}
		</div>
		<Billing bottom={70} lead="Twenty years in a dream. One afternoon in the world." />
	</AbsoluteFill>
);
const TAG = {x: 236, y: 1740}; // the inscribed tagline: first column's centre and top, in the pale sky left of the trunk

// 梦境海报: the kingdom under the sky of leaves, on silk; the title in 楷书 down the band of mist on the right, the tagline beside it, a seal under it
export const PosterDream = () => {
	const col = 1640;
	const size = 210;
	const TOP = 1030; // the title and the tagline in the band of mist on the right, clear of the leaves
	return (
		<AbsoluteFill style={{background: '#d9c49a'}}>
			<Art file="posters/art-dream.webp" />
			<AbsoluteFill style={{background: 'linear-gradient(to bottom, rgba(242,228,196,0) 70%, rgba(236,220,184,0.82) 86%, rgba(232,214,176,0.95) 100%)'}} />
			<div style={{position: 'absolute', left: col - size / 2, top: TOP, width: size, mixBlendMode: 'multiply'}}>
				{[...'南柯一梦'].map((ch) => (
					<div key={ch} style={{height: size * 1.08, fontFamily: KAI, fontSize: size, lineHeight: 1, textAlign: 'center', color: '#22170f', opacity: 0.92}}>{ch}</div>
				))}
			</div>
			<div style={{position: 'absolute', left: col + 200, top: TOP + 120, width: 60, mixBlendMode: 'multiply'}}>
				{[...'梦里二十年人间一下午'].map((ch, i) => (
					<div key={i} style={{height: 64, fontFamily: KAI, fontSize: 52, lineHeight: 1, textAlign: 'center', color: '#3a2b1f'}}>{ch}</div>
				))}
			</div>
			<div style={{position: 'absolute', inset: 0, mixBlendMode: 'multiply'}}>
				<SealMark text="槐安" x={col} y={TOP + 4 * size * 1.08 + 90} k={81} font={64} press={10} tilt={-1.5} shadow="none" />
			</div>
			<div style={{position: 'absolute', left: 0, right: 0, bottom: 420, textAlign: 'center', fontFamily: SERIF, fontSize: 40, letterSpacing: '0.42em', paddingLeft: '0.42em', color: '#3a2b1f'}}>A DREAM UNDER THE SOUTHERN BOUGH</div>
			<Billing ink bottom={110} />
		</AbsoluteFill>
	);
};

// 先导海报 (art: Muse's PC-b): the cup that is still not empty, an ant on its rim, low in the frame; the tagline and the
// title in ink in the warm blur above it; who made it at the foot, over the dark sill
export const PosterTeaser = () => (
	<AbsoluteFill style={{background: '#000'}}>
		<Art file="posters/art-teaser.webp" />
		<AbsoluteFill style={{background: 'linear-gradient(to bottom, rgba(255,236,200,0.28) 0%, rgba(255,236,200,0.12) 45%, rgba(0,0,0,0) 62%, rgba(0,0,0,0) 84%, rgba(0,0,0,0.55) 92%, rgba(0,0,0,0.85) 100%)'}} />
		<div style={{position: 'absolute', left: 0, right: 0, top: 300, textAlign: 'center'}}>
			<div style={{fontFamily: KAI, fontSize: 96, letterSpacing: '0.4em', paddingLeft: '0.4em', color: '#24180f'}}>杯中酒未干</div>
			<div style={{marginTop: 22, fontFamily: SERIF, fontStyle: 'italic', fontSize: 42, letterSpacing: '0.04em', color: '#33251a'}}>The wine in the cup is not yet finished.</div>
		</div>
		<Calligraphy y={1130} width={1150} dark />
		<div style={{position: 'absolute', left: 0, right: 0, top: 1370, textAlign: 'center', fontFamily: SERIF, fontSize: 36, letterSpacing: '0.42em', paddingLeft: '0.42em', color: '#2b1f15'}}>A DREAM UNDER THE SOUTHERN BOUGH</div>
		<div style={{position: 'absolute', left: 0, right: 0, bottom: 150, textAlign: 'center', fontFamily: KAI, fontSize: 40, letterSpacing: '0.3em', paddingLeft: '0.3em', color: '#e6dcc6'}}>
			Opus 5.5 作品　·　dasungta 出品
		</div>
		<div style={{position: 'absolute', left: 0, right: 0, bottom: 96, textAlign: 'center', fontFamily: SERIF, fontSize: 22, letterSpacing: '0.2em', color: '#bdb199'}}>A FILM BY OPUS 5.5   ·   PRESENTED BY dasungta</div>
	</AbsoluteFill>
);

// 视频封面 (2026-10-17, the producer asked for a 16:9 and a 4:3 cover): the main poster's picture laid out sideways by
// Muse (art-cover-169 / art-cover-43), the title large in ink on the pale silk of the empty left part so it still
// reads as a thumbnail, the English title and the tagline under it. Placement in each cover's own pixels.
// cols: the tagline as two inscribed columns instead of one line, {x: first column's centre, y: its top, size, gap}.
const CoverText = ({x, y, width, tag = 52, en = 26, enSpacing = '0.4em', tagSpacing = '0.3em', cols = null, sealAt = 0.64, dark = true}) => {
	const h = width / TITLE_ASPECT;
	const ink = dark ? '#22170f' : '#f1e8d4';
	return (
		<>
			<Img src={staticFile('opening/title.png')} style={{position: 'absolute', left: x - width / 2, top: y - h / 2, width, height: h, filter: dark ? 'brightness(0.12) sepia(0.4)' : 'drop-shadow(0 0 24px rgba(0,0,0,0.6))', opacity: dark ? 0.92 : 1}} />
			<div style={{position: 'absolute', inset: 0, mixBlendMode: dark ? 'multiply' : 'normal'}}>
				<SealMark text="槐安" x={x + width / 2 + 18} y={y - h / 2 + h * sealAt} k={82} font={Math.round(width / 19)} press={10} tilt={-1.5} shadow="none" worn={false} />
			</div>
			<div style={{position: 'absolute', left: x - 600, width: 1200, top: y + h / 2 + 6, textAlign: 'center', fontFamily: SERIF, fontSize: en, letterSpacing: enSpacing, paddingLeft: enSpacing, color: ink, opacity: 0.9}}>A DREAM UNDER THE SOUTHERN BOUGH</div>
			{cols ? ['梦里二十年', '人间一下午'].map((line, c) => (
				<div key={c} style={{position: 'absolute', left: cols.x - c * cols.gap - cols.size / 2, top: cols.y + c * cols.size * 1.16, width: cols.size, mixBlendMode: dark ? 'multiply' : 'normal'}}>
					{[...line].map((ch, i) => <div key={i} style={{height: cols.size * 1.16, fontFamily: KAI, fontSize: cols.size, lineHeight: 1, textAlign: 'center', color: ink}}>{ch}</div>)}
				</div>
			)) : <div style={{position: 'absolute', left: x - 600, width: 1200, top: y + h / 2 + en + 34, textAlign: 'center', fontFamily: KAI, fontSize: tag, letterSpacing: tagSpacing, paddingLeft: tagSpacing, color: ink}}>梦里二十年　人间一下午</div>}
		</>
	);
};
export const COVER = {
	w169: {width: 1920, height: 1080},
	w43: {width: 1600, height: 1200},
	t169: {x: 450, y: 590, width: 700, tag: 48, en: 25, sealAt: 0.76},
	t43: {x: 330, y: 160, width: 520, en: 18, enSpacing: '0.2em', cols: {x: 205, y: 340, size: 48, gap: 72}},
};
export const Cover169 = () => (
	<AbsoluteFill style={{background: '#000'}}>
		<Art file="posters/art-cover-169.webp" />
		<CoverText {...COVER.t169} />
	</AbsoluteFill>
);
export const Cover43 = () => (
	<AbsoluteFill style={{background: '#000'}}>
		<Art file="posters/art-cover-43.webp" position="left" />
		<CoverText {...COVER.t43} />
	</AbsoluteFill>
);

// The Bilibili cover (2026-10-17, the producer asked for one "like Bilibili's hits"). The hits in this genre (AI 国风
// shorts, idiom stories) share a manner: one cinematic, high-contrast picture with a face or a striking subject, and a
// two-line hook in huge heavy type, white and yellow with a black edge, plus a small tag. Bilibili's upload cover is 4:3
// (shown so on the phone home feed) and is cut to 16:9 / 16:10 elsewhere, and the feed lays the play count and the
// duration over the bottom ~15%: so the hook sits in the middle band and nothing that matters goes near the foot.
const HEAVY = "'Noto Serif SC Heavy', 'Noto Serif SC', 'SimHei', serif";
const useHeavyFont = () => {
	const [handle] = useState(() => delayRender('Loading the heavy display font'));
	useEffect(() => {
		new FontFace('Noto Serif SC Heavy', `url(${staticFile('fonts/noto-serif-sc-vf.ttf')})`, {weight: '200 900'})
			.load()
			.then((face) => {
				document.fonts.add(face);
				continueRender(handle);
			})
			.catch((err) => cancelRender(err));
	}, [handle]);
};
// heavy lettering with a thick dark edge: an outlined copy underneath, the clean fill on top
const Heavy = ({children, size, color = '#fff', edge = 0.17, style}) => {
	const base = {fontFamily: HEAVY, fontWeight: 900, fontSize: size, lineHeight: 1.12, letterSpacing: '0.02em', whiteSpace: 'nowrap'};
	return (
		<div style={{position: 'relative', ...style}}>
			<div aria-hidden style={{...base, position: 'absolute', inset: 0, color: '#140d08', WebkitTextStroke: `${Math.round(size * edge)}px #140d08`, filter: 'drop-shadow(0 6px 14px rgba(0,0,0,0.65))'}}>{children}</div>
			<div style={{...base, position: 'relative', color}}>{children}</div>
		</div>
	);
};
const Y = ({children}) => <span style={{color: '#ffd23a'}}>{children}</span>;
// tag: the red label, placed on its own (dropped 2026-10-18, the producer's call; the component stays); credit + hook: one block from (x, y); title: the opening's brush title, in ink
// on the silk (dark) or in its own cream on dark ground; shade: an optional soft dark pool behind the hook
const Tag = ({x, y, size}) => (
	<div style={{position: 'absolute', left: x, top: y, padding: `${size * 0.22}px ${size * 0.5}px`, borderRadius: size * 0.3, background: '#c4201c', color: '#fff6e6', fontFamily: HEAVY, fontWeight: 700, fontSize: size, letterSpacing: '0.12em', whiteSpace: 'nowrap', boxShadow: '0 4px 12px rgba(0,0,0,0.35)'}}>唐传奇 · AI 国风电影</div>
);
const BiliText = ({x, y, size, credit = 54, tag, title, shade}) => (
	<>
		{shade ? <div style={{position: 'absolute', inset: 0, background: `radial-gradient(ellipse ${shade.rx}px ${shade.ry}px at ${shade.x}px ${shade.y}px, rgba(8,5,3,${shade.a}), rgba(8,5,3,0) 100%)`}} /> : null}
		{tag ? <Tag {...tag} /> : null}
		<div style={{position: 'absolute', left: x, top: y}}>
			{/* who made it, the producer asked for both names on the cover: Opus directed, Muse shot it */}
			<Heavy size={credit}><Y>Opus 5.5</Y> 导演 × <Y>Muse</Y> 摄影</Heavy>
			<Heavy size={size} style={{marginTop: size * 0.1}}>梦里当了<Y><span style={{fontSize: size * 1.18}}>20</span>年</Y>驸马</Heavy>
			<Heavy size={size * 1.12} style={{marginTop: size * 0.04}}>醒来竟是<Y>蚂蚁窝</Y></Heavy>
		</div>
		<Img src={staticFile('opening/title.png')} style={{position: 'absolute', left: title.x - title.width / 2, top: title.y - title.width / TITLE_ASPECT / 2, width: title.width, filter: title.dark ? 'brightness(0.12) sepia(0.4)' : 'drop-shadow(0 0 18px rgba(0,0,0,0.85)) drop-shadow(0 0 4px rgba(0,0,0,0.8))', opacity: title.dark ? 0.92 : 1}} />
		{title.dark ? (
			<div style={{position: 'absolute', inset: 0, mixBlendMode: 'multiply'}}>
				<SealMark text="槐安" x={title.x + title.width / 2 + 16} y={title.y + title.width / TITLE_ASPECT * 0.14} k={83} font={Math.round(title.width / 19)} press={10} tilt={-1.5} shadow="none" worn={false} />
			</div>
		) : null}
	</>
);
// The art is Muse's CV-W-a, the producer's choice (2026-10-18): the painting whole, the dream city and its procession in
// the tree's crown, the sleeper and the spilt cup below. 4:3: the painting at the foot, under a band of its own silk
// (art-bili-43.webp, made by tools/make_bili_plate.py), the lettering on the silk. 16:9: the painting full bleed, the
// hook over the mist, the low wall and the bare ground left of the couch, the title in the clean sky at top left.
// The first version (Muse's BL-b, the startled face at the glowing hole) is in posters/alt/.
export const BILI = {
	w43: {width: 1600, height: 1200},
	w169: {width: 1920, height: 1080},
	t43: {x: 70, y: 52, size: 104, credit: 54, title: {x: 1290, y: 190, width: 460, dark: true}},
	t169: {x: 50, y: 550, size: 108, credit: 54, title: {x: 240, y: 110, width: 380, dark: true}, shade: {x: 420, y: 720, rx: 760, ry: 300, a: 0.38}},
};
export const CoverBili43 = () => {
	useHeavyFont();
	return (
		<AbsoluteFill style={{background: '#000'}}>
			<Art file="posters/art-bili-43.webp" />
			<BiliText {...BILI.t43} />
		</AbsoluteFill>
	);
};
export const CoverBili169 = () => {
	useHeavyFont();
	return (
		<AbsoluteFill style={{background: '#000'}}>
			<Art file="posters/art-bili-169.webp" />
			<BiliText {...BILI.t169} />
		</AbsoluteFill>
	);
};

export const POSTER = {width: W, height: H};
