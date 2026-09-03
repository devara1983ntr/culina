/**
 * Fruityvice adapter — https://www.fruityvice.com/api
 * Verified 2026-09-02: live and healthy, but the API sends no CORS headers,
 * so browser calls are blocked. Classified PROXY_REQUIRED: requests are routed
 * through the same-origin gateway (/api/fruityvice → www.fruityvice.com),
 * implemented by server.js in production and the vite proxy in dev.
 */
import { apiRequest } from '../client.js';
import { assertArray, assertObject } from '../errors.js';
import { normalizeFruit } from '../normalizer.js';

const P = 'fruityvice';
const TTL_TAXONOMY = 24 * 60 * 60_000;

export const fruityvice = {
  providerId: P,

  async listFruits({ signal } = {}) {
    const { data } = await apiRequest({ provider: P, path: '/api/fruit/all', signal, ttl: TTL_TAXONOMY });
    assertArray(data, P);
    return data.filter((f) => f && f.id != null).map(normalizeFruit);
  },

  async fruitById(id, { signal } = {}) {
    const { data } = await apiRequest({
      provider: P,
      path: `/api/fruit/${encodeURIComponent(id)}`,
      signal,
      ttl: TTL_TAXONOMY,
    });
    assertObject(data, P);
    return normalizeFruit(data);
  },

  async diagnostic() {
    await this.fruitById(1);
  },
};
