// Renders the PNG app icons from inline SVG using a locally installed Chromium.
// Usage: node scripts/generate-icons.mjs   (requires `playwright` to be resolvable)
// The PNGs in /public are committed, so this only needs re-running if the mark changes.
import { writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

// `require` also finds a globally installed Playwright, which a bare ESM import would not.
const { chromium } = createRequire(import.meta.url)('playwright');

const mark = (pad) => `
  <g transform="translate(${pad} ${pad}) scale(${(64 - 2 * pad) / 64})">
    <path d="M12 46 24 36l9 4 19-22" fill="none" stroke="#3987e5" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="m12 52 12-5 9 2 19-11" fill="none" stroke="#3ddc97" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
  </g>`;

// iOS and maskable icons are full-bleed squares: the platform applies its own mask.
const fullBleed = (pad) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs><radialGradient id="g" cx="20%" cy="0%" r="110%"><stop offset="0" stop-color="#18202c"/><stop offset="1" stop-color="#07090d"/></radialGradient></defs>
  <rect width="64" height="64" fill="url(#g)"/>${mark(pad)}</svg>`;

const targets = [
  { file: 'public/apple-touch-icon.png', size: 180, svg: fullBleed(5) },
  { file: 'public/icon-192.png', size: 192, svg: fullBleed(5) },
  { file: 'public/icon-512.png', size: 512, svg: fullBleed(5) },
  { file: 'public/icon-maskable-512.png', size: 512, svg: fullBleed(11) },
];

const browser = await chromium.launch();
for (const t of targets) {
  const page = await browser.newPage({ viewport: { width: t.size, height: t.size }, deviceScaleFactor: 1 });
  await page.setContent(`<style>html,body{margin:0}svg{display:block;width:${t.size}px;height:${t.size}px}</style>${t.svg}`);
  await writeFile(t.file, await page.screenshot({ type: 'png' }));
  await page.close();
  console.log('wrote', t.file);
}
await browser.close();
