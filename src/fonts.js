// The subtitle and title font travels with the project (public/fonts), so a frame looks the same on any machine:
// AR PL UKai CN, a 楷书 close to the hand of Tang copybooks. Loaded once, before the first frame is taken
// (delayRender), as in qingming-v6. Licence: public/fonts/LICENSE-arphic-ukai.txt.
import {cancelRender, continueRender, delayRender, staticFile} from 'remotion';

export const KAI = "'AR PL UKai CN', 'KaiTi', serif";

if (typeof document !== 'undefined' && !window.__nankeFonts) {
	window.__nankeFonts = true;
	const handle = delayRender('Loading the bundled font');
	new FontFace('AR PL UKai CN', `url(${staticFile('fonts/ukai-cn.ttf')})`, {weight: '400'})
		.load()
		.then((face) => {
			document.fonts.add(face);
			continueRender(handle);
		})
		// a frame with a fallback font would not match the rest of the film: stop the render instead
		.catch((err) => cancelRender(err));
}
