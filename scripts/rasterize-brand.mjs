#!/usr/bin/env node
/**
 * CULINA — Brand rasterizer.
 *
 * Renders the SVGs / HTML templates emitted by scripts/generate-brand-assets.py
 * (raster-manifest.json) into the PNG icons and social cards the PWA ships.
 * Requires playwright-core with a chromium build (dev tooling; outputs are
 * committed, so this only runs when brand assets change):
 *
 *   NODE_PATH=<path-to-playwright-core> node scripts/rasterize-brand.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const manifest = JSON.parse(readFileSync(join(ROOT, 'scripts', 'raster-manifest.json'), 'utf8'));

const { chromium } = await import('playwright-core');

/** Resolve the chromium executable: env override, @sparticuz build, or playwright's own. */
async function executablePath() {
  if (process.env.CULINA_QA_EXECUTABLE) return process.env.CULINA_QA_EXECUTABLE;
  try {
    const sparticuz = (await import('@sparticuz/chromium')).default;
    return await sparticuz.executablePath();
  } catch {
    /* fall through to playwright's bundled chromium */
  }
  return undefined;
}

const browser = await chromium.launch({
  executablePath: await executablePath(),
  args: ['--no-sandbox', '--disable-lcd-text', '--font-render-hinting=none'],
});

let failures = 0;
for (const t of manifest.targets) {
  const page = await browser.newPage({ viewport: { width: t.w, height: t.h }, deviceScaleFactor: 1 });
  try {
    if (t.kind === 'svg') {
      await page.setContent(
        `<!doctype html><style>*{margin:0;padding:0}body{width:${t.w}px;height:${t.h}px;overflow:hidden}svg{display:block;width:${t.w}px;height:${t.h}px}</style>${t.svg}`,
      );
      await page.evaluate(() => document.fonts.ready);
    } else {
      await page.goto('file://' + join(ROOT, 'public', t.src));
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(150);
    }
    const out = t.out.startsWith('assets/')
      ? join(ROOT, t.out)
      : join(ROOT, 'public', t.out);
    mkdirSync(dirname(out), { recursive: true });
    await page.screenshot({ path: out, omitBackground: !t.solid });
    console.log('rasterized', t.out, `${t.w}x${t.h}`);
  } catch (err) {
    failures++;
    console.error('FAILED', t.out, err.message);
  } finally {
    await page.close().catch(() => {});
  }
}
await browser.close();

/* ------------------------------------------------------------------------ *
 * ICO assemblies (manifest.ico): multi-size favicon.ico built from the
 * dedicated per-size PNG renders just produced. Each frame embeds the
 * complete PNG file (Vista+ PNG-in-ICO) — byte-copied, never rescaled.
 * ------------------------------------------------------------------------ */
function assembleIco(entry) {
  const srcPaths = entry.sources.map((src) =>
    src.startsWith('assets/') ? join(ROOT, src) : join(ROOT, 'public', src));
  const pngs = srcPaths.map((p) => readFileSync(p));
  const n = pngs.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(n, 4);
  let offset = 6 + 16 * n;
  const entries = pngs.map((buf) => {
    const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20); // PNG IHDR
    const e = Buffer.alloc(16);
    e[0] = w >= 256 ? 0 : w;
    e[1] = h >= 256 ? 0 : h;
    e.writeUInt16LE(1, 4); // color planes
    e.writeUInt16LE(32, 6); // bits per pixel
    e.writeUInt32LE(buf.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += buf.length;
    return e;
  });
  const out = entry.out.startsWith('assets/')
    ? join(ROOT, entry.out)
    : join(ROOT, 'public', entry.out);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, Buffer.concat([header, ...entries, ...pngs]));
  console.log('assembled', entry.out, `${n} frames (${pngs.map((b) => b.readUInt32BE(16)).join('/')}px)`);
}

for (const entry of manifest.ico || []) {
  try {
    assembleIco(entry);
  } catch (err) {
    failures++;
    console.error('FAILED ico', entry.out, err.message);
  }
}

process.exit(failures ? 1 : 0);
