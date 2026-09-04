/**
 * CULINA — Service worker (PRD §45).
 * - App shell & static assets: cached on demand, hashed assets immutable.
 * - Navigations: network-first → cached page → cached shell → offline page.
 * - Provider data: network-first with a 10-minute TTL cache fallback
 *   (never cached forever — food data changes).
 * - No credentials are ever cached (none exist).
 */
const VERSION = '1.3.0';
const STATIC_CACHE = `culina-static-${VERSION}`;
const DATA_CACHE = 'culina-data-v1';
const DATA_TTL = 10 * 60 * 1000;
const DATA_CACHE_MAX = 120;

/* Deployment-agnostic base: URLs are resolved against the SW scope so the
   same worker serves both a root deployment (gateway) and a sub-path
   deployment (e.g. GitHub Pages project sites). */
const SCOPE = new URL(self.registration.scope);
const ROOT_URL = new URL('./', SCOPE).toString();
const OFFLINE_URL = new URL('./offline.html', SCOPE).toString();
const MANIFEST_URL = new URL('./manifest.webmanifest', SCOPE).toString();
const FAVICON_URL = new URL('./favicon-48.png', SCOPE).toString();

const API_HOSTS = [
  'themealdb.com',
  'thecocktaildb.com',
  'api.openbrewerydb.org',
  'world.openfoodfacts.org',
  'foodish-api.com',
  'api.sampleapis.com',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);
      await Promise.allSettled(
        [ROOT_URL, OFFLINE_URL, MANIFEST_URL, FAVICON_URL].map((url) => cache.add(url)),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((key) => key.startsWith('culina-static-') && key !== STATIC_CACHE).map((key) => caches.delete(key)),
      );
      await trimDataCache();
      await self.clients.claim();
    })(),
  );
});

function isApiRequest(url) {
  if (url.origin === location.origin && url.pathname.startsWith('/api/')) return true;
  return API_HOSTS.some((host) => url.hostname.endsWith(host));
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  /* --- Navigations: network-first with offline fallback ---------------- */
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          return await fetch(request);
        } catch {
          const cachedPage = await caches.match(request);
          if (cachedPage) return cachedPage;
          const shell = await caches.match(ROOT_URL);
          if (shell) return shell;
          const offline = await caches.match(OFFLINE_URL);
          if (offline) return offline;
          return Response.error();
        }
      })(),
    );
    return;
  }

  /* --- Hashed build assets: cache-first (immutable) --------------------- */
  if (url.origin === location.origin && url.pathname.startsWith('/assets/')) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok) {
          const cache = await caches.open(STATIC_CACHE);
          cache.put(request, response.clone());
        }
        return response;
      })(),
    );
    return;
  }

  /* --- Other same-origin: stale-while-revalidate ------------------------ */
  if (url.origin === location.origin) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(request);
        const fresh = fetch(request)
          .then((response) => {
            if (response.ok) {
              caches.open(STATIC_CACHE).then((cache) => cache.put(request, response.clone()));
            }
            return response;
          })
          .catch(() => null);
        return cached || (await fresh) || Response.error();
      })(),
    );
    return;
  }

  /* --- Provider data: network-first, TTL cache fallback ------------------ */
  if (isApiRequest(url)) {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request);
          const contentType = response.headers.get('content-type') || '';
          if (response.ok && contentType.includes('json')) {
            const body = await response.clone().json();
            const cache = await caches.open(DATA_CACHE);
            cache.put(request, new Response(JSON.stringify({ t: Date.now(), data: body }), { headers: { 'content-type': 'application/json' } }));
            trimDataCache();
          }
          return response;
        } catch {
          const cached = await caches.match(request);
          if (cached) {
            try {
              const wrapped = await cached.json();
              if (wrapped && typeof wrapped.t === 'number' && Date.now() - wrapped.t < DATA_TTL) {
                return new Response(JSON.stringify(wrapped.data), { headers: { 'content-type': 'application/json' } });
              }
            } catch {
              /* corrupt entry */
            }
          }
          return Response.error(); // the app's error handling takes over
        }
      })(),
    );
  }
});

async function trimDataCache() {
  try {
    const cache = await caches.open(DATA_CACHE);
    const keys = await cache.keys();
    if (keys.length > DATA_CACHE_MAX) {
      for (const key of keys.slice(0, keys.length - DATA_CACHE_MAX)) {
        await cache.delete(key);
      }
    }
  } catch {
    /* ignore */
  }
}
