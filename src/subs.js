// Subtitles, from the Claude doc's 字幕与旁白稿 table (the doc is the source; copy changes here). They are also the
// voice-over script.
// Rewritten in plain words 2026-10-16 (director: the film is for people who do not know the story, so it has to be
// understood without it): the original's classical lines are said in everyday Chinese, the dream is called a dream, the
// reveal says outright that the kingdom was the ant nest, and 「柯」 and the idiom are explained. At most about 5
// characters a second, so the reading never runs past the picture.
// A shot's entry is a line, [line, attribution], or a list of timed cues {at, end?, text} (seconds into the shot).
export const SUBS = {
	S00A: [
		{at: 0.8, end: 2.8, text: '唐朝贞元年间，扬州。'},
		{at: 2.9, text: '淳于棼家的院子里，有一棵老槐树。'},
	],
	S00B: '树根底下有个洞，蚂蚁成群进出。',
	S01: '他常和酒友周弁、田子华在树下喝酒。',
	S02: '他原是军官，酒后顶撞上司丢了官，从此天天喝酒。',
	S03: '这天他又喝醉了，朋友把他扶到东廊下睡下。',
	S04: '他沉沉睡去……',
	// S05 has two lines, timed in seconds into the shot: a voice calling him while his eyes are shut, then the
	// messengers' invitation once he has seen them
	S05: [
		{at: 0.6, end: 2.8, text: '“淳于君——”'},
		{at: 5.1, text: '“槐安国王，派我们来请您。”'},
	],
	// S06 (reshot 2026-10-16): the cart crosses the courtyard to the old tree and drives into the hole at its roots
	S06: [
		{at: 0.3, end: 4.7, text: '他跟着使者上了车。车子竟朝院中那棵老槐树驶去——'},
		{at: 4.9, end: 8.4, text: '钻进了树根下的洞里。'},
	],
	S07: '洞里竟是另一片天地，和人间全然不同。',
	S08: '城门上写着四个金字：大槐安国。',
	S09: '国王召见了他，十分器重。',
	S10: '还把女儿金枝公主嫁给了他。',
	S10B: '婚宴上，他竟遇见了老酒友周弁和田子华。',
	S10C: '他陪国王出城打猎，风光无限。',
	S10A: '国王派他去做南柯郡太守，百姓夹道相迎。',
	S11: '他治理南柯二十年，百姓安居乐业，为他立碑建祠。',
	S11A: '五个儿子都做了官，两个女儿嫁入王族，荣耀一时。',
	S12B: '这一年，邻国檀萝发兵来犯。',
	S12: '檀萝大军漫山而来，围住了瑶台城。',
	S12A: '老友周弁大败，独自逃回城中。',
	S13: '不久，公主病死了。',
	// S13A (added 2026-10-17): 辭守郡，護喪赴國……王與夫人素衣哭於郊，候靈輿之至
	S13A: [
		{at: 1.0, end: 3.9, text: '他辞去太守，护送灵柩回京。'},
		{at: 4.1, text: '国王和满朝权贵出城迎候。'},
	],
	S14: '公主葬在城东的盘龙冈。',
	// S14A: why the crowds after the funeral (director, 2026-10-16): 生久鎮外藩，結好中國，貴門豪族，靡不是洽。自罷郡還國……
	// 交遊賓從，威福日盛，王意疑憚之
	S14A: [
		{at: 1.0, end: 3.9, text: '他守郡多年，权贵早与他交好；'},
		{at: 4.1, text: '回京后宾客盈门，国王起了疑心。'},
	],
	// S15–S15A: why the omen falls on him (director, 2026-10-17): 玄象謫見，國有大恐，都邑遷徙，宗廟崩壞。釁起他族，事在蕭牆。
	// 時議以生侈僭之應也，遂奪生侍衛，禁生遊從，處之私第
	S15: [
		{at: 1.0, end: 3.9, text: '有人上书：天象示警，国有大难，'},
		{at: 4.0, text: '都城将要迁徙，祸根是个外族人。'},
	],
	S15A: [
		{at: 0.4, end: 2.9, text: '众人都说，应在他这个外人身上。'},
		{at: 3.0, text: '国王撤去侍卫，把他软禁在家。'},
	],
	S16: '国王对他说：“你本是人间来的，回家去吧。”',
	S17: '来时车马成群，回去只剩一辆破车。',
	S20: '夕阳还没落山，杯里的酒还没喝完。',
	// S18: back in the courtyard he is still asleep, and the messengers call him from off screen (二使因大呼生之姓名數聲)
	S18: [
		{at: 0.4, end: 2.6, text: '东廊下，他仍在熟睡。'},
		{at: 2.8, end: 5.25, text: '“淳于棼——淳于棼——”'}, // runs on into S18A until his eyes snap open (S18A + 0.25 s)
	],
	S18A: [{at: 0.7, text: '原来是一场梦。'}],
	// 生指曰：「此即夢中所驚入處。」
	S21: [
		{at: 0.2, end: 2.8, text: '梦里二十年，人间才一个下午。'},
		{at: 2.9, text: '他说：“就是从这个洞进去的！”'},
	],
	S22: [
		{at: 0.3, end: 3.3, text: '原来，大槐安国就是树下的蚂蚁窝。'},
		{at: 3.4, text: '那对红头白翅的大蚂蚁，就是国王和王后。'},
	],
	S23: '“柯”就是树枝。南边枝上这一窝，就是南柯郡。',
	S24: '老根旁这个小土堆，就是公主的坟。',
	S25: '当天夜里，风雨大作。',
	S26: '第二天，蚂蚁全都搬走了——应了“迁都”的预言。',
	S26A: '东边老檀树下还有一窝——那就是檀萝国。',
	S27: [
		{at: 0.3, end: 3.1, text: '二十年富贵荣华，原来只是一场梦。'},
		{at: 3.2, text: '从此，他戒了酒，再不求功名。'},
	],
};

// The English subtitles (director, 2026-10-17: add English throughout), shown under the Chinese line. Same keys as
// SUBS: a string for a one-line shot, a list in the same order as the shot's cues. Names in pinyin (Chunyu Fen,
// Zhou Bian, Tian Zihua, Tanluo, Yaotai); 槐 is the pagoda tree, so 大槐安国 is said once in full as "Peace of the
// Pagoda Tree", and 南柯 as "Southern Bough", the film's English title. Kept short enough to read at the shot's pace
// (about 15 letters a second).
export const SUBS_EN = {
	S00A: ['Yangzhou, in the Zhenyuan years of the Tang dynasty.', 'In Chunyu Fen’s courtyard stood an old pagoda tree.'],
	S00B: 'Under its roots was a hole, and ants swarmed in and out.',
	S01: 'He often drank under the tree with his friends Zhou Bian and Tian Zihua.',
	S02: 'Dismissed from the army for a drunken quarrel, he now drank every day.',
	S03: 'Drunk again, he was put to bed by his friends on the east veranda.',
	S04: 'He sank into a deep sleep…',
	S05: ['“Master Chunyu—”', '“The King of Huai’an has sent us to invite you.”'],
	S06: ['He followed the envoys into the carriage, and it headed for the old tree—', 'and drove into the hole beneath its roots.'],
	S07: 'Inside lay another world, nothing like the world of men.',
	S08: 'Over the gate, four gold characters: Great Huai’an — “Peace of the Pagoda Tree”.',
	S09: 'The king received him and held him in high regard.',
	S10: 'He even gave him his daughter, Princess Golden Bough, in marriage.',
	S10B: 'At the wedding feast he met his old drinking friends, Zhou Bian and Tian Zihua.',
	S10C: 'He rode out hunting with the king, in all his glory.',
	S10A: 'The king made him Governor of Nanke, and crowds lined the road to greet him.',
	S11: 'He ruled Nanke for twenty years; the grateful people built him a shrine.',
	S11A: 'His five sons became officials, and his two daughters married into the royal house.',
	S12B: 'That year, the neighbouring kingdom of Tanluo sent an army against them.',
	S12: 'Tanluo’s army poured over the hills and laid siege to the city of Yaotai.',
	S12A: 'His friend Zhou Bian was routed and fled back alone.',
	S13: 'Soon after, the princess fell ill and died.',
	S13A: ['He gave up his post and escorted her coffin back to the capital.', 'The king and all the court came out of the city to meet it.'],
	S14: 'The princess was buried on Coiling Dragon Ridge, east of the city.',
	S14A: ['In his years as governor, he had made friends of the powerful;', 'back in the capital, guests crowded his gate — and the king grew suspicious.'],
	S15: ['A memorial warned: the heavens foretell a great disaster;', 'the capital must move, and the cause is an outsider.'],
	S15A: ['Everyone said the outsider was him.', 'The king took away his guards and confined him to his house.'],
	S16: 'The king told him: “You came from the world of men. Go home.”',
	S17: 'He came with a train of carriages; he leaves in one broken cart.',
	S20: 'The sun has not yet set, and the wine in the cup is not yet finished.',
	S18: ['On the east veranda, he is still fast asleep.', '“Chunyu Fen— Chunyu Fen—”'],
	S18A: ['It was all a dream.'],
	S21: ['Twenty years in the dream; one afternoon in the world of men.', 'He said: “This is the hole I went in by!”'],
	S22: ['So the Great Kingdom of Huai’an was the ants’ nest under the tree.', 'And the two big ants, red-headed and white-winged, were the king and queen.'],
	S23: '“Ke” means bough. The nest on the southern bough was Nanke, the “Southern Bough”.',
	S24: 'And this little mound by the old root was the princess’s grave.',
	S25: 'That night, a great storm of wind and rain.',
	S26: 'Next morning the ants were all gone. The omen of a moving capital had come true.',
	S26A: 'Under the old sandalwood tree to the east, another nest: that was Tanluo.',
	S27: ['Twenty years of wealth and glory, and it was only a dream.', 'From then on he gave up wine, and never again sought rank or fame.'],
};
