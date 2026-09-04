#!/usr/bin/env node
/**
 * CULINA — deployment origin setter.
 *
 * The shipped sitemap.xml uses origin-relative <loc> values and robots.txt a
 * relative Sitemap line so the artifact stays host-agnostic. Search engines
 * prefer absolute URLs, so deployment rewrites them for the public origin:
 *
 *   node scripts/set-origin.mjs https://example.github.io/culina dist/
 *
 * Rewrites in the given build directory (in place):
 *   - sitemap.xml  <loc>/path</loc>  →  <loc>https://origin/path</loc>
 *   - robots.txt   Sitemap: …        →  Sitemap: https://origin/sitemap.xml
 *   - index.html   og:image / twitter:image (absolute for social scrapers)
 *
 * Exits 1 with a clear message if anything is missing. Idempotent.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const [origin, dir = 'dist'] = process.argv.slice(2);
if (!origin || !/^https:\/\/.+/.test(origin)) {
  console.error('usage: node scripts/set-origin.mjs https://<public-origin>[<path>] [build-dir]');
  process.exit(1);
}
const base = origin.replace(/\/+$/, '');

const sitemapPath = join(dir, 'sitemap.xml');
const robotsPath = join(dir, 'robots.txt');
const shellPath = join(dir, 'index.html');
for (const p of [sitemapPath, robotsPath, shellPath]) {
  if (!existsSync(p)) {
    console.error(`set-origin: ${p} not found — run the build first`);
    process.exit(1);
  }
}

const sitemap = readFileSync(sitemapPath, 'utf8');
const fixedSitemap = sitemap.replace(/<loc>(?!https?:)/g, `<loc>${base}`);
writeFileSync(sitemapPath, fixedSitemap);
const locCount = (fixedSitemap.match(new RegExp(`<loc>${base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'g')) || []).length;

const robots = readFileSync(robotsPath, 'utf8');
const fixedRobots = robots.replace(/^Sitemap:.*$/m, `Sitemap: ${base}/sitemap.xml`);
writeFileSync(robotsPath, fixedRobots);

const shell = readFileSync(shellPath, 'utf8');
// Social images + canonical: the build emits them base-prefixed but
// path-relative (e.g. "/culina/social/og-image.png"); resolve against the
// public origin so the result is absolute exactly once.
const absolutize = (attr, key) => (m, a, z) => {
  const value = m.match(new RegExp(`${key}="([^"]*)"`))[1];
  return `${a}${new URL(value, base + '/').toString()}${z}`;
};
const fixedShell = shell
  .replace(/(property="og:image" content=")(?!https?:)[^"]*(")/, absolutize('', 'content'))
  .replace(/(name="twitter:image" content=")(?!https?:)[^"]*(")/, absolutize('', 'content'))
  .replace(/(<link rel="canonical" href=")(?!https?:)[^"]*(")/, absolutize('', 'href'));
writeFileSync(shellPath, fixedShell);

console.log(`set-origin: ${base} — ${locCount} sitemap URLs absolute, robots Sitemap + social images absolute`);
