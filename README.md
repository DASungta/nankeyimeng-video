# 南柯一梦 · A Dream Under the Southern Bough

一部 4 分钟 AI 唐传奇短片的完整工程：剧本、分镜、每一镜的提示词、剪辑和配乐的代码、修素材的工具，以及从第一张图到定稿的全部审片记录。

故事取自唐代李公佐的《南柯太守传》：落魄军官淳于棼醉卧槐树下，梦里做了大槐安国的驸马和南柯太守，二十年荣华一场空；醒来时夕阳还没落山，杯里的酒还没喝完，树下的蚂蚁窝就是那个王国。

出品人、制片人 **dasungta** · 编剧、剪辑、音乐、导演 **Opus 5.5**（Claude Code） · 摄影、美术 **Muse**（muse.ai）

![海报：正式海报、梦境海报、先导海报](posters/posters-overview.jpg)

![剧照九张](stills/stills-contact-sheet.jpg)

## 先看哪里

| 想了解 | 看这里 |
| --- | --- |
| 整个流程怎么做、踩过哪些坑 | [docs/WORKFLOW.md](docs/WORKFLOW.md) |
| 分镜表、人物定型、唐代史实规范、每一镜发给 Muse 的提示词、字幕稿、配乐表 | [docs/storyboard.md](docs/storyboard.md) |
| 每一轮出图、出视频的验收结论和导演意见 | [docs/muse-review.md](docs/muse-review.md) |
| 每个脚本怎么用、参数为什么这样定 | [docs/production-notes.md](docs/production-notes.md) |

## 仓库里有什么

```
edl.json               剪辑表：每一镜用哪条视频、入点、时长
src/                   Remotion 工程
  Film.jsx               成片：叠化、画风转场、名章、片头、片名、字幕、配音对位
  Poster.jsx             海报和封面的排字
  subs.js                中英双语字幕
  cues.json              画面和配乐共用的时间点
music/make-music.mjs   配乐，纯代码合成（古琴、箫、笙、琵琶、埙、编钟、堂鼓、雷雨）
tools/                 Python 工具：补帧、拉匀运镜、人物合成、匾额题字、片头、配音录制与对位、素材打包下载
muse/vo/lines.json     配音台词表
docs/                  工作流、分镜、审片记录、制作笔记、预览图
stills/  posters/      剧照、海报、封面（JPG）
```

## 素材下载

素材共 1.9 GB，没有放进 git，放在 GitHub Release [assets-v1](https://github.com/DASungta/nankeyimeng-video/releases/tag/assets-v1)。文件名、大小和 SHA-256 记在 [assets.json](assets.json)。

| 文件 | 大小 | 内容 | 出片需要 |
| --- | --- | --- | --- |
| `nanke-muse.zip` | 664 MB | Muse 的设定图、定稿关键帧和视频（含补帧、拉匀、题字、合成后的版本），配音的全部录音和参考声音 | 是 |
| `nanke-public.zip` | 63 MB | 片头素材、海报和封面的底图、字体 | 是 |
| `nanke-muse-alt.zip` | 419 MB | 候选和落选的图与视频，对照审片记录看 | 否 |
| `nanke-posters-png.zip` | 50 MB | 海报和封面的 PNG 原图 | 否 |
| `nanke-vo.mp4` | 364 MB | 成片，配音版，4 分 05 秒 | 否 |
| `nanke.mp4` | 335 MB | 成片，无配音版，3 分 43 秒 | 否 |

用脚本下载，会校验并解压到对应的文件夹：

```bash
python -I tools/fetch_assets.py
```

加 `--all` 连同可选文件一起下；已经从别处下好的，用 `--from <文件夹>` 只校验和解压。

## 自己出片

需要 Node.js（18 以上）、Python 3.12 和 ffmpeg。在仓库根目录下：

```bash
npm ci
```

```bash
pip install -r requirements.txt
```

```bash
python -I tools/fetch_assets.py
```

```bash
npm run prep
```

```bash
npm run music
```

```bash
python -I tools/vo_place.py
```

```bash
npx remotion render src/index.jsx Main out/nanke-vo.mp4 --codec=h264 --crf=18 --pixel-format=yuv420p --concurrency=4
```

`npm run studio` 打开预览。出无配音版：把 `src/voice.json` 的 `use` 改成 `false`，再跑 `npm run prep` 和 `npm run render`。换片头：改 `src/opening.json`（`real` 写实版、`silk` 绢画版、`none` 不要片头）。海报和封面：`npx remotion still src/index.jsx PosterMain posters/poster-1-main.png`，其余见 `src/index.jsx`。

重新录配音要有自己的 VoxCPM2 服务，见 [docs/production-notes.md](docs/production-notes.md) 的“配音”一节；不录的话，素材包里的录音就够出片。

## 许可

代码按 [MIT](LICENSE) 开源。剧本、分镜、提示词、文档、图片和视频按 CC BY-NC 4.0（署名、非商业）发布，字体各按自己的许可，详见 [LICENSE-CONTENT.md](LICENSE-CONTENT.md)。
