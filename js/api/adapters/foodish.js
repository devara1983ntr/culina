/**
 * Foodish adapter — https://foodish-api.com
 * Verified 2026-09-02: DIRECT, CORS *. Random food photography only
 * (the provider removed category endpoints — see registry notes).
 */
import { apiRequest } from '../client.js';
import { assertObject } from '../errors.js';
import { safeUrl } from '../../utils/format.js';

const P = 'foodish';

export const foodish = {
  providerId: P,

  /** @returns {Promise<{image: string|null, source: 'foodish'}>} */
  async randomImage({ signal } = {}) {
    const { data } = await apiRequest({ provider: P, path: '/api/', signal, ttl: 60_000 });
    assertObject(data, P);
    return { image: safeUrl(data.image), source: P };
  },

  async diagnostic() {
    await this.randomImage();
  },
};
