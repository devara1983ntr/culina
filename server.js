#!/usr/bin/env node
/**
 * CULINA — production gateway (PRD §74)
 * ------------------------------------------------------------------
 * A zero-dependency Node server that:
 *   1. serves the static production build from ./dist (with SPA fallback)
 *   2. exposes an allowlisted reverse proxy at /api/<provider> for providers
 *      that are CORS-restricted in browsers (currently: Fruityvice).
 *
 * This implements the secret-safe / browser-safe pattern from PRD §72:
 *
 *     Frontend → this server (proxy) → third-party API
 *
 * No API keys, secrets or credentials are involved — the proxied provider is
 * keyless — but the pattern is identical to the one a key-requiring provider
 * would need (keys would live in this process's environment, never in the
 * browser bundle).
 *
 * Usage:  npm run build && npm start     (serves dist/ on $PORT, default 3000)
 */
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const DIST = join(__dirname, 'dist');
const PORT = Number(process.env.PORT || 3000);
const HOST = '0.0.0.0';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml',
};

/**
 * Allowlisted upstream proxies for browser-restricted providers.
 * `allow` is a strict path regex — anything else returns 403.
 */
const PROXIES = {
  fruityvice: {
    origin: 'https://www.fruityvice.com',
    allow: /^\/api\/fruit\/(all|\d+)$/,
    timeoutMs: 12000,
  },
};

/* ------------------------------------------------------------------ *
 * Security headers (gap G-01)
 * - CSP: script hashes are computed from the built index.html at startup
 *   so the pre-paint theme bootstrap (the only inline script) stays
 *   allowed across rebuilds. Everything else must come from 'self'.
 * - connect-src is exactly the enabled DIRECT provider origins plus
 *   'self' (the allowlisted same-origin proxy).
 * - microphone is deliberately NOT restricted: voice search uses the
 *   SpeechRecognition API (feature-detected, home page).
 * - HSTS is only sent when the request actually arrived over https
 *   (directly or behind the operator's TLS-terminating proxy).
 * ------------------------------------------------------------------ */
const CONNECT_ORIGINS = [
  'https://www.themealdb.com',
  'https://www.thecocktaildb.com',
  'https://foodish-api.com',
  'https://api.openbrewerydb.org',
  'https://world.openfoodfacts.org',
  'https://api.sampleapis.com',
];

async function buildCsp() {
  let scriptHashes = [];
  try {
    const html = await readFile(join(DIST, 'index.html'), 'utf8');
    scriptHashes = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)]
      .map((m) => createHash('sha256').update(m[1], 'utf8').digest('base64'));
  } catch {
    console.warn('[gateway] dist/index.html not readable — CSP built without inline-script hashes');
  }
  return [
    "default-src 'self'",
    `script-src 'self'${scriptHashes.map((h) => ` 'sha256-${h}'`).join('')}`,
    "style-src 'self' 'unsafe-inline'", // developer-authored styles only (no user content is ever styled by data)
    "img-src 'self' https: data:", // provider imagery (https), CSS chevron (data:)
    `connect-src 'self' ${CONNECT_ORIGINS.join(' ')}`,
    "font-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ');
}

let CSP = '';

/* App-internal surfaces: excluded from indexes at the server layer so even
   non-JS crawlers see it (the client also sets <meta name="robots"> on SPA
   navigation — gap G-06). Content is personal/local; nothing to index. */
const NOINDEX_PATHS = new Set(['/settings', '/history', '/favorites', '/offline']);

function applySecurityHeaders(req, res) {
  if (CSP) res.setHeader('Content-Security-Policy', CSP);
  const rawPath = (req.url || '').split('?')[0].replace(/\/+$/, '') || '/';
  if (NOINDEX_PATHS.has(rawPath)) res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), geolocation=(), payment=(), usb=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  const proto = req.socket?.encrypted
    ? 'https'
    : String(req.headers['x-forwarded-proto'] || 'http').split(',')[0].trim();
  if (proto === 'https') res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
}

function send(res, status, body, headers = {}) {
  if (res.headersSent) {
    res.end();
    return;
  }
  // setHeader (not a writeHead object) so security headers set earlier are merged, not replaced
  for (const [key, value] of Object.entries(headers)) res.setHeader(key, value);
  res.writeHead(status);
  res.end(body);
}

function sendJson(res, status, obj) {
  send(res, status, JSON.stringify(obj), {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
}

async function proxyRequest(providerId, req, res) {
  const conf = PROXIES[providerId];
  if (!conf) return sendJson(res, 404, { error: 'PROVIDER_NOT_PROXIED', provider: providerId });
  if (req.method !== 'GET') return sendJson(res, 405, { error: 'METHOD_NOT_ALLOWED' });

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const path = decodeURIComponent(url.pathname).replace(/^\/api\/[^/]+/, '');

  if (!conf.allow.test(path)) {
    return sendJson(res, 403, { error: 'PATH_NOT_ALLOWED', path });
  }

  const upstream = conf.origin + path;
  const started = Date.now();
  try {
    const upstreamRes = await fetch(upstream, {
      method: 'GET',
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(conf.timeoutMs),
    });
    const body = Buffer.from(await upstreamRes.arrayBuffer());
    const contentType = upstreamRes.headers.get('content-type') || 'application/json';
    console.log(`[proxy] ${providerId} ${path} → ${upstreamRes.status} (${Date.now() - started}ms)`);
    send(res, upstreamRes.status, body, {
      'content-type': contentType,
      'cache-control': 'public, max-age=600',
      'x-culina-proxy': providerId,
    });
  } catch (err) {
    const isTimeout = err?.name === 'TimeoutError' || err?.name === 'AbortError';
    console.warn(`[proxy] ${providerId} ${path} failed: ${err?.message}`);
    sendJson(res, isTimeout ? 504 : 502, {
      error: isTimeout ? 'UPSTREAM_TIMEOUT' : 'UPSTREAM_ERROR',
      provider: providerId,
    });
  }
}

async function serveStatic(pathname, res) {
  const clean = normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, '');
  const filePath = join(DIST, clean);

  // Path-traversal guard
  if (!filePath.startsWith(DIST)) return sendJson(res, 403, { error: 'FORBIDDEN' });

  let fileStat;
  try {
    fileStat = await stat(filePath);
    if (!fileStat.isFile()) throw new Error('not a file');
  } catch {
    // SPA fallback — client-side routes (/recipes, /cocktail/11007, …)
    const isAsset = extname(clean) !== '';
    if (isAsset) return send(res, 404, 'Not found', { 'content-type': 'text/plain' });
    const index = await readFile(join(DIST, 'index.html'));
    return send(res, 200, index, {
      'content-type': MIME['.html'],
      'cache-control': 'no-cache',
    });
  }

  const ext = extname(filePath).toLowerCase();
  const type = MIME[ext] || 'application/octet-stream';
  const isHashedAsset = pathname.startsWith('/assets/');
  const isShell = ext === '.html' || pathname === '/sw.js' || pathname === '/manifest.webmanifest';

  const body = res.req?.method === 'HEAD' ? undefined : await readFile(filePath);
  send(res, 200, body, {
    'content-type': type,
    'cache-control': isHashedAsset
      ? 'public, max-age=31536000, immutable'
      : isShell
        ? 'no-cache'
        : 'public, max-age=3600',
  });
}

const server = createServer(async (req, res) => {
  applySecurityHeaders(req, res);
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = url.pathname;

    if (pathname === '/healthz') {
      return sendJson(res, 200, { ok: true, uptime: process.uptime(), service: 'culina-gateway' });
    }
    if (pathname.startsWith('/api/')) {
      return proxyRequest(pathname.split('/')[2], req, res);
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return sendJson(res, 405, { error: 'METHOD_NOT_ALLOWED' });
    }
    await serveStatic(pathname, res);
  } catch (err) {
    console.error('[gateway] unhandled error:', err);
    sendJson(res, 500, { error: 'INTERNAL_ERROR' });
  }
});

CSP = await buildCsp();

server.listen(PORT, HOST, () => {
  console.log(`CULINA gateway listening on http://${HOST}:${PORT}`);
  console.log(`  · static build: ${DIST}`);
  console.log(`  · proxied providers: ${Object.keys(PROXIES).join(', ')}`);
});
