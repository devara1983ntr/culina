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
    const out = join(ROOT, 'public', t.out);
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
process.exit(failures ? 1 : 0);
