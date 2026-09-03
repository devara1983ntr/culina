/**
 * CULINA — API client tests (PRD §18–§20): timeout, retry, error mapping,
 * cache and in-flight dedupe. fetch is mocked per test.
 */
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { apiRequest } from '../js/api/client.js';
import { ApiError, ErrorType } from '../js/api/errors.js';

let calls;

function jsonResponse(data, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (h) => (String(h).toLowerCase() === 'content-type' ? 'application/json' : null) },
    json: async () => data,
  };
}

beforeEach(() => {
  calls = [];
});

test('apiRequest returns parsed data with status and latency', async () => {
  globalThis.fetch = async (url) => {
    calls.push(url);
    return jsonResponse({ meals: [{ idMeal: '1' }] });
  };
  const res = await apiRequest({ provider: 'mealdb', path: '/api/json/v1/1/search.php', params: { s: 'soup' } });
  assert.equal(res.fromCache, false);
  assert.equal(res.status, 200);
  assert.deepEqual(res.data.meals, [{ idMeal: '1' }]);
  assert.equal(calls.length, 1);
  assert.ok(calls[0].includes('themealdb.com'));
});

test('404 maps to HTTP_ERROR and is NOT retried', async () => {
  globalThis.fetch = async () => {
    calls.push(1);
    return jsonResponse(null, 404);
  };
  await assert.rejects(
    apiRequest({ provider: 'mealdb', path: '/x', retries: 3 }),
    (err) => err instanceof ApiError && err.type === ErrorType.HTTP && err.retryable === false,
  );
  assert.equal(calls.length, 1, '404 must not be retried');
});

test('401 maps to AUTH_ERROR and is not retried', async () => {
  globalThis.fetch = async () => {
    calls.push(1);
    return jsonResponse(null, 401);
  };
  await assert.rejects(
    apiRequest({ provider: 'mealdb', path: '/x' }),
    (err) => err instanceof ApiError && err.type === ErrorType.AUTH,
  );
  assert.equal(calls.length, 1);
});

test('429 is retried and can recover', async () => {
  globalThis.fetch = async () => {
    calls.push(1);
    if (calls.length === 1) return jsonResponse(null, 429);
    return jsonResponse({ ok: true });
  };
  const res = await apiRequest({ provider: 'mealdb', path: '/x', retries: 1 });
  assert.equal(res.status, 200);
  assert.deepEqual(res.data, { ok: true });
  assert.equal(calls.length, 2, 'exactly one retry');
});

test('5xx is retryable; exhausted retries throw HTTP_ERROR', async () => {
  globalThis.fetch = async () => {
    calls.push(1);
    return jsonResponse(null, 503);
  };
  await assert.rejects(
    apiRequest({ provider: 'openfoodfacts', path: '/x', retries: 1 }),
    (err) => err instanceof ApiError && err.type === ErrorType.HTTP && err.status === 503,
  );
  assert.equal(calls.length, 2);
});

test('timeout aborts the request and maps to TIMEOUT', async () => {
  globalThis.fetch = (url, init) =>
    new Promise((resolve, reject) => {
      calls.push(1);
      init.signal.addEventListener('abort', () => reject(init.signal.reason));
    });
  await assert.rejects(
    apiRequest({ provider: 'mealdb', path: '/slow', timeout: 40, retries: 0 }),
    (err) => err instanceof ApiError && err.type === ErrorType.TIMEOUT,
  );
  assert.equal(calls.length, 1);
});

test('invalid JSON maps to INVALID_RESPONSE', async () => {
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    headers: { get: () => 'text/html' },
    json: async () => {
      throw new SyntaxError('Unexpected token');
    },
  });
  await assert.rejects(
    apiRequest({ provider: 'mealdb', path: '/x' }),
    (err) => err instanceof ApiError && err.type === ErrorType.INVALID_RESPONSE,
  );
});

test('disabled provider is rejected before any fetch', async () => {
  let fetched = false;
  globalThis.fetch = async () => {
    fetched = true;
    return jsonResponse({});
  };
  await assert.rejects(
    apiRequest({ provider: 'spoonacular', path: '/x' }),
    (err) => err instanceof ApiError && err.type === ErrorType.PROVIDER_UNAVAILABLE,
  );
  assert.equal(fetched, false, 'no network request for disabled providers');
});

test('PROXY_REQUIRED provider resolves through the gateway path', async () => {
  globalThis.fetch = async (url) => {
    calls.push(url);
    return jsonResponse([]);
  };
  await apiRequest({ provider: 'fruityvice', path: '/api/fruit/all' });
  assert.ok(calls[0].startsWith('http://localhost/api/fruityvice'), `expected gateway URL, got ${calls[0]}`);
});

test('in-flight dedupe: identical parallel requests hit the network once', async () => {
  let pending;
  globalThis.fetch = () => {
    calls.push(1);
    return new Promise((resolve) => {
      pending = () => resolve(jsonResponse({ a: 1 }));
    });
  };
  const first = apiRequest({ provider: 'mealdb', path: '/same' });
  const second = apiRequest({ provider: 'mealdb', path: '/same' });
  pending();
  const [a, b] = await Promise.all([first, second]);
  assert.equal(calls.length, 1, 'dedupe must collapse parallel identical requests');
  assert.deepEqual(a.data, b.data);
});

test('ttl cache: second identical request served from cache', async () => {
  globalThis.fetch = async () => {
    calls.push(1);
    return jsonResponse({ cached: false });
  };
  const first = await apiRequest({ provider: 'mealdb', path: '/cached', ttl: 60000 });
  const second = await apiRequest({ provider: 'mealdb', path: '/cached', ttl: 60000 });
  assert.equal(first.fromCache, false);
  assert.equal(second.fromCache, true);
  assert.equal(second.latencyMs, 0);
  assert.equal(calls.length, 1);
});

test('distinct params are distinct cache keys', async () => {
  globalThis.fetch = async () => jsonResponse({ ok: 1 });
  await apiRequest({ provider: 'mealdb', path: '/p', params: { s: 'a' }, ttl: 60000 });
  await apiRequest({ provider: 'mealdb', path: '/p', params: { s: 'b' }, ttl: 60000 });
  const hit = await apiRequest({ provider: 'mealdb', path: '/p', params: { s: 'a' }, ttl: 60000 });
  assert.equal(hit.fromCache, true);
});
