#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""图文卡片 → 动态视频 交接导出（v1.3.3）

把一组卡片的 HTML 源文件 + PNG + 用到的本地图片，收集到一个交接目录，并生成 cards.json。
动态视频（xingchen-kinetic-film）读到 HTML 就会用「活卡片 card-live」：卡片里的标题、列表、数字逐个动起来；
只有 PNG 时只能整张推近。

    python3 scripts/export_for_video.py --cards <卡片目录> --out <交接目录> [--order p1.html,p2.html]

同时做「可动」检查（只读源码，不需要浏览器）：
  阻断：没有 section.card / 没有 data-role="title" / 引用外网资源 / 引用的图片不存在
  提示：没有 data-block（只能整体淡入）/ data-block 超过 8 个（动不完）/ 缺 PNG / 一组卡片混用多个色板
"""
import argparse
import html as htmllib
import json
import os
import re
import shutil
import sys

VERSION = "v1.3.3"
EXTERNAL = re.compile(r"""(?:src|href)\s*=\s*["']\s*(?:https?:)?//|url\(\s*["']?\s*(?:https?:)?//""", re.I)
IMG_SRC = re.compile(r"""<img\b[^>]*?\bsrc\s*=\s*["']([^"']+)["']""", re.I)
IMG_EXT = (".png", ".jpg", ".jpeg")
CSS_URL = re.compile(r"""url\(\s*["']?([^"')]+)["']?\s*\)""", re.I)


def natural_key(name):
    return [int(t) if t.isdigit() else t for t in re.split(r"(\d+)", name)]


def text_of(fragment):
    s = re.sub(r"<br\s*/?>", "", fragment, flags=re.I)
    s = re.sub(r"<[^>]+>", "", s)
    return htmllib.unescape(re.sub(r"\s+", "", s))


def inspect(path):
    src = open(path, encoding="utf-8").read()
    block, warn = [], []
    sec = re.search(r"""<section\b[^>]*\bclass\s*=\s*["'][^"']*\bcard\b[^"']*["'][^>]*>""", src, re.I)
    if not sec:
        block.append("没有 <section class=\"card\">（视频找不到卡片本体）")
    palette = re.search(r"""data-palette\s*=\s*["']?(\w+)""", sec.group(0) if sec else "")
    recipe = re.search(r"""data-recipe\s*=\s*["']?(\w+)""", sec.group(0) if sec else "")
    tm = re.search(r"""<(\w+)\b[^>]*data-role\s*=\s*["']title["'][^>]*>(.*?)</\1>""", src, re.I | re.S)
    if not tm:
        block.append('没有 data-role="title"（标题不能逐字出场）')
    nblock = len(re.findall(r"\bdata-block\b", src))
    if nblock == 0:
        warn.append("没有 data-block：内容只能整体淡入，建议给每个内容块加 data-block")
    elif nblock > 8:
        warn.append("data-block 有 %d 个：一个镜头动不完，建议 ≤ 8" % nblock)
    if EXTERNAL.search(src):
        block.append("引用了外网资源（字体/图片/样式）：视频渲染离线进行，必须自包含")
    assets = []
    for ref in IMG_SRC.findall(src) + CSS_URL.findall(src):
        if ref.startswith("data:") or ref.startswith("#"):
            continue
        if os.path.isabs(ref) or ref.startswith("file:"):
            block.append("用了绝对路径图片：%s（改成卡片同目录的相对路径）" % ref)
            continue
        full = os.path.normpath(os.path.join(os.path.dirname(path), ref))
        if not os.path.isfile(full):
            block.append("图片不存在：%s" % ref)
        else:
            assets.append(ref)
    return {
        "palette": palette.group(1) if palette else "",
        "recipe": recipe.group(1) if recipe else "",
        "title": text_of(tm.group(2)) if tm else "",
        "blocks": nblock, "assets": sorted(set(assets)), "block": block, "warn": warn,
    }


def main():
    ap = argparse.ArgumentParser(description="图文卡片 → 动态视频 交接导出")
    ap.add_argument("--cards", required=True, help="卡片目录（放 *.html 与同名 *.png）")
    ap.add_argument("--out", required=True, help="交接目录，例如 <film>/cards")
    ap.add_argument("--order", default="", help="出场顺序，逗号分隔的 html 文件名；不写按文件名自然排序")
    a = ap.parse_args()

    if not os.path.isdir(a.cards):
        sys.exit("[export] 卡片目录不存在：%s" % a.cards)
    if a.order:
        names = [n.strip() for n in a.order.split(",") if n.strip()]
    else:
        files = os.listdir(a.cards)
        stems = sorted({os.path.splitext(n)[0] for n in files if n.lower().endswith(IMG_EXT + (".html",))}, key=natural_key)
        names = []
        for st in stems:
            if st + ".html" in files:
                names.append(st + ".html")
            else:  # 只有图片、没有 HTML：也要交给视频（整张推近），不能悄悄丢掉
                names.append(next(st + e for e in IMG_EXT if st + e in files))
    if not names:
        sys.exit("[export] 目录里没有卡片（.html / .png / .jpg）。")
    if not any(n.lower().endswith(".html") for n in names):
        print("WARN   目录里没有 .html 源文件：视频只能整张推近。请保留 HTML 源文件再导出。")

    os.makedirs(a.out, exist_ok=True)
    cards, palettes, nblock, nwarn = [], [], 0, 0
    for n in names:
        p = os.path.join(a.cards, n)
        if not os.path.isfile(p):
            print("BLOCK  %s 不存在" % n); nblock += 1; continue
        if n.lower().endswith(IMG_EXT):
            print("WARN   %s  只有图片、没有同名 HTML：视频里只能整张推近（cards.json 记为 live:false）" % n); nwarn += 1
            shutil.copyfile(p, os.path.join(a.out, n))
            cards.append({"html": "", "png": n, "recipe": "", "title": "", "blocks": 0, "live": False})
            continue
        info = inspect(p)
        png = os.path.splitext(n)[0] + ".png"
        if not os.path.isfile(os.path.join(a.cards, png)):
            info["warn"].append("缺同名 PNG（先运行 check_card.mjs --png 出图；视频可以只用 HTML，但发小红书需要 PNG）")
            png = ""
        for m in info["block"]:
            print("BLOCK  %s  %s" % (n, m)); nblock += 1
        for m in info["warn"]:
            print("WARN   %s  %s" % (n, m)); nwarn += 1
        shutil.copyfile(p, os.path.join(a.out, n))
        if png:
            shutil.copyfile(os.path.join(a.cards, png), os.path.join(a.out, png))
        for ref in info["assets"]:
            dst = os.path.join(a.out, ref)
            os.makedirs(os.path.dirname(dst) or a.out, exist_ok=True)
            shutil.copyfile(os.path.normpath(os.path.join(a.cards, ref)), dst)
        if info["palette"]:
            palettes.append(info["palette"])
        cards.append({"html": n, "png": png, "recipe": info["recipe"], "title": info["title"],
                      "blocks": info["blocks"], "live": not info["block"]})

    uniq = sorted(set(palettes))
    if len(uniq) > 1:
        print("WARN   一组卡片混用了色板 %s：视频外观只能跟一个，建议统一" % ",".join(uniq)); nwarn += 1
    manifest = {"_help": "图文卡片 %s 导出的视频交接清单；动态视频按 cards 顺序出场，palette 映射视频外观" % VERSION,
                "from": "text-image-notes " + VERSION, "palette": palettes[0] if palettes else "",
                "size": [1080, 1440], "cards": cards}
    with open(os.path.join(a.out, "cards.json"), "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)
    live = sum(1 for c in cards if c["live"])
    print("[export] %d 张卡片（可动 %d 张）→ %s/cards.json   %d block, %d warn" % (len(cards), live, a.out, nblock, nwarn))
    print("[export] 下一步（在动态视频里）：python3 scripts/draft_plan.py --project <film> --script script.txt --cards %s" % a.out)
    sys.exit(1 if nblock else 0)


if __name__ == "__main__":
    main()
