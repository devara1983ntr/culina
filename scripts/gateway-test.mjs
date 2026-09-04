#!/usr/bin/env node
/**
 * CULINA — production gateway test suite (gap G-07).
 * Boots server.js on a scratch port against the built dist/ and asserts the
 * deployment-critical behaviors: security headers, SPA fallback, asset 404s,
 * proxy allowlisting, method guard, healthz, path-traversal defense, sitemap
 * coverage, manifest MIME, and X-Robots-Tag on app-internal pages.
 *
 * Requires `npm run build` to have produced dist/ (CI runs this after build).
 */
import { spawn } from 'node:child_process';
import { request } from 'node:http';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const PORT = 3999;
const BASE = `http://127.0.0.1:${PORT}`;

let passed = 0;
let failed = 0;
function ok(name) { passed++; console.log(`  ✓ ${name}`); }
function fail(name, detail) { failed++; console.log(`  ✗ ${name} — ${detail}`); }
function assert(cond, name, detail = '') { cond ? ok(name) : fail(name, detail); }

/** Fetch binary bodies intact (for PNG asset checks). */
function fetchBuffer(path) {
  return new Promise((resolve, reject) => {
    const req = request({ host: '127.0.0.1', port: PORT, path, method: 'GET' }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, buf: Buffer.concat(chunks) }));
    });
    req.on('error', reject);
    req.end();
  });
}

/** Fetch with full header access (follows nothing, keeps status). */
function fetchRaw(path, { method = 'GET' } = {}) {
  return new Promise((resolve, reject) => {
    const req = request({ host: '127.0.0.1', port: PORT, path, method }, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    req.on('error', reject);
    req.end();
  });
}

const PUBLIC_ROUTES = [
  '/', '/discover', '/search', '/recipes', '/ingredients', '/nutrition', '/products',
  '/drinks', '/cocktails', '/beer', '/breweries', '/coffee', '/planner', '/kitchen',
  '/health', '/about', '/food', '/categories', '/cuisines', '/privacy', '/terms', '/accessibility',
];

console.log('\n── CULINA gateway tests ──\n');

const child = spawn('node', ['server.js'], {
  cwd: new URL('..', import.meta.url).pathname,
  env: { ...process.env, PORT: String(PORT) },
  stdio: ['ignore', 'pipe', 'pipe'],
});
child.stdout.on('data', () => {});
child.stderr.on('data', (d) => process.stderr.write(`[gateway] ${d}`));

// wait for readiness
let up = false;
for (let i = 0; i < 40 && !up; i++) {
  await new Promise((r) => setTimeout(r, 250));
  try { up = (await fetchRaw('/healthz')).status === 200; } catch { /* not yet */ }
}
if (!up) {
  console.error('Gateway did not become ready on port ' + PORT);
  child.kill('SIGTERM');
  process.exit(1);
}

try {
  /* 1 — security headers on the shell */
  const home = await fetchRaw('/');
  assert(home.status === 200, 'shell returns 200');
  assert((home.headers['content-type'] || '').includes('text/html'), 'shell is HTML');
  const csp = home.headers['content-security-policy'] || '';
  assert(csp.includes("default-src 'self'"), 'CSP default-src self');
  assert(/script-src 'self' 'sha256-/.test(csp), 'CSP allows only hashed inline script');
  assert(csp.includes('frame-ancestors \'none\''), 'CSP frame-ancestors none');
  for (const origin of ['themealdb.com', 'thecocktaildb.com', 'foodish-api.com', 'api.openbrewerydb.org', 'world.openfoodfacts.org', 'api.sampleapis.com']) {
    assert(csp.includes(origin), `CSP connect-src includes ${origin}`);
  }
  assert(home.headers['x-content-type-options'] === 'nosniff', 'X-Content-Type-Options nosniff');
  assert(home.headers['x-frame-options'] === 'DENY', 'X-Frame-Options DENY');
  assert((home.headers['referrer-policy'] || '') === 'strict-origin-when-cross-origin', 'Referrer-Policy');
  assert((home.headers['permissions-policy'] || '').includes('camera=()'), 'Permissions-Policy restricts camera');
  assert(!(home.headers['permissions-policy'] || '').includes('microphone'), 'Permissions-Policy keeps microphone (voice search)');
  assert((home.headers['cross-origin-opener-policy'] || '') === 'same-origin', 'COOP same-origin');
  assert(home.headers['strict-transport-security'] === undefined, 'no HSTS over plain http (spec-correct)');
  assert((home.headers['cache-control'] || '') === 'no-cache', 'shell is no-cache');

  /* 2 — SPA fallback + asset 404 */
  const spa = await fetchRaw('/some/deep/client/route');
  assert(spa.status === 200 && (spa.headers['content-type'] || '').includes('text/html'), 'SPA fallback serves shell for client routes');
  const asset = await fetchRaw('/assets/definitely-missing-913.js');
  assert(asset.status === 404, 'missing assets return 404 (no HTML fallback)');
  assert((asset.headers['x-content-type-options'] || '') === 'nosniff', '404 keeps nosniff');

  /* 3 — hashed asset caching */
  const css = await fetchRaw('/assets/' + (home.body.match(/assets\/(index-[\w-]+\.css)/) || [])[1]);
  assert(css.status === 200 && (css.headers['cache-control'] || '').includes('immutable'), 'hashed assets are immutable');

  /* 4 — proxy allowlist */
  const evil = await fetchRaw('/api/fruityvice/api/fruit/../../etc/passwd');
  assert(evil.status === 403, 'proxy path allowlist rejects traversal paths (403)');
  const unknown = await fetchRaw('/api/unknownprovider/x');
  assert(unknown.status === 404, 'unknown provider is not proxied (404)');
  const post = await fetchRaw('/', { method: 'POST' });
  assert(post.status === 405, 'non-GET/HEAD rejected (405)');

  /* 5 — healthz */
  const hz = await fetchRaw('/healthz');
  assert(hz.status === 200 && JSON.parse(hz.body).ok === true, 'healthz reports ok');
  assert((hz.headers['cache-control'] || '') === 'no-store', 'healthz is no-store');

  /* 6 — path traversal on static handler (raw path, no client normalization) */
  const traversal = await fetchRaw('/../server.js');
  assert(traversal.status === 403 || traversal.status === 404, 'path traversal blocked');
  assert(!traversal.body.includes('PROXIES'), 'server source not leaked via traversal');

  /* 7 — sitemap covers every public route */
  const sitemap = await fetchRaw('/sitemap.xml');
  assert(sitemap.status === 200 && (sitemap.headers['content-type'] || '').includes('xml'), 'sitemap served as XML');
  const missing = PUBLIC_ROUTES.filter((r) => !sitemap.body.includes(`>${r}<`));
  assert(missing.length === 0, `sitemap covers all ${PUBLIC_ROUTES.length} public routes`, `missing: ${missing.join(', ')}`);
  assert(!sitemap.body.includes('/settings') && !sitemap.body.includes('/history'), 'sitemap excludes personal pages');

  /* 8 — manifest + offline page */
  const manifest = await fetchRaw('/manifest.webmanifest');
  assert(manifest.status === 200 && (manifest.headers['content-type'] || '').includes('manifest+json'), 'manifest served with correct MIME');
  const offline = await fetchRaw('/offline.html');
  assert(offline.status === 200 && offline.body.includes('CULINA'), 'branded offline page served');

  /* 9 — X-Robots-Tag on app-internal routes */
  for (const p of ['/settings', '/history', '/favorites', '/offline']) {
    const res = await fetchRaw(p);
    assert((res.headers['x-robots-tag'] || '').includes('noindex'), `${p} sends X-Robots-Tag noindex`);
  }
  const indexed = await fetchRaw('/recipes');
  assert(indexed.headers['x-robots-tag'] === undefined, 'public routes are indexable (no header)');

  /* 10 — brand asset system (approved identity) */
  const ROOT = join(new URL('..', import.meta.url).pathname, '.');
  const pngSize = (buf) => ({ w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) });

  const brandSvgs = [
    '/brand/culina-mark.svg', '/brand/culina-mark-tile.svg', '/brand/culina-wordmark.svg',
    '/brand/culina-logo.svg', '/brand/culina-logo-dark.svg', '/brand/culina-logo-light.svg',
    '/icons/favicon.svg',
  ];
  for (const p of brandSvgs) {
    const res = await fetchRaw(p);
    assert(res.status === 200 && (res.headers['content-type'] || '').includes('svg'), `${p} served as SVG`);
  }

  const pngAssets = [
    ['/favicon-16.png', 16, 16], ['/favicon-32.png', 32, 32], ['/favicon-64.png', 64, 64],
    ['/icons/icon-192.png', 192, 192], ['/icons/icon-512.png', 512, 512],
    ['/icons/icon-maskable-512.png', 512, 512], ['/icons/apple-touch-icon.png', 180, 180],
    ['/social/og-image.png', 1200, 630], ['/social/twitter-card.png', 1200, 628],
  ];
  for (const [p, w, h] of pngAssets) {
    const res = await fetchBuffer(p);
    const isPng = res.headers['content-type']?.includes('png');
    const sizeOk =
      res.status === 200 && isPng && res.buf.length > 8 &&
      res.buf.readUInt32BE(0) === 0x89504e47 && pngSize(res.buf).w === w && pngSize(res.buf).h === h;
    assert(res.status === 200 && isPng && sizeOk, `${p} served as ${w}×${h} PNG`);
  }

  /* canonical brand sources are byte-identical everywhere they are mirrored */
  for (const name of ['culina-mark.svg', 'culina-mark-tile.svg', 'culina-wordmark.svg', 'culina-logo.svg', 'culina-logo-dark.svg', 'culina-logo-light.svg']) {
    const assets = readFileSync(join(ROOT, 'assets/brand', name), 'utf8');
    const pub = readFileSync(join(ROOT, 'public/brand', name), 'utf8');
    assert(assets === pub, `assets/brand/${name} mirrors public/brand byte-for-byte`);
  }
  const tileSvg = readFileSync(join(ROOT, 'assets/brand/culina-mark-tile.svg'), 'utf8').trim();
  const markModule = readFileSync(join(ROOT, 'js/components/mark-tile.js'), 'utf8');
  assert(markModule.includes(tileSvg), 'js/components/mark-tile.js embeds the canonical tile');

  /* manifest carries the real brand icons + colors */
  const mf = JSON.parse((await fetchRaw('/manifest.webmanifest')).body);
  assert(mf.theme_color === '#0b0f19' && mf.background_color === '#fff7e6', 'manifest uses brand Midnight/Cream');
  for (const ic of mf.icons) {
    // icon srcs are relative to the manifest (deployment-agnostic)
    const iconPath = new URL(ic.src, `${BASE}/manifest.webmanifest`).pathname;
    const res = await fetchRaw(iconPath);
    assert(res.status === 200, `manifest icon ${ic.src} resolves`);
  }

  /* index.html favicon + social meta wiring */
  const shellHome = await fetchRaw('/');
  assert(shellHome.body.includes('rel="icon" type="image/svg+xml"'), 'SVG favicon linked');
  assert(shellHome.body.includes('favicon-16.png') && shellHome.body.includes('favicon-32.png'), 'PNG favicons linked');
  assert(shellHome.body.includes('summary_large_image'), 'Twitter large-image card declared');
  assert(shellHome.body.includes('/social/og-image.png'), 'OG image referenced');
} finally {
  child.kill('SIGTERM');
}

console.log(`\n── Gateway: ${passed} passed, ${failed} failed ──\n`);
process.exit(failed ? 1 : 0);
