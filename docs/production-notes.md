# 《南柯一梦》制作笔记

这是制作期间的工程笔记（原来的 README），记着每一步用哪个脚本、每个参数为什么这样定。写给接着改这个工程的人；想先了解整体思路，看 [WORKFLOW.md](WORKFLOW.md)。文中的路径都相对于仓库根目录。

约 223 秒的短片（含 13.5 秒片头），中英双语字幕；配音版约 244.7 秒，取材于唐代李公佐《南柯太守传》。这是工作区里第一部由 Opus 和 Muse 合作完成的片子：

- **Opus**（Claude）负责剧本、分镜、提示词、验收和后期合成（Remotion）。
- **Muse**（muse.ai 上的助手）负责生成设定图、关键帧和视频。Opus 在内置浏览器里把任务发给它，出图后由 Opus 验收。

画风分两套：梦外是写实古装电影，梦里是唐代工笔重彩。

分镜、全部提示词、字幕稿和配乐方案都在 Claude 文档《南柯一梦》短片 · 分镜与 Muse 提示词里，以那份文档为准；2026-10-18 的全文导出在 [storyboard.md](storyboard.md)。

## 文件放哪

文件名只用英文和数字。之前从 Mac 拷到 Windows 时，中文文件名整批乱码过。

| 内容 | 位置 | 例子 |
| --- | --- | --- |
| 设定图 ①～⑦ | `muse/ref<序号>.webp` | `muse/ref1.webp` |
| 关键帧 | `muse/S<镜号>-key.webp` | `muse/S09-key.webp` |
| 视频 | `muse/S<镜号>-v<第几条>.mp4` | `muse/S09-v1.mp4` |
| 配音 | 台词表 `muse/vo/lines.json`；每遍录音 `muse/vo/takes/<句号>-t<第几遍>.wav`；选用的原始录音 `muse/vo/<句号>.wav`；处理好的 `public/vo/<句号>.wav` | `muse/vo/S05-2.wav`（S05 第二句） |

## 进度

- [x] 分镜与提示词文档（2026-10-15）
- [x] 7 张设定图（2026-10-15 定稿，见 `docs/muse-review.md`）
- [x] 三组对照镜头的关键帧（S04/S20、S09/S22、S14/S24，2026-10-15 定稿，对照图见 `docs/pairs-preview.jpg`）
- [x] 其余 21 个镜头的关键帧（2026-10-16 定稿，总览图 `docs/keyframes-contact.jpg`）
- [x] 全部 27 个镜头的视频（2026-10-16 定稿；剪辑表 `edl.json`，素材串联预览 `out/preview-assembly.mp4`，用 `tools/assemble_preview.py` 生成）
- [x] 梦中二十年扩写五镜：S10B 故人重逢、S10C 灵龟山大猎、S11A 子女荣显、S14A 威福日盛、S15A 闭门私第；S26A 按写实画风重拍（2026-10-16）
- [x] 补拍 S10A 到任南柯郡、S12A 周弁单骑夜归、S26A 檀萝之国、S18A 双眼特写；S08「大槐安國」、S10A「南柯郡城」两块匾额逐帧合成（2026-10-16，`tools/plaque_text.py`）
- [x] 正式剪辑：画风转场、S09 合成伏拜的淳于棼、字幕、S25 风雨和闪电、片名（2026-10-16，Remotion，见下文）
- [x] 让不知道典故的人看懂：开头加古槐特写 S00A 和蚂蚁进洞 S00B，S06 重拍成车驾穿过院子驶进那棵老槐，字幕全部改成白话，片名下加成语释义（2026-10-16，见 `docs/muse-review.md`）
- [x] 名章介绍人物；S17、S21、S26A 按人物定型重拍；加檀萝军出谷 S12B、护丧回京 S13A（2026-10-16～17，见 `docs/muse-review.md`）
- [x] S13A 护丧回京改成背影构图重做，车队朝城门越走越远，进城一眼可见（2026-10-17，见 `docs/muse-review.md`）
- [x] 片头 S00：Muse 画的古槐绢画从树洞晕开，墨笔蚂蚁爬进画里的树洞，题名「南柯一梦」、出处和朱印「槐安」，镜头推进树洞，画化成 S00A 的真古槐（2026-10-17，`tools/make_opening.py` 烤出墨色晕开，`Film.jsx` 的 `Opening` 画其余部分，时间点在 `src/cues.json` 的 `opening`）
- [x] 片头写实版（2026-10-17，正式版，13.5 秒）：按电影惯例的中英双语职员表“出品人·制片人 dasungta / 编剧·剪辑 Opus 5.5 / 摄影·美术 Muse / 音乐·声音 Opus 5.5 / 导演 Opus 5.5”叠在冷开场两个写实镜头上（树皮上往上爬的蚂蚁、逆光槐叶和飘落的黄叶），再接黑底书法片名卡「南柯一梦」（Muse 写的字，`tools/make_title.py` 揭成透明底），朱印、英文片名、出处。`src/opening.json` 选用哪个片头（silk / real）；`out/nanke-open-silk.mp4` 和 `out/nanke-open-real.mp4` 是两个完整版本
- [x] 剧照 9 张（`stills/`）和海报 3 张（`posters/`：正式海报、梦境海报、先导海报，竖幅 2:3，中英双语，`src/Poster.jsx` 排字）（2026-10-17）
- [x] 视频封面 16:9、4:3 各一张（`posters/cover-16x9`、`posters/cover-4x3`，`src/Poster.jsx` 的 `Cover169`、`Cover43`）（2026-10-17）
- [x] B站封面（`posters/cover-bilibili-4x3` 投稿用、`cover-bilibili-16x9`；底图是制片人选的 Muse CV-W-a，4:3 上方接一段绢写字，`tools/make_bili_plate.py`；`src/Poster.jsx` 的 `CoverBili43`、`CoverBili169`；第一版 BL-b 在 `posters/alt/`）（2026-10-18）
- [x] 无片头版 `out/nanke-no-opening.mp4`（2026-10-17，`src/opening.json` 设为 `none`，直接从 S00A 开始）
- [x] 无片头配音版 `out/nanke-no-opening-vo.mp4`（2026-10-18，231.2 秒）：和定稿的配音版一样的配音和剪辑，只是去掉 13.5 秒片头，直接从古槐开始。做法：`src/opening.json` 设 `none`、`src/voice.json` 为 `true`，`npm run prep`、`npm run music`、`python -I tools/vo_place.py`（配音按镜头内时间对位，自动跟着前移，不用 `--fit`），再出片；之后切回 `real` 重跑这三步，工程回到正式版
- [ ] 配乐（已写好；2026-10-17 按制片人意见把 S13～S15 重新梳理成连贯的一段，等试听）
- [x] 配音（2026-10-18 定稿：配音版 `out/nanke-vo.mp4` 244.7 秒，制片人看完确认；VoxCPM2 合成，见下文“配音”和 `docs/muse-review.md`）：旁白、紫衣使者、国王、淳于棼四个声音，53 句；念不下的 16 个镜头按配音加长，全片 222.7 → 244.7 秒。配音版 `out/nanke-vo.mp4`，原来的无配音版 `out/nanke.mp4` 保留（制片人意见），`src/voice.json` 切换
- [ ] 混音、片名、成片、封面

## 正式剪辑（Remotion）

在仓库根目录下运行。依赖是 Remotion 4.0.534 + React 19.3.0，`package-lock.json` 锁定了版本，用 `npm ci` 安装。（制作时的 `node_modules` 是从工作区另一个工程拷来的，当时 npm 装不上这两个版本；2026-10-18 npm 官方源已经有了。）

| 步骤 | 命令 | 做什么 |
| --- | --- | --- |
| 1 | `python -I tools/s09_figure.py` | 把伏拜的淳于棼合成进 S09，写 `muse/S09-v2-fig.mp4` |
| 1b | `python -I tools/dejudder.py muse/X.mp4 muse/X-dj.mp4` | 补 Muse 视频里每秒一次的跳帧（S01、S02、S14、S17、S18 已补，`edl.json` 用 `-dj` 版） |
| 1c | `python -I tools/smooth_motion.py muse/X.mp4 muse/X-sm.mp4 [--window 8] [--shutter 0.5]` | 梦里有运镜的镜头（S07、S08、S10C、S12B、S12、S13、S14、S15、S17）：把 Muse 每 8 帧一轮的忽快忽慢拉匀，再加相当于 180° 快门的运动模糊，帧数和时长不变（制片人意见，2026-10-17：运镜时帧率显得很低）；S17 本来就匀，只加模糊（`--window 1`）；写实的 S27 也拉匀，近景远景快慢不同，用 `--measure ratio` 逐像素量、不加模糊（`--shutter 0`） |
| 1d | `python -I tools/make_opening.py`、`python -I tools/make_title.py` | 片头素材：绢画片头的墨色晕开（`public/opening/op-reveal.mp4`），写实片头的书法片名（`public/opening/title.png`）。用哪个片头看 `src/opening.json` |
| 2 | `npm run prep` | 按 `edl.json` 把素材拷进 `public/clips/`；把两处画风转场烤进 S07（从 S06 的黑里像墨在绢上洇开）和 S18（穿过 S17 的白，像纸纤维一层层透开）；测每条环境声的电平，写 `src/clips.json` |
| 2b | `python -I tools/vo_place.py --fit` | 只在台词或录音换了、念不下时用：按配音长度加长镜头（改 `edl.json`），之后重跑 2、3 |
| 3 | `npm run music` | 生成配乐 `public/music.wav`（`music/make-music.mjs`，按 `src/clips.json` 对时间） |
| 3b | `python -I tools/vo_place.py` | 挑录音、清理、对位，写 `public/vo/` 和 `src/vo.json`（配乐压低多少要量 `public/music.wav`，所以在 3 之后） |
| 4 | `npm run studio` | 预览 |
| 5 | `npm run render` | 重新生成配乐并出片 `out/nanke.mp4`（1920×1080，24 fps）。配音版：`src/voice.json` 设 `true`，跑 2、3、3b，再 `npx remotion render src/index.jsx Main out/nanke-vo.mp4 --codec=h264 --crf=18 --pixel-format=yuv420p --concurrency=4`；无配音版设 `false`，跑 2、3 后照常 `npm run render`。两版的镜头时长不同（`edl.json` 的 `dur` 和 `voDur`），切换后一定要重跑 prep 和 music |

- `src/Film.jsx`：剪辑本身。梦外硬切，梦里每两镜之间叠化半秒（从公主病逝到国王起疑，进 S13A、S14、S14A、S15 的四处放慢到 1.25 秒，`XF_INTO`）；片头 S00（`Opening`）：旧绢从黑里亮起，古槐从树洞向外晕开成画，蚂蚁走进画里的树洞，片名、出处和印章题在右边留白，然后推进树洞（放大 1.75 倍，画里的树洞对上 S00A 第一帧里真树洞的位置），叠化成 S00A 的第一帧；S27 收黑，S28 片名。S04→S05 不硬切（制片人意见，2026-10-16）：S04 末尾眼皮沉下、抬起一次、合上；S05 延长到 8 秒，是他的主观视角——闭着眼的黑里有人唤“淳于君——”，眼睛缓缓睁开、沉了一下，看见两个使者直身跪着盯着他，骤然睁大（画面一下清楚、变亮、往前一冲），随后二人伏拜致辞。眼皮的时间点在 `src/cues.json` 的 `eyes`，画面和配乐（磬、堂鼓、带半音的和弦）都读它。醒来与入睡对称（制片人意见，2026-10-16）：入睡前最后一眼是酒樽（S04），醒来先回到酒樽（S20，重拍了二客说笑泼水的 S20-v2，从 S17 的白里透出来），朋友的笑声延续到下一镜慢慢淡去；镜头再找到熟睡的他（S18），按原文是梦里的他看见自己睡在东廊下、使者在画外呼名（不再让使者真身站在院里喊），补拍 S18A：以 S18 的最后一帧为参考出的特写，睡姿与 S18 一致；S18 缓缓推近后硬切到更紧的 S18A（切近景，S18A 的镜头横摇在剪辑里抵消掉），呼名声停时双眼猛然睁开，从睁大的双眼切到掘穴（S21）；S19（坐起）按制片人意见剪掉（重拍的 S19-v2 留在 `muse/`）（制片人意见，2026-10-16，见 `docs/muse-review.md`）。
- `src/subs.js`：字幕，`SUBS` 是中文，`SUBS_EN` 是英文（2026-10-17 加，显示在中文下面一行），从 Claude 文档的字幕表抄来（以文档为准，改了要同步）。字体是 `public/fonts/ukai-cn.ttf`（AR PL UKai，楷书）。
- `src/cues.json`：S05 睁眼和骤然睁大的时间、S25 两道闪电的时间。画面（`Film.jsx`）和配乐（`make-music.mjs`）都读它，改一处两边一起动；改了要先 `npm run music` 再出片。
- 环境声用 Muse 视频自带的声音，每条按测得的电平拉到一样响，梦里再压低一点；惊醒（S20、S18、S18A）和风雨（S25）没有音乐，环境声抬高。
- 配乐只用一个主题（D 羽调）：开头古琴泛音，梦里笙和琵琶放大、编钟点缀，S10A 加堂鼓和铃最满，S12 堂鼓和埙，S13～S14 箫在低音弦乐上一句接一句、渐弱着交接（不留空），S14A 降 E 与 D 摩擦的震音和越来越快的心跳鼓预示转折，S17 渐强到发白后骤停，揭穿时古琴一音一停，S22 一声低钟，S24 箫再吹一句，S25 只有雷雨，S26A 远处一声鼓，结尾古琴和箫完整重现主题，最后一个泛音落在片名上。引擎（古琴、箫、钟、鼓、混响）沿用《清明上河图》的，笙、埙、马蹄、雷、雨是这部新写的；旋律是新的，没有用旧素材。


## 配音（2026-10-18）

用自建的 VoxCPM2 语音合成服务（Gradio 接口；地址和密钥放在 `~/.config/voxcpm2-gateway/client.json`，格式 `{"base_url": …, "api_key": …}`，不进仓库），克隆服务附带的四个 AI 设计的参考声音：旁白（`narrator`）、紫衣使者（`messenger`）、国王（`king`）、淳于棼（`chunyu-low`），复制在 `muse/vo/refs/`。

- `muse/vo/lines.json`：台词表，从 `src/subs.js` 来，一条字幕两个声音的拆开（S16 旁白“国王对他说：”+ 国王）。每句有声音、语气（`mood`）、第二遍的语气（`mood2`）、开始时间（`at`，镜内秒数）。“棼”“弁”送去合成时换成同音的“焚”“变”（`say`），字幕不变。S21 的“他说：”不念（`skip`），直接听他喊。
- `python -I tools/voice.py [--takes 1,2] [--only S05-1]`：逐句录音，一句约 55 秒（每次请求都重新载模型）。服务对同样的请求给出一模一样的录音，所以第二遍换语气（默认“语速稍快一些”）。刚录完一句马上提交下一句会被拒，脚本每句之间等 12 秒，出错就重试。
- `python -I tools/vo_place.py`：每遍量出起止、句内最长停顿、语速、音高；先排除停顿超过 0.9 秒、语速异常、音高偏离这个声音中位数 15% 以上的，再挑最不用加长镜头的那遍（`take` 可手选）。清理：切到有声部分，句内超过 0.45 秒的停顿缩到 0.45 秒，旁白加一点低频（V2 旁白的“浑厚”是后期加的），压缩，每句有声部分统一到 -18 dBFS RMS；S05 梦里的呼唤放慢到 0.65 倍、闷一点加回声，S05 致辞放慢到 0.85 倍，国王加殿堂混响，S18 两个使者的呼名是两遍录音叠在一起（第二个晚 45 毫秒）加回声，在他睁眼那一下截断。写成双声道（Remotion 放单声道文件会低 3 dB）。
- 对位：每句从字幕时间开始，前一句没念完就顺延；`--fit` 按配音长度加长镜头，写进 `edl.json` 的 `voDur`（`dur` 是无配音版的时长，不动），不超过素材和 `maxDur`（S21 5.5 秒后脸对不上，S26A 3.75 秒处素材跳切，S15 8 秒后台基出画），这三处旁白延到下一镜开头 0.1～0.7 秒。
- `src/Film.jsx`：按 `src/vo.json` 放每一句；有旁白时配乐压低到旁白下 11 dB（最多压 13 dB，梦里最满的几段才压这么多），环境声压 6 dB，句前 0.25 秒开始压、句后半秒回来；字幕跟着配音出现，配音念完再收。

制片人第二轮意见（2026-10-18）：
- 保留无配音的原版：`out/nanke.mp4`（和 `out/nanke-open-real.mp4` 相同）不动，配音版另出 `out/nanke-vo.mp4`；工程里加了开关 `src/voice.json`。
- 旁白再厚一点，像历史纪录片的旁白：换声音描述重录不会更厚（量过），参考音本身很暗、很软，所以在后期加厚：音高和共振峰降 7%（约 1.25 个半音），120、250 Hz 加胸腔，550 Hz 减一点箱音，2.5 kHz 和 5 kHz 以上补回清晰度。
- 使者的呼唤要和致辞是同一个声音：两声呼唤改为接着 S05-2 致辞的录音往下说（`ref4` + `transcript4`），三句同样放慢 0.85、同一个小房间混响；S18 两个使者是孪生兄弟，同一条录音叠两层（`double`），去掉了原来的闷声和长回声。
- 国王要苍老：先用国王参考音加“七十多岁、苍老沙哑”的描述重录（第 3 遍），制片人听了还是太年轻，要像影视剧里的皇帝。国王只有一句，就不用参考音，直接按“古装宫廷剧里年迈的皇帝，声音低沉、浑厚、沙哑，气息不足，语速极慢，尾音拖长，不怒自威”设计声音（第 5 遍，`ref5: none`，台词中间加了“……”），压低 8%，加殿堂混响和轻微颤抖，停顿不缩（`keepPauses`）；四个候选里制片人选了这个（试听 `out/king-ab.wav`，A）。这句念 5.5 秒，S16 加长到 7.5 秒，他在国王说完时直起身。
- `out/vo-ab.wav`：改前改后的对比试听（旁白两句改前、改后，国王改前、改后，使者三句连放）。
- 制片人看片意见（2026-10-18）：1:40 的 S11 语速太快，换回第一遍录音（每秒 4.1 字；第二遍“语速稍快”那版是每秒 5.2 字），S11 加长到 5.75 秒；2:55 的 S17 句末要停一下：这句后面留 0.7 秒（`holdAfter`），S17 素材已用到底，镜头在素材末尾的全白里多停一会儿（`edl.json` 的 `holdWhite`，`Film.jsx` 的 `HOLD_WHITE`），S17 加长到 5 秒，话音落下 1.2 秒后才醒来。`make-music.mjs` 里 S17 越来越快的鼓给间隔加了 0.1 秒的下限（间隔每次乘 0.84，加起来只有 3.1 秒，S17 一长就成了死循环；4 秒的原版碰不到这个下限）。
- 制片人意见（2026-10-18）：“来时车马成群，回去只剩一辆破车”的情绪要低落，尾音沉下去。（我先误解成把“车”字机械地拉长，制片人否掉，已回滚。）S17 按低落的语气重录了三版（`style3`～`style5`，同一个旁白参考音，只换语气写法），制片人选第 4 版：“满是落寞和凄凉，声音一点点沉下去，后半句说得很慢，像一声叹息”，音高从 145 Hz 沉到 97 Hz，每秒 3.8 字。S17 5.25 秒。三版加原版的试听：`out/s17-mood.wav`。

## 开源与素材发布（2026-10-18）

制片人决定开源：仓库 [DASungta/nankeyimeng-video](https://github.com/DASungta/nankeyimeng-video)，就是这个 `nanke/` 文件夹。

- git 里只放代码、文档和 JPG 预览；Muse 素材、生成的中间文件、成片都在 `.gitignore` 里（仓库约 20 MB）。
- 素材打成 zip 放在 GitHub Release `assets-v1`（单个文件上限 2 GiB，总量和下载流量不限）：`python -I tools/pack_assets.py` 写 `release/*` 和 `assets.json`（大小、SHA-256），把 `release/` 里的六个文件传到这个 Release 即可。`tools/fetch_assets.py` 按 `assets.json` 下载、校验、解压，支持断点续传，也可以 `--from` 一个已经下好的文件夹（国内网盘镜像就走这条路）。
- 素材改了以后：重跑 `pack_assets.py`（`--only` 只打改了的包），提交新的 `assets.json`，再把对应的文件传到 Release 覆盖旧的。
- 原来的 README 改名为这份 `docs/production-notes.md`；新的 README 面向看片的人。分镜的 Claude 文档导出为 `docs/storyboard.md`，过程和经验总结在 `docs/WORKFLOW.md`。
- 公开前去掉了内网主机名、本机路径和作者邮箱用户名；配音服务的地址和密钥本来就只在 `~/.config/voxcpm2-gateway/client.json`，不在仓库里。
