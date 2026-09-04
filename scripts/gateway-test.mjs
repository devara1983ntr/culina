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

  /* 10 — brand asset system (traced from the approved board, v1.2.0) */
  const ROOT = join(new URL('..', import.meta.url).pathname, '.');
  const pngSize = (buf) => ({ w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) });
  const { readdirSync, statSync } = await import('node:fs');

  /* every canonical vector asset is served as a valid SVG */
  const vectorDir = join(ROOT, 'assets/brand/vector');
  const brandSvgs = readdirSync(vectorDir).filter((f) => f.endsWith('.svg'));
  assert(brandSvgs.length >= 13, `vector family complete (${brandSvgs.length} SVGs)`);
  for (const name of brandSvgs) {
    const res = await fetchRaw(`/brand/${name}`);
    const ct = res.headers['content-type'] || '';
    assert(res.status === 200 && ct.includes('svg'), `/brand/${name} served as SVG`);
    const body = res.body.trim();
    assert(!body.includes('<image'), `/brand/${name} embeds no raster (traced vectors only)`);
    assert(body.startsWith('<svg') && body.includes('viewBox=') && body.endsWith('</svg>'),
      `/brand/${name} is a valid standalone SVG (viewBox + single root)`);
    const assets = readFileSync(join(vectorDir, name), 'utf8');
    assert(assets === res.body, `/brand/${name} byte-identical to the canonical vector asset`);
    const pub = readFileSync(join(ROOT, 'public/brand', name), 'utf8');
    assert(assets === pub, `assets/brand/vector/${name} mirrors public/brand byte-for-byte`);
  }
  assert((await fetchRaw('/icons/favicon.svg')).status === 200, 'favicon.svg served');

  /* favicon set: ICO + 16/32/48 PNGs (favicon-64 is retired) */
  const ico = await fetchBuffer('/favicon.ico');
  const icoOk = ico.status === 200 && ico.buf.length > 8 && ico.buf.readUInt16LE(0) === 0 &&
    ico.buf.readUInt16LE(2) === 1;
  let icoFrames = [];
  if (icoOk) {
    const n = ico.buf.readUInt16LE(4);
    for (let i = 0; i < n && i < 16; i++) {
      const e = ico.buf.subarray(6 + i * 16, 6 + (i + 1) * 16);
      icoFrames.push([e[0] || 256, e[1] || 256, e.readUInt32LE(8)]);
    }
  }
  assert(icoOk && icoFrames.length === 3 &&
    icoFrames.every(([w, h]) => [16, 32, 48].includes(w) && w === h),
    '/favicon.ico is a 3-frame ICO (16/32/48)');
  const pngAssets = [
    ['/favicon-16.png', 16, 16], ['/favicon-32.png', 32, 32], ['/favicon-48.png', 48, 48],
    ['/icons/icon-192.png', 192, 192], ['/icons/icon-512.png', 512, 512],
    ['/icons/icon-maskable-192.png', 192, 192], ['/icons/icon-maskable-512.png', 512, 512],
    ['/icons/apple-touch-icon.png', 180, 180],
    ['/social/og-image.png', 1200, 630], ['/social/twitter-card.png', 1200, 628],
    ['/brand/culina-logo-dark.png', 512, 456], ['/brand/culina-logo-light.png', 512, 426],
  ];
  for (const [p, w, h] of pngAssets) {
    const res = await fetchBuffer(p);
    const isPng = res.headers['content-type']?.includes('png');
    const sizeOk =
      res.status === 200 && isPng && res.buf.length > 8 &&
      res.buf.readUInt32BE(0) === 0x89504e47 && pngSize(res.buf).w === w && pngSize(res.buf).h === h;
    assert(res.status === 200 && isPng && sizeOk, `${p} served as ${w}×${h} PNG`);
  }
  assert((await fetchRaw('/favicon-64.png')).status !== 200, 'retired favicon-64.png is gone');

  /* canonical raster mirrors (assets/brand ↔ public/) are byte-identical */
  const mirrorPairs = [];
  for (const f of readdirSync(join(ROOT, 'assets/brand/favicon')))
    mirrorPairs.push([`assets/brand/favicon/${f}`, f === 'favicon.svg' ? `icons/${f}` : f]);
  for (const f of readdirSync(join(ROOT, 'assets/brand/pwa')))
    mirrorPairs.push([`assets/brand/pwa/${f}`, `icons/${f}`]);
  for (const f of readdirSync(join(ROOT, 'assets/brand/social')))
    mirrorPairs.push([`assets/brand/social/${f}`, `social/${f}`]);
  for (const [a, pubPath] of mirrorPairs) {
    const A = readFileSync(join(ROOT, a));
    const B = readFileSync(join(ROOT, 'public', pubPath));
    assert(A.equals(B), `${a} mirrors public/${pubPath} byte-for-byte`);
  }
  /* icon family (all 14 sizes exist as square PNGs) */
  const iconSizes = [512, 384, 256, 192, 180, 152, 144, 128, 96, 72, 64, 48, 32, 16];
  for (const s of iconSizes) {
    const buf = readFileSync(join(ROOT, `assets/brand/icons/culina-icon-${s}.png`));
    assert(pngSize(buf).w === s && pngSize(buf).h === s, `culina-icon-${s}.png is ${s}×${s}`);
  }

  /* the in-app mark module embeds the canonical tile geometry */
  const tileSvg = readFileSync(join(ROOT, 'assets/brand/vector/culina-mark-tile.svg'), 'utf8');
  const markModule = readFileSync(join(ROOT, 'js/components/mark-tile.js'), 'utf8');
  const tilePaths = [...tileSvg.matchAll(/ d="M [^"]+"/g)].map((m) => m[0]);
  assert(tilePaths.length >= 5, 'canonical tile carries traced paths');
  assert(tilePaths.every((d) => markModule.includes(d)),
    'js/components/mark-tile.js embeds every canonical tile path');

  /* manifest carries the real brand icons + colors */
  const mf = JSON.parse((await fetchRaw('/manifest.webmanifest')).body);
  assert(mf.theme_color === '#0b0f19' && mf.background_color === '#fff7e6', 'manifest uses brand Midnight/Cream');
  assert(mf.icons.some((i) => i.purpose === 'maskable' && i.sizes === '192x192') &&
    mf.icons.some((i) => i.purpose === 'maskable' && i.sizes === '512x512'),
    'manifest carries maskable icons at 192 and 512');
  for (const ic of mf.icons) {
    const iconPath = new URL(ic.src, `${BASE}/manifest.webmanifest`).pathname;
    const res = await fetchRaw(iconPath);
    assert(res.status === 200, `manifest icon ${ic.src} resolves`);
  }

  /* index.html favicon + social meta wiring */
  const shellHome = await fetchRaw('/');
  assert(shellHome.body.includes('rel="icon" type="image/svg+xml"'), 'SVG favicon linked');
  assert(shellHome.body.includes('favicon.ico'), 'ICO favicon linked');
  assert(shellHome.body.includes('favicon-16.png') && shellHome.body.includes('favicon-32.png') &&
    shellHome.body.includes('favicon-48.png'), 'PNG favicons 16/32/48 linked');
  assert(shellHome.body.includes('favicon-64.png') === false, 'no retired favicon references');
  assert(shellHome.body.includes('summary_large_image'), 'Twitter large-image card declared');
  assert(shellHome.body.includes('/social/og-image.png'), 'OG image referenced');

  /* archived v1.1.0 brand assets exist but are referenced by nothing live */
  const archived = readdirSync(join(ROOT, 'assets/brand/archive/v1.1.0'));
  assert(archived.length >= 6, 'v1.1.0 brand assets archived');
  const liveCode = ['index.html', 'public/sw.js', 'public/manifest.webmanifest'];
  for (const f of ['js', 'css', 'scripts']) {
    const dir = join(ROOT, f);
    for (const entry of readdirSync(dir, { recursive: true })) {
      const rel = entry.toString();
      if (/test|qa/.test(rel)) continue; // the QA suites themselves assert on these names
      const fp = join(dir, rel);
      try { if (statSync(fp).isFile()) liveCode.push(fp); } catch { /* skip */ }
    }
  }
  for (const fp of liveCode) {
    const body = readFileSync(fp, 'utf8');
    assert(!body.includes('assets/brand/archive'), `${fp} references no archived assets`);
    assert(!body.includes('favicon-64'), `${fp} references no retired assets`);
  }
} finally {
  child.kill('SIGTERM');
}

console.log(`\n── Gateway: ${passed} passed, ${failed} failed ──\n`);
process.exit(failed ? 1 : 0);
