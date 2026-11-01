// @ts-check
/**
 * A review board of the static SVG art, rendered by Chromium as the game renders it (authoring
 * only, not part of the gate):
 *
 *   node scripts/art/svg/preview.mjs <out.png> [--friends a,b,c]
 *
 * Rows: the eggs; every cosmetic with its attachment point marked; the painted friends of the
 * catalog dressed by the contract's cosmetic anchor scale (`cosmeticPlacement`); the stickers
 * composed as the shell composes them (a disc of the sticker's colour, the frame, the icon); and
 * the grotto decorations.
 */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';
import { readJson, repositoryRoot } from '../../lib/tools.mjs';
import { COSMETIC_DESIGNS } from './cosmetics.mjs';
import { renderSvgArt } from './generate.mjs';
import { DISC_RADIUS } from './stickers.mjs';

const out = process.argv[2];
if (!out) throw new Error('Usage: node scripts/art/svg/preview.mjs <out.png>');
const art = renderSvgArt();
const dir = mkdtempSync(join(tmpdir(), 'pearl-svg-'));
/** @type {Map<string, string>} */
const url = new Map();
for (const item of art) {
  const path = join(dir, `${item.id.replace(/\//g, '__')}.svg`);
  writeFileSync(path, item.svg);
  url.set(item.id, pathToFileURL(path).href);
}

/** @type {{ entries: { id: string; file: string; width: number; height: number; anchors?: Record<string, { x: number; y: number; scale: number; rotate: number }> }[] }} */
const catalog = readJson(join(repositoryRoot, 'assets', 'art', 'catalog.json'));
const content = readJson(join(repositoryRoot, 'content', 'pearl-sea.content.json'));
/** @type {{ icon: string; frame: string; color: string; id: string }[]} */
const stickers = content.data.stickers;

/** @param {string} id */
const img = (id, size = 120) =>
  url.has(id)
    ? `<img src="${url.get(id)}" width="${size}" height="${size}">`
    : `<div class="missing" style="width:${size}px;height:${size}px">${id}</div>`;

const slot = new Map(COSMETIC_DESIGNS.map((item) => [`cosmetic/${item.id}`, item.slot]));
const outfits = [
  { head: 'cosmetic/cap-sailor', eyes: 'cosmetic/goggles-diving', neck: 'cosmetic/scarf-stripes' },
  { head: 'cosmetic/hat-straw', eyes: 'cosmetic/glasses-sun', neck: 'cosmetic/bow-shell' },
  { head: 'cosmetic/headband-coral', neck: 'cosmetic/necklace-shells' },
  { head: 'cosmetic/shell-crown' },
];

/**
 * @param {{ file: string; width: number; height: number; anchors?: Record<string, { x: number; y: number; scale: number; rotate: number }> }} entry
 * @param {Record<string, string>} outfit
 */
function dressed(entry, outfit) {
  const W = 260;
  const H = (W * entry.height) / entry.width;
  const src = pathToFileURL(join(repositoryRoot, 'assets', 'art', ...entry.file.split('/'))).href;
  let worn = '';
  for (const anchor of ['neck', 'eyes', 'head']) {
    const id = outfit[anchor];
    const a = entry.anchors?.[anchor];
    if (!id || !a || !url.has(id)) continue;
    const size = (W * 250 * a.scale) / 100000;
    const left = (W * a.x) / 1000 - size / 2;
    const top = (H * a.y) / 1000 - size / 2;
    worn += `<img src="${url.get(id)}" style="position:absolute;left:${left}px;top:${top}px;width:${size}px;height:${size}px;transform:rotate(${a.rotate}deg)">`;
  }
  return `<div class="friend" style="width:${W}px;height:${H}px"><img src="${src}" width="${W}" height="${H}">${worn}</div>`;
}

const friends = catalog.entries.filter((entry) => entry.id.startsWith('friend/') && entry.anchors);
const ourStickers = stickers.filter((s) => url.has(s.icon));
const html = `<!doctype html><html><head><meta charset="utf-8"><style>
body{margin:0;padding:24px;background:#eef6f7;font:15px system-ui;color:#2b1a2a}
h2{margin:18px 0 8px;font-size:17px}
.row{display:flex;flex-wrap:wrap;gap:14px;align-items:flex-end}
.cell{display:flex;flex-direction:column;align-items:center;gap:4px;font-size:12px}
.mark{position:relative;background:#fff;border-radius:10px;box-shadow:0 1px 3px #0002}
.mark::before,.mark::after{content:"";position:absolute;background:#e0306088}
.mark::before{left:50%;top:0;bottom:0;width:1px}.mark::after{top:50%;left:0;right:0;height:1px}
.friend{position:relative;margin-top:60px}
.friend img{position:absolute;left:0;top:0}
.sticker{position:relative;width:130px;height:130px}
.sticker>*{position:absolute;inset:0}
.disc{inset:auto;border-radius:50%;left:${50 - DISC_RADIUS}%;top:${50 - DISC_RADIUS}%;width:${DISC_RADIUS * 2}%;height:${DISC_RADIUS * 2}%}
.grotto{background:linear-gradient(#2b8fa6,#0f4d6b);border-radius:12px;padding:10px}
.missing{background:#fdd;font-size:10px}
</style></head><body>
<section><h2>Eggs</h2><div class="row">${art
  .filter((item) => item.id.startsWith('egg/'))
  .map(
    (item) =>
      `<div class="cell"><img src="${url.get(item.id)}" width="150" height="200">${item.id}</div>`,
  )
  .join('')}</div></section>
<section><h2>Cosmetics (the cross marks the attachment point)</h2><div class="row">${art
  .filter((item) => item.id.startsWith('cosmetic/'))
  .map(
    (item) =>
      `<div class="cell"><div class="mark">${img(item.id, 120)}</div>${item.id.slice(9)} (${slot.get(item.id)})</div>`,
  )
  .join('')}</div></section>
<section><h2>Dressed by the anchors</h2><div class="row">${friends
  .flatMap((entry) => outfits.slice(0, 4).map((outfit) => dressed(entry, outfit)))
  .join('')}</div></section>
<section><h2>Stickers composed (disc, frame, icon)</h2><div class="row">${ourStickers
  .map(
    (s) =>
      `<div class="cell"><div class="sticker"><div class="disc" style="background:${s.color}"></div>${img(s.frame, 130)}${img(s.icon, 130)}</div>${s.icon.slice(8)}</div>`,
  )
  .join(
    '',
  )}<div class="cell"><div class="sticker">${img('sticker/frame-shell', 130)}</div>frame alone</div></div></section>
<section><h2>Grotto decorations</h2><div class="row grotto">${art
  .filter((item) => slot.get(item.id) === 'grotto')
  .map((item) => img(item.id, 160))
  .join('')}</div></section>
</body></html>`;
const page = join(dir, 'board.html');
writeFileSync(page, html);
const browser = await chromium.launch(
  process.env['PREVIEW_CHROMIUM'] ? { executablePath: process.env['PREVIEW_CHROMIUM'] } : {},
);
try {
  const tab = await browser.newPage({
    viewport: { width: 1180, height: 900 },
    deviceScaleFactor: 1,
  });
  await tab.goto(pathToFileURL(page).href);
  await tab.waitForLoadState('networkidle');
  await tab.screenshot({ path: out, fullPage: true });
  const sections = tab.locator('section');
  for (let i = 0; i < (await sections.count()); i++) {
    await sections.nth(i).screenshot({ path: out.replace(/\.png$/, `-${i + 1}.png`) });
  }
} finally {
  await browser.close();
  rmSync(dir, { recursive: true, force: true });
}
console.log(out, readFileSync(out).length);
