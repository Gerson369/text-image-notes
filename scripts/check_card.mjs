#!/usr/bin/env node
// 图文卡片 v1.3.3 版面检查：白底细线模块、字体与几何检查
// 用法：node scripts/check_card.mjs card.html [--png out.png]
import { pathToFileURL } from 'node:url';
const modulePath = process.env.PLAYWRIGHT_MODULE;
const { chromium } = await import(modulePath ? pathToFileURL(modulePath).href : 'playwright');
import path from 'node:path';
import fs from 'node:fs';

const args = process.argv.slice(2);
const file = args.find(a => !a.startsWith('--'));
const pngIdx = args.indexOf('--png');
const png = pngIdx >= 0 ? args[pngIdx + 1] : null;
if (!file || !fs.existsSync(file)) { console.error('usage: node check_card.mjs card.html [--png out.png]'); process.exit(2); }

// 优先使用 Playwright 自带浏览器；不存在时回退到系统 Chromium（或 CHROMIUM_PATH）。
async function launch() {
  if (process.env.CHROMIUM_PATH) return chromium.launch({executablePath:process.env.CHROMIUM_PATH});
  try { return await chromium.launch(); } catch (e) {
    const { execSync } = await import('node:child_process');
    let exe = process.env.CHROMIUM_PATH;
    if (!exe) { for (const n of ['chromium', 'chromium-browser', 'google-chrome']) { try { exe = execSync(`command -v ${n}`).toString().trim(); if (exe) break; } catch {} } }
    if (!exe) throw e;
    return await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });
  }
}
const browser = await launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 1440 }, deviceScaleFactor: 1 });
await page.goto(pathToFileURL(path.resolve(file)).href, { waitUntil: 'load' });
await page.evaluate(() => document.fonts && document.fonts.ready);
await page.waitForTimeout(300);

const fontsOk = await page.evaluate(() => ({ sans: document.fonts.check('300 32px "Noto Sans SC"') && [...document.fonts].some(face => face.family.replaceAll('"','') === 'Noto Sans SC' && face.status === 'loaded') }));
const report = await page.evaluate(() => {
  const SAFE = 64, W = 1080, H = 1440;
  const blocking = [], warnings = [];
  const card = document.querySelector('.card');
  if (!card) return { blocking: ['no_card'], warnings: [] };
  const c = card.getBoundingClientRect();
  if (Math.round(c.width) !== W || Math.round(c.height) !== H) blocking.push(`size:${Math.round(c.width)}x${Math.round(c.height)}`);
  const rel = r => ({ l: r.left - c.left, t: r.top - c.top, r: r.right - c.left, b: r.bottom - c.top, w: r.width, h: r.height });
  // 文字叶子元素
  const texts = [...card.querySelectorAll('*')].filter(el => {
    if (el.closest('[data-subject]')) return false;
    const own = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
    const cs = getComputedStyle(el);
    return own && cs.visibility !== 'hidden' && cs.display !== 'none';
  });
  const boxes = texts.map(el => {
    const range = document.createRange(); range.selectNodeContents(el);
    const rects = [...range.getClientRects()];
    const u = rects.reduce((a, r) => ({ left: Math.min(a.left, r.left), top: Math.min(a.top, r.top), right: Math.max(a.right, r.right), bottom: Math.max(a.bottom, r.bottom) }), { left: 1e9, top: 1e9, right: -1e9, bottom: -1e9 });
    return { el, box: rel({ left: u.left, top: u.top, right: u.right, bottom: u.bottom, width: u.right - u.left, height: u.bottom - u.top }), lines: new Set(rects.map(r => Math.round(r.top))).size, size: parseFloat(getComputedStyle(el).fontSize), text: el.textContent.trim().slice(0, 16) };
  });
  for (const b of boxes) {
    const x = b.box;
    const label = b.el.closest('.page-tab');
    const safeInset = label?.parentElement === card ? 0 : SAFE;
    if (x.l < safeInset || x.t < safeInset || x.r > W - safeInset || x.b > H - safeInset) blocking.push(`out_of_safe_area:${b.text}`);
    const isTitle = b.el.closest('[data-role="title"]');
    const min = isTitle ? 60 : (b.el.closest('.page-tab,.caption,.label,.foot,.no') ? 22 : 28);
    if (b.size < min) blocking.push(`font_too_small:${b.text}:${b.size}px`);
  }
  const ov = (a, b) => Math.max(0, Math.min(a.r, b.r) - Math.max(a.l, b.l)) * Math.max(0, Math.min(a.b, b.b) - Math.max(a.t, b.t));
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    if (boxes[i].el.contains(boxes[j].el) || boxes[j].el.contains(boxes[i].el)) continue;
    if (boxes[i].el.closest('.quote-mark') || boxes[j].el.closest('.quote-mark')) continue; // 装饰引号的字形框大于行框，不参与重叠判定
    if (ov(boxes[i].box, boxes[j].box) > 40) blocking.push(`text_overlap:${boxes[i].text}|${boxes[j].text}`);
  }
  const titles = [...card.querySelectorAll('[data-role="title"]')];
  const subjects = [...card.querySelectorAll('[data-subject]')].map(s => ({ name: s.dataset.subject, box: rel(s.getBoundingClientRect()) }));
  let titleArea = 0;
  for (const t of titles) {
    const tb = boxes.filter(b => t.contains(b.el));
    if (!tb.length) continue;
    const tbox = tb.reduce((a, b) => ({ l: Math.min(a.l, b.box.l), t: Math.min(a.t, b.box.t), r: Math.max(a.r, b.box.r), b: Math.max(a.b, b.box.b) }), { l: 1e9, t: 1e9, r: -1e9, b: -1e9 });
    titleArea += (tbox.r - tbox.l) * (tbox.b - tbox.t);
    const lh = parseFloat(getComputedStyle(t).lineHeight) || parseFloat(getComputedStyle(t).fontSize) * 1.3;
    const lines = Math.round(t.getBoundingClientRect().height / lh);
    const maxLines = 2;
    if (lines > maxLines) blocking.push(`title_lines:${lines}`);
    const raw = t.innerText.split('\n').map(s => s.trim()).filter(Boolean);
    raw.forEach(l => { if ([...l.replace(/[，。、,.!?！？：:；;]/g, '')].length > 9) warnings.push(`title_line_over_9:${l}`); if ([...l].length === 1) blocking.push(`orphan_char:${l}`); });
    for (const s of subjects) if (ov(tbox, s.box) > 0) blocking.push(`title_over_subject:${s.name}`);
    const below = boxes.filter(b => !t.contains(b.el) && b.box.t >= tbox.b - 2).sort((a, b) => a.box.t - b.box.t)[0];
    const requiredGap = below?.el.closest('.lead') ? 16 : 32;
    if (below && below.box.t - tbox.b < requiredGap) warnings.push(`title_gap:${Math.round(below.box.t - tbox.b)}px`);
  }
  if (titleArea / (W * H) > 0.40) warnings.push(`title_area:${(titleArea / (W * H)).toFixed(2)}`);
  // 四段空洞：内容 = 文字框、图片、data-whitespace=intent 区域、带背景/边框的元素
  const filled = [];
  boxes.forEach(b => filled.push(b.box));
  card.querySelectorAll('img,.photo,[data-whitespace="intent"],hr,.rule').forEach(e => filled.push(rel(e.getBoundingClientRect())));
  const rows = new Array(H).fill(false);
  filled.forEach(f => { for (let y = Math.max(0, Math.floor(f.t)); y < Math.min(H, Math.ceil(f.b)); y++) rows[y] = true; });
  let run = 0, maxRun = 0, runStart = 0, maxStart = 0;
  for (let y = Math.round(H * 0.08); y < Math.round(H * 0.92); y++) { if (!rows[y]) { if (!run) runStart = y; run++; if (run > maxRun) { maxRun = run; maxStart = runStart; } } else run = 0; }
  if (maxRun > 216) warnings.push(`unexplained_gap:${maxRun}px@y${maxStart}`);
  const kinds = new Set([...card.querySelectorAll('[data-component]')].map(e => e.dataset.component));
  if (kinds.size > 3) warnings.push(`components:${kinds.size}`);
  const blocks = card.querySelectorAll('[data-block]').length;
  if (blocks > 8) warnings.push(`text_blocks:${blocks}`);
  // 白底、细无衬线和模块几何关系与模板一起检查。
  const style = card.dataset.style || '';
  if (card.querySelector('.masthead')) blocking.push('unwanted_top_metadata');
  if (style !== 'grid-notes') blocking.push('unsupported_style:use_v1.3_template');
  if (getComputedStyle(card).backgroundColor !== 'rgb(255, 255, 255)') blocking.push('background_not_white');
  const elements = [card, ...card.querySelectorAll('*')];
  for (const element of elements) {
    const css = getComputedStyle(element);
    if (css.boxShadow !== 'none' || css.textShadow !== 'none') blocking.push('shadow_on_single_card');
    if (/gradient/.test(css.backgroundImage)) blocking.push('gradient');
  }
  for (const item of boxes) {
    const css = getComputedStyle(item.el);
    const fonts = css.fontFamily.split(',').map(font => font.trim().replaceAll('"', ''));
    if (fonts.some(font => !['Noto Sans SC', 'sans-serif'].includes(font))) blocking.push(`font_not_sans:${item.text}`);
    const weight = Number(css.fontWeight);
    if (weight > 400 && !item.el.closest('.num,strong,b,.emphasis')) blocking.push(`unexpected_bold:${item.text}`);
    if (css.fontStyle !== 'normal') blocking.push('unexpected_italic');
    if (weight < 300) blocking.push(`font_too_thin:${item.text}`);
    if (item.el.closest('.lead') && item.size < 30) blocking.push('lead_too_small');
    if (['yellow','orange'].includes(card.dataset.palette) && item.el.closest('.num') && css.color !== 'rgb(32, 33, 36)') blocking.push('bright_metric_needs_dark_text');
  }
  for (const title of titles) {
    const css = getComputedStyle(title);
    if (css.textAlign !== 'center') blocking.push('title_not_centered');
    if (Number(css.fontWeight) > 400) blocking.push('title_not_light');
  }
  const panel = card.querySelector('.panel');
  const pageTabs = [...card.querySelectorAll('.page-tab')];
  const tab = pageTabs[0];
  const footer = card.querySelector('.foot');
  const modules = panel?.querySelector('.modules');
  if (!panel) blocking.push('missing_panel');
  if (!tab || !tab.textContent.trim()) blocking.push('missing_page_tab');
  if (pageTabs.length > 1) blocking.push('multiple_page_tabs');
  if (card.querySelector('.panel-tab')) blocking.push('legacy_panel_tab');
  if (!footer) blocking.push('missing_footer');
  if (!modules || !['focus','pair','facts','facts-side','steps'].includes(modules.dataset.grid)) blocking.push('invalid_module_layout');
  if (tab) {
    const tabBox = tab.getBoundingClientRect();
    const tabCss = getComputedStyle(tab);
    if (tab.parentElement !== card) blocking.push('page_tab_not_direct_child');
    if (getComputedStyle(card).position !== 'relative' || tabCss.position !== 'absolute') blocking.push('page_tab_not_page_anchored');
    if (Math.abs(tabBox.left-c.left)>1 || Math.abs(tabBox.top-c.top)>1) blocking.push('tab_not_page_top_left');
    if (tabBox.width<=tabBox.height || parseFloat(tabCss.borderRadius)>0 || ['borderTopWidth','borderRightWidth','borderBottomWidth','borderLeftWidth'].some(property => parseFloat(tabCss[property])<1)) blocking.push('tab_not_rectangular');
    if (tabBox.right>c.right || tabBox.bottom>c.bottom) blocking.push('page_tab_out_of_page');
    if (tab.scrollWidth>tab.clientWidth+1 || tab.scrollHeight>tab.clientHeight+1) blocking.push('page_tab_content_overflow');
    for (const item of boxes.filter(item => tab.contains(item.el))) {
      const area = rel(tabBox);
      if (item.box.l<area.l || item.box.r>area.r || item.box.t<area.t || item.box.b>area.b) blocking.push('page_tab_content_overflow');
    }
    for (const item of boxes.filter(item => !tab.contains(item.el))) {
      if (ov(rel(tabBox),item.box)>40) blocking.push(`tab_over_content:${item.text}`);
    }
    for (const subject of subjects) {
      if (ov(rel(tabBox),subject.box)>0) blocking.push('tab_over_subject');
    }
  }
  if (panel) {
    const panelBox = panel.getBoundingClientRect();
    const css = getComputedStyle(panel);
    if (parseFloat(css.borderTopWidth) < 1 || parseFloat(css.borderLeftWidth) < 1) blocking.push('missing_panel_border');
    if (parseFloat(css.borderRadius) > 0) blocking.push('panel_not_rectangular');
    for (const item of boxes.filter(item => panel.contains(item.el))) {
      if (item.box.l<panelBox.left-c.left-2 || item.box.r>panelBox.right-c.left+2 || item.box.b>panelBox.bottom-c.top+2) blocking.push(`text_out_of_panel:${item.text}`);
    }
    for (const element of panel.querySelectorAll('.hero,.cell')) {
      const area = rel(element.getBoundingClientRect());
      if (element.scrollWidth>element.clientWidth+1 || element.scrollHeight>element.clientHeight+1) blocking.push('module_overflow');
      for (const item of boxes.filter(item => element.contains(item.el))) {
        if (item.box.l<area.l-1 || item.box.r>area.r+1 || item.box.t<area.t-1 || item.box.b>area.b+1) blocking.push(`text_out_of_module:${item.text}`);
      }
    }
    if (footer && footer.getBoundingClientRect().top-panelBox.bottom<24) blocking.push('panel_footer_gap');
    const zone = card.querySelector('.title-zone');
    if (zone && panelBox.top-zone.getBoundingClientRect().bottom<24) blocking.push('title_panel_gap');
  }
  if (modules) {
    const cells = [...modules.children];
    const layout = modules.dataset.grid;
    const expected = {focus:1,pair:2,facts:4,'facts-side':5,steps:3}[layout];
    if (cells.length!==expected) blocking.push(`module_count:${layout}:${cells.length}`);
    if (parseFloat(getComputedStyle(modules).borderTopWidth)<1) blocking.push('missing_module_rule');
    const requiredRules = {
      focus: [], pair: [[1,'borderLeftWidth']],
      facts: [[1,'borderLeftWidth'],[2,'borderTopWidth'],[3,'borderLeftWidth'],[3,'borderTopWidth']],
      'facts-side': [[1,'borderLeftWidth'],[2,'borderTopWidth'],[3,'borderLeftWidth'],[3,'borderTopWidth'],[4,'borderLeftWidth']],
      steps: [[1,'borderTopWidth'],[2,'borderTopWidth']]
    };
    for (const [index, property] of requiredRules[layout] || []) {
      if (cells[index] && parseFloat(getComputedStyle(cells[index])[property])<1) blocking.push(`missing_cell_rule:${index}:${property}`);
    }
    for (let i=0;i<cells.length;i++) {
      for (let j=i+1;j<cells.length;j++) {
        if (ov(rel(cells[i].getBoundingClientRect()),rel(cells[j].getBoundingClientRect()))>1) blocking.push('module_cells_overlap');
      }
    }
    if (layout==='facts-side') {
      const side = modules.querySelector('.side');
      if (!side || Math.abs(side.getBoundingClientRect().height-modules.clientHeight)>2) blocking.push('side_not_spanning_two_rows');
    }
  }
  if (!['blue','yellow','orange'].includes(card.dataset.palette)) blocking.push('unsupported_palette');
  const pageTabBox = tab ? rel(tab.getBoundingClientRect()) : null;
  return { style, page_tab: pageTabBox ? {left:pageTabBox.l,top:pageTabBox.t,parent:tab.parentElement.className} : null, blocking: [...new Set(blocking)], warnings: [...new Set(warnings)], text_elements: boxes.length, title_area: +(titleArea / (W * H)).toFixed(3) };
});
if (png) {
  await page.locator('.card').screenshot({ path: png });
  report.png = png;
}
await browser.close();
report.version = '1.3.3';
report.fonts = fontsOk;
for (const [k, v] of Object.entries(fontsOk)) if (!v) report.blocking.push(`font_not_loaded:${k}`);
report.status = report.blocking.length ? 'BLOCKED' : 'PASS_AUTOMATED';
console.log(JSON.stringify(report, null, 2));
process.exit(report.blocking.length ? 1 : 0);
