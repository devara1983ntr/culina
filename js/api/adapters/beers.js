/**
 * SampleAPIs Beers adapter — https://sampleapis.com/api-list/beers
 * Verified 2026-09-02: DIRECT, CORS *, keyless. Only /ale and /stouts respond
 * (other category endpoints 404). Community dataset — commercial fields like
 * ABV/brewery are not provided and are never fabricated.
 * This source replaces PunkAPI (offline, see registry).
 */
import { apiRequest } from '../client.js';
import { assertArray } from '../errors.js';
import { normalizeBeer } from '../normalizer.js';

const P = 'sampleapis-beers';
const TTL = 24 * 60 * 60_000;

export const beers = {
  providerId: P,

  async ales({ signal } = {}) {
    const { data } = await apiRequest({ provider: P, path: '/ale', signal, ttl: TTL });
    assertArray(data, P);
    return data.filter((b) => b && b.name).map((b) => normalizeBeer(b, 'Ale'));
  },

  async stouts({ signal } = {}) {
    const { data } = await apiRequest({ provider: P, path: '/stouts', signal, ttl: TTL });
    assertArray(data, P);
    return data.filter((b) => b && b.name).map((b) => normalizeBeer(b, 'Stout'));
  },

  async all({ signal } = {}) {
    const [ales, stouts] = await Promise.allSettled([this.ales({ signal }), this.stouts({ signal })]);
    return {
      ales: ales.status === 'fulfilled' ? ales.value : [],
      stouts: stouts.status === 'fulfilled' ? stouts.value : [],
      failures: [ales, stouts].filter((r) => r.status === 'rejected').map((r) => r.reason),
    };
  },

  async diagnostic() {
    await this.ales();
  },
};
