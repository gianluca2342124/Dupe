/**
 * Renders the raster brand assets from HTML/SVG with the bundled fonts:
 *   public/og/default.png (1200×630), public/brand/apple-touch-icon.png (180),
 *   public/brand/icon-192.png, public/brand/icon-512.png
 * Usage: node scripts/generate-brand-assets.mjs
 */
import { chromium } from 'playwright';
import { readFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const fontFile = (pkg, match) => {
  const dir = join(root, 'node_modules', pkg, 'files');
  const file = readdirSync(dir).find((f) => match.test(f));
  if (!file) throw new Error(`Font not found in ${pkg}`);
  return `data:font/woff2;base64,${readFileSync(join(dir, file)).toString('base64')}`;
};
const sans = fontFile('@fontsource-variable/instrument-sans', /latin-wght-normal\.woff2$/);
const serif = fontFile('@fontsource/instrument-serif', /latin-400-normal\.woff2$/);
const serifItalic = fontFile('@fontsource/instrument-serif', /latin-400-italic\.woff2$/);

const css = `
@font-face{font-family:'IS';src:url(${sans}) format('woff2');font-weight:100 900}
@font-face{font-family:'ISerif';src:url(${serif}) format('woff2')}
@font-face{font-family:'ISerif';font-style:italic;src:url(${serifItalic}) format('woff2')}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'IS',sans-serif;color:#1A1915}
`;

const arches = (size, left = '#1A1915', right = '#B4532F', gap = '#FAF8F4') =>
  `<svg width="${size}" height="${size}" viewBox="0 0 40 40"><path d="M5 35V17.5a8.5 8.5 0 0 1 17 0V35z" fill="${left}"/><path d="M18 35V17.5a8.5 8.5 0 0 1 17 0V35z" fill="${right}" stroke="${gap}" stroke-width="2.5" stroke-linejoin="round"/></svg>`;

const og = `<!doctype html><html><head><style>${css}
.wrap{width:1200px;height:630px;background:#FAF8F4;position:relative;overflow:hidden;padding:64px 72px}
.logo{display:flex;align-items:center;gap:14px;font-weight:600;font-size:40px;letter-spacing:-1.4px}
h1{font-family:'ISerif',serif;font-weight:400;font-size:118px;line-height:.98;letter-spacing:-1px;margin-top:54px}
h1 em{color:#B4532F}
.bar{position:absolute;left:72px;bottom:64px;display:flex;align-items:center;gap:12px;background:#fff;border:2px solid #E7E1D6;border-radius:999px;padding:18px 28px;font-family:ui-monospace,Menlo,monospace;font-size:26px;color:#4A463F}
.bar b{color:#B4532F}
.deco{position:absolute;right:-40px;bottom:-30px;opacity:.95}
</style></head><body><div class="wrap">
<div class="logo">${arches(52)}<span>gemelu</span></div>
<h1>Lo mismo.<br><em>Por mucho menos.</em></h1>
<div class="bar"><b>gemelu.com/</b>https://tu-tienda.com/producto…</div>
<div class="deco">${arches(420, '#EFE9DF', '#F3DED2', '#FAF8F4')}</div>
</div></body></html>`;

const icon = (size, radius) => `<!doctype html><html><head><style>${css}
.i{width:${size}px;height:${size}px;background:#1A1915;border-radius:${radius}px;display:flex;align-items:center;justify-content:center}
</style></head><body><div class="i">${arches(Math.round(size * 0.68), '#FAF8F4', '#D9653B', '#1A1915')}</div></body></html>`;

const outputs = [
  { file: 'public/og/default.png', html: og, w: 1200, h: 630 },
  { file: 'public/brand/apple-touch-icon.png', html: icon(180, 0), w: 180, h: 180 },
  { file: 'public/brand/icon-192.png', html: icon(192, 0), w: 192, h: 192 },
  { file: 'public/brand/icon-512.png', html: icon(512, 0), w: 512, h: 512 },
];

mkdirSync(join(root, 'public/og'), { recursive: true });
mkdirSync(join(root, 'public/brand'), { recursive: true });
const browser = await chromium.launch();
for (const o of outputs) {
  const page = await browser.newPage({ viewport: { width: o.w, height: o.h }, deviceScaleFactor: 1 });
  await page.setContent(o.html, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: join(root, o.file), clip: { x: 0, y: 0, width: o.w, height: o.h } });
  await page.close();
  console.log('wrote', o.file);
}
await browser.close();
