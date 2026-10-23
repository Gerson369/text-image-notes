# Video Handoff 交给动态视频

> 一句话：**交付卡片时同时给 HTML 源文件和 PNG。** PNG 发小红书；HTML 交给「动态视频 xingchen-kinetic-film」，卡片在视频里会「像图片一样，但里面的元素逐个动起来」。

## 为什么一定要 HTML

| 交给视频的文件 | 视频里的样子 |
|---|---|
| 只有 PNG | 一张死图，只能整张推近（`card-stage`） |
| HTML 源文件 | 栏目签、细线、标题、模块内容、数字、照片、页脚按顺序出场（`card-live`） |

## 一条命令导出

```bash
python3 scripts/export_for_video.py --cards <卡片目录> --out <视频工程>/cards
```

它会：

1. 把每张卡的 `*.html`、同名 `*.png`、卡片用到的本地图片复制到交接目录；
2. 生成 `cards.json`：色板 `palette`（视频自动换成同色外观）、出场顺序、每张卡的标题与配方；
3. 做「可动」检查（只读源码，不开浏览器）。

| 级别 | 检查项 | 怎么改 |
|---|---|---|
| 阻断 BLOCK | 没有 `<section class="card">` | 用种子模板 `templates/magazine-card.html` |
| 阻断 BLOCK | 没有 `data-role="title"` | 给主标题加上 |
| 阻断 BLOCK | 引用外网字体/图片/样式 | 视频离线渲染，图片放卡片同目录、用相对路径 |
| 阻断 BLOCK | 图片不存在、用了绝对路径 | 改成相对路径 |
| 提示 WARN | 没有 `data-block` | 给每个内容块（标题、列表、数字组、导语、图注）加 `data-block` |
| 提示 WARN | `data-block` 超过 8 个 | 一个镜头动不完：删块或拆成两张 |
| 提示 WARN | 缺同名 PNG | 先 `node scripts/check_card.mjs card.html --png card.png` |
| 提示 WARN | 一组卡混用多个色板 | 一套图一种色板（本来就是硬规矩） |

阻断项没过的卡，`cards.json` 里记为 `"live": false`，视频会退回整张推近。

## 写卡片时顺手做的三件事

- **每个内容块加 `data-block`**：它决定视频里的出场单位。列表 `ul.items` 会按 `li` 逐条出；并列栏 `.cols` 按栏出；带 `.num` 的块数字会滚动。
- **不想动的元素**写 `data-motion="none"`（例如背景装饰线）；想「划出来」的写 `data-motion="wipe"`（例如一句长图注）。
- **数字写成纯文本**：`+60%`、`24h`、`3.5 倍` 都能滚动；不要把数字拆成多个 `<span>`。

## 不影响小红书出图

这些属性只是普通 HTML 属性，不改变静态 PNG 的样子；`check_card.mjs` 的检查照常进行。

新版模块用data-block表示出场单位；边线和栏目签可写data-motion="none"。新色板为blue/yellow/orange，交接manifest会保留该值，消费端若有旧色板映射需自行适配；HTML本身保留白底与新色彩。导出成功不代表外部视频播放器已验证。

当 PNG 和 HTML 分目录交付时，请先准备临时交接目录，将同编号的 PNG 与 HTML 放在一起，并保留字体和图片的相对路径。正式交付目录继续保持 PNG 与 HTML 分开。
