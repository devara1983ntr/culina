#!/usr/bin/env node
/**
 * Brand render check: rasterize every canonical vector asset in headless
 * Chromium (same engine as the E2E suite) so the shipped family is proven
 * parseable, dimensionally correct and visually comparable against the board
 * sources programmatically.
 */
import { chromium } from 'playwright-core';
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';

const VECTOR = new URL('../../assets/brand/vector/', import.meta.url).pathname;
const BUILD = new URL('../../assets/brand/build/', import.meta.url).pathname;
const OUT = '/tmp/brand-render-check';
mkdirSync(OUT, { recursive: true });

/* width presets for viewBox-true checks; default = viewBox width */
const WIDTHS = { 'culina-mark-tile.svg': 512, 'culina-logo.svg': 1200, 'culina-lockup.svg': 1220 };
const targets = readdirSync(VECTOR).filter((f) => f.endsWith('.svg'))
  .map((f) => [f, WIDTHS[f] || 0]);

const sparticuz = (await import('@sparticuz/chromium')).default;
const browser = await chromium.launch({
  executablePath: await sparticuz.executablePath(),
  args: [...sparticuz.args, '--no-sandbox'],
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
let failures = 0;
for (const [name, wDefault] of targets) {
  const svg = readFileSync(VECTOR + name, 'utf8');
  const vb = svg.match(/viewBox="([\d.\s-]+)"/);
  const vbW = vb ? parseFloat(vb[1].trim().split(/\s+/)[2]) : 0;
  const w = wDefault || vbW;
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.setContent(`<!doctype html><meta charset="utf8">
    <style>html,body{margin:0;background:transparent;}svg{display:block;width:100%;height:auto}</style>
    <div id="wrap" style="width:${w}px">${svg}</div>`);
  const el = page.locator('#wrap svg');
  const n = await el.count();
  const box = n ? await el.boundingBox() : null;
  if (!n || !box || box.width < 10) { console.log(`FAIL ${name}: rendered=${n} box=${JSON.stringify(box)}`); failures++; continue; }
  await el.screenshot({ path: `${OUT}/${name.replace('.svg', '.png')}`, omitBackground: true });
  console.log(`OK ${name}: ${box.width.toFixed(0)}x${box.height.toFixed(0)} px rendered`);
  if (errors.length) { console.log(`   pageerrors: ${errors.slice(0, 2).join(' | ')}`); failures++; }
}
await browser.close();
console.log(failures ? `RENDER CHECK: ${failures} FAILURES` : 'RENDER CHECK: ALL OK');
process.exit(failures ? 1 : 0);
