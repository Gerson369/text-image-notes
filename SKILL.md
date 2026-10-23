---
name: text-image-notes
description: 图文卡片 v1.3.3。把文章、笔记和照片排成白底、细无衬线、居中标题、细线分格的3:4小红书套图；根据内容组合模块，关键数据用醒目的蓝、黄或橙色，支持带边框轻阴影的多页总览。
---

# 图文卡片｜白底细线模块 v1.3.3

调用时显示「图文卡片（v1.3.3）」，技术调用名保持 `$text-image-notes`。名称与版本提示仅在聊天中展示，不写入卡片画面。

把内容做成有留白、有阅读顺序的1080 × 1440图文卡片。页面顶部不加栏目小字、期号或版本号一排；保留整页左上矩形栏目签。标题居中，最多两行；下方主面板内部用浅灰细线分格。下方模块按信息关系组合，不能每页机械套同一张表。

## 制作流程

1. 能推断就不问；只有文字时只问一次照片来源或是否纯文字版（`references/intake.md`）。
2. 压缩内容并规划封面＋完整内页；超出容量就拆页，关键依据和限制不丢（`references/content-planning.md`）。
3. 读 `references/layout-skeleton.md` 与 `references/layout-recipes.md`：逐页决定标题、栏目签、主体、下方组合、来源和留白理由。
4. 读 `references/typography-rules.md`、`references/palettes.md`、`references/components.md`，复制 `templates/magazine-card.html`。字体使用可免费商用的思源黑体；渲染前配置实际字体文件，交付时保留相对路径资产。
5. 有照片时读 `references/photo-subject-map.md`：先检查主体，再裁切；默认照片与文字分区，不压脸。
6. `node scripts/check_card.mjs card.html --png card.png`；阻断项必须修，提示项看图判断。按 `references/whitespace-qa.md` 查看原图和360px缩略图。
7. 多页默认附总览：`python scripts/compose_sheet.py <卡片目录> --out 总览.png`。总览保留每张卡的3:4比例，加细边框、卡间距和轻阴影；总览画布按页数扩展。
8. 交付PNG图片、HTML源文件两个独立文件夹＋本地字体/图片＋一段发布文案；同编号对应，PNG与HTML分开放。网图与事实核对来源记入SOURCES.md。示意数字必须标明，不编数据。
9. 要交给视频时再读 `references/video-handoff.md` 并运行现有 `scripts/export_for_video.py`。总览放在单页目录之外，避免被当成视频卡片。

## 核心规范

- 画布1080 × 1440；正文安全边距≥64px，默认左右88、上下80。纯白背景。整页左上角矩形签贴齐画布(0,0)，仅此签内文字可进入页边区域，签内仍保留14px上下、24px左右留白。
- 全部无衬线细字体：标题300字重、正文300；重要短语与关键数据可500—600。靠字号建立标题层级，不能整页加粗。
- 标题居中、最多2行，每行≤9个汉字，语义断行；正文≥28px、导语≥30px、栏目签/来源/页码≥22px。放不下就删字、拆页或换结构。
- 整页左上角一个贴边矩形栏目签；主面板直角、浅灰细线，写真实栏目或类别。签不是按钮，不能遮住正文；单张卡片无投影、无渐变。轻阴影只用于多页总览的卡片外部。
- 同一套图选择蓝/黄/橙其中一种强调色。蓝色数字可直接着色；亮黄/亮橙用于底色，文字用深色保证对比。同一数据组可有多个醒目数字。
- 主体与下方模块根据内容选择：整块、双栏、三步、四格、四格＋右侧通栏。右侧通栏须有真实内容（结论、限制或下一步），不放虚假按钮或空箭头。
- 留白来自页边、标题与面板间距、格内边距；少信息就合并格子，禁止为了填满而凑数据。通常每页一个主面板，内部1—5个有用分区。
- 卡面文字写给读者，不写制作术语；示例和骨架教学图可标示意区。字体、事实、图片主体与来源仍需人工确认。

## 按需参考

风格与检查：`references/style-system.md`、`references/quality-checklist.md`、`references/failure-modes.md`。
题材与标题：`references/category-routing.md`、`references/title-rules.md`。
总览规范：`references/contact-sheet.md`。照片选择：`references/photo-selection-rules.md`。
