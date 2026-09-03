/**
 * CULINA — Centralized HTTP client (PRD §18–§20, §56).
 * One request path for every provider:
 *   URL resolution (direct vs gateway proxy) → cache → in-flight dedupe →
 *   timeout (AbortController) → retry w/ backoff (GET only) →
 *   response validation → health telemetry → normalized errors.
 */
import { ApiError, ErrorType, normalizeError } from './errors.js';
import { cache } from './cache.js';
import { getProvider } from './registry.js';
import { recordRequest } from './health.js';

const inflight = new Map();
const DEFAULT_TIMEOUT = 9000;
const DEV = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.DEV : false;

const ORIGIN = typeof location !== 'undefined' ? location.origin : 'http://localhost';

function stableParams(params = {}) {
  return Object.entries(params)
    .filter(([, v]) => v !== null && v !== undefined && v !== '')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${String(v)}`)
    .join('&');
}

/** Resolve a provider path to its request URL (gateway-aware, PRD §72). */
export function resolveUrl(providerId, path, params = {}) {
  const provider = getProvider(providerId);
  if (!provider) {
    throw new ApiError({ type: ErrorType.UNKNOWN, provider: providerId, message: `Unknown provider "${providerId}"` });
  }
  const base = provider.classification === 'PROXY_REQUIRED' ? provider.proxyPath || `/api/${providerId}` : provider.baseUrl;
  const url = new URL(base + path, ORIGIN);
  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== undefined && value !== '') url.searchParams.set(key, String(value));
  }
  return url.toString();
}

function errorFromStatus(status, providerId) {
  if (status === 401 || status === 403) {
    return new ApiError({ type: ErrorType.AUTH, provider: providerId, status, message: `Authentication required (${status})`, retryable: false });
  }
  if (status === 429) {
    return new ApiError({ type: ErrorType.RATE_LIMIT, provider: providerId, status, message: 'Rate limited by provider', retryable: true });
  }
  if (status === 404) {
    return new ApiError({ type: ErrorType.HTTP, provider: providerId, status, message: 'Not found', retryable: false });
  }
  if (status >= 500) {
    return new ApiError({ type: ErrorType.HTTP, provider: providerId, status, message: `Provider error (${status})`, retryable: true });
  }
  return new ApiError({ type: ErrorType.HTTP, provider: providerId, status, message: `HTTP error (${status})`, retryable: false });
}

/** fetch with a hard timeout, composable with an external abort signal. */
async function attemptFetch(url, { timeout, signal }) {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort(new DOMException('Request timed out', 'TimeoutError'));
  }, timeout);

  const forwardAbort = () => {
    controller.abort(signal.reason instanceof Error ? signal.reason : new DOMException('Aborted', 'AbortError'));
  };
  if (signal) {
    if (signal.aborted) {
      clearTimeout(timer);
      throw signal.reason instanceof Error ? signal.reason : new DOMException('Aborted', 'AbortError');
    }
    signal.addEventListener('abort', forwardAbort, { once: true });
  }

  try {
    return await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      headers: { accept: 'application/json' },
      mode: 'cors',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
    });
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener('abort', forwardAbort);
  }
}

/** Exponential backoff that respects aborts. */
function backoff(attempt, signal) {
  const delay = 320 * 2 ** attempt + Math.random() * 180;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, delay);
    if (signal) {
      const onAbort = () => {
        clearTimeout(timer);
        reject(signal.reason instanceof Error ? signal.reason : new DOMException('Aborted', 'AbortError'));
      };
      if (signal.aborted) return onAbort();
      signal.addEventListener('abort', onAbort, { once: true });
    }
  });
}

async function parseJson(res, providerId) {
  try {
    return await res.json();
  } catch (err) {
    throw new ApiError({
      type: ErrorType.INVALID_RESPONSE,
      provider: providerId,
      status: res.status,
      message: 'Response was not valid JSON',
      retryable: false,
      cause: err,
    });
  }
}

/**
 * @param {{provider: string, path: string, params?: object, signal?: AbortSignal,
 *          timeout?: number, retries?: number, ttl?: number, cacheKey?: string}} options
 * @returns {Promise<{data: any, fromCache: boolean, latencyMs: number, status: number}>}
 */
export async function apiRequest(options) {
  const { provider: providerId, path, params = {}, signal, timeout = DEFAULT_TIMEOUT, ttl = 0, cacheKey } = options;
  const provider = getProvider(providerId);
  if (!provider) {
    throw new ApiError({ type: ErrorType.UNKNOWN, provider: providerId, message: `Unknown provider "${providerId}"` });
  }
  if (!provider.enabled) {
    throw new ApiError({
      type: ErrorType.PROVIDER_UNAVAILABLE,
      provider: providerId,
      message: `${provider.name} is disabled: ${provider.notes || 'not enabled in this deployment'}`,
      retryable: false,
    });
  }

  const retries = Math.max(0, Math.min(options.retries ?? 1, 3));
  const key = cacheKey ?? `${providerId}:${path}:${stableParams(params)}`;
  const url = resolveUrl(providerId, path, params);

  // 1) Cache
  if (ttl > 0) {
    const hit = cache.get(key);
    if (hit !== undefined) {
      if (DEV) console.info(`[api] ${providerId}${path} ← cache (${cache.stats().hitRate !== null ? Math.round(cache.stats().hitRate * 100) + '% hit rate' : ''})`);
      return { data: hit, fromCache: true, latencyMs: 0, status: 200 };
    }
  }

  // 2) In-flight dedupe
  if (inflight.has(key)) return inflight.get(key);

  const exec = (async () => {
    const started = typeof performance !== 'undefined' ? performance.now() : Date.now();
    let lastError;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const res = await attemptFetch(url, { timeout, signal });

        if (!res.ok) {
          const err = errorFromStatus(res.status, providerId);
          if (err.retryable && attempt < retries) {
            lastError = err;
            await backoff(attempt, signal);
            continue;
          }
          const ms = Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - started);
          recordRequest(providerId, { ok: false, ms, status: res.status, error: err });
          if (DEV) console.warn(`[api] ${providerId}${path} → ${res.status} (${ms}ms)`);
          throw err;
        }

        const data = await parseJson(res, providerId);
        const ms = Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - started);
        recordRequest(providerId, { ok: true, ms, status: res.status });
        if (ttl > 0) cache.set(key, data, ttl);
        if (DEV) console.info(`[api] ${providerId}${path} → 200 (${ms}ms)`);
        return { data, fromCache: false, latencyMs: ms, status: res.status };
      } catch (err) {
        // Caller canceled (navigation / obsolete search) — propagate silently.
        if (err?.name === 'AbortError') throw err;

        // Errors this client already normalized (HTTP status mapping) pass
        // through untouched — recordRequest already ran for them.
        const isWrapped = err instanceof ApiError;
        const apiErr = isWrapped ? err : normalizeError(err, providerId);
        if (!apiErr.retryable) {
          if (!isWrapped) recordRequest(providerId, { ok: false, status: apiErr.status ?? null, error: apiErr });
          throw apiErr;
        }
        lastError = apiErr;
        if (attempt < retries) {
          await backoff(attempt, signal);
        } else {
          if (!isWrapped) recordRequest(providerId, { ok: false, status: apiErr.status ?? null, error: apiErr });
          if (DEV) console.warn(`[api] ${providerId}${path} failed after ${attempt + 1} attempts: ${apiErr.type}`);
          throw apiErr;
        }
      }
    }
    throw lastError;
  })();

  inflight.set(key, exec);
  exec.then(
    () => inflight.delete(key),
    () => inflight.delete(key),
  );
  return exec;
}
