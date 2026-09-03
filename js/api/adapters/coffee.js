/**
 * SampleAPIs Coffee adapter — https://sampleapis.com/api-list/coffee
 * Verified 2026-09-02: DIRECT, CORS *, keyless. Community dataset (labeled as
 * such in the UI); hot & iced guides with ingredients and photography.
 */
import { apiRequest } from '../client.js';
import { assertArray } from '../errors.js';
import { normalizeCoffee } from '../normalizer.js';

const P = 'sampleapis-coffee';
const TTL = 24 * 60 * 60_000;

export const coffee = {
  providerId: P,

  async hot({ signal } = {}) {
    const { data } = await apiRequest({ provider: P, path: '/hot', signal, ttl: TTL });
    assertArray(data, P);
    return data.filter((c) => c && c.title).map((c) => normalizeCoffee(c, 'hot'));
  },

  async iced({ signal } = {}) {
    const { data } = await apiRequest({ provider: P, path: '/iced', signal, ttl: TTL });
    assertArray(data, P);
    return data.filter((c) => c && c.title).map((c) => normalizeCoffee(c, 'iced'));
  },

  async all({ signal } = {}) {
    const [hot, iced] = await Promise.all([this.hot({ signal }), this.iced({ signal })]);
    return { hot, iced };
  },

  async diagnostic() {
    await this.hot();
  },
};
