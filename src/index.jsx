import React from 'react';
import {Composition, registerRoot} from 'remotion';
import {Film, TOTAL, FPS} from './Film';
import {BILI, COVER, Cover169, Cover43, CoverBili169, CoverBili43, POSTER, PosterDream, PosterMain, PosterTeaser} from './Poster';

registerRoot(() => (
	<>
		<Composition id="Main" component={Film} durationInFrames={TOTAL} fps={FPS} width={1920} height={1080} />
		{/* posters, rendered as stills (src/Poster.jsx) */}
		<Composition id="PosterMain" component={PosterMain} durationInFrames={1} fps={FPS} {...POSTER} />
		<Composition id="PosterDream" component={PosterDream} durationInFrames={1} fps={FPS} {...POSTER} />
		<Composition id="PosterTeaser" component={PosterTeaser} durationInFrames={1} fps={FPS} {...POSTER} />
		{/* video covers */}
		<Composition id="Cover169" component={Cover169} durationInFrames={1} fps={FPS} {...COVER.w169} />
		<Composition id="Cover43" component={Cover43} durationInFrames={1} fps={FPS} {...COVER.w43} />
		{/* the Bilibili cover: 4:3 is what the upload asks for, 16:9 for the other places it shows */}
		<Composition id="CoverBili43" component={CoverBili43} durationInFrames={1} fps={FPS} {...BILI.w43} />
		<Composition id="CoverBili169" component={CoverBili169} durationInFrames={1} fps={FPS} {...BILI.w169} />
	</>
));
