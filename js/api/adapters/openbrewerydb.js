/**
 * Open Brewery DB adapter — https://www.openbrewerydb.org
 * Verified 2026-09-02: DIRECT, permissive CORS, rate limit 120/window.
 * List results are cached 10 minutes to respect the limit.
 */
import { apiRequest } from '../client.js';
import { assertArray, assertObject } from '../errors.js';
import { normalizeBrewery } from '../normalizer.js';

const P = 'openbrewerydb';

export const openbrewerydb = {
  providerId: P,

  async list({ page = 1, perPage = 24, byType, byCity, byState, byCountry, byName, byPostal, sort, signal } = {}) {
    const { data } = await apiRequest({
      provider: P,
      path: '/breweries',
      params: {
        page,
        per_page: perPage,
        by_type: byType,
        by_city: byCity,
        by_state: byState,
        by_country: byCountry,
        by_name: byName,
        by_postal: byPostal,
        sort: sort || undefined,
      },
      signal,
      ttl: 10 * 60_000,
    });
    assertArray(data, P);
    return data.filter((b) => b && b.id).map(normalizeBrewery);
  },

  async search(q, { signal } = {}) {
    return this.list({ byName: q, perPage: 24, signal });
  },

  /**
   * Exact-name lookup for deep links. Verified 2026-09-03: OBD ignores
   * by_id entirely (returns the unfiltered list), so `by_name` + exact match
   * is the only reliable single-brewery fetch.
   */
  async lookupByName(name, { signal } = {}) {
    const clean = String(name || '').trim();
    if (!clean) return null;
    const list = await this.list({ byName: clean, perPage: 10, signal });
    const lower = clean.toLowerCase();
    return list.find((b) => b.name.toLowerCase() === lower) || null;
  },

  /** Breweries in the same city (related section on the detail page). */
  async byCity(city, { excludeName, signal } = {}) {
    if (!city) return [];
    const list = await this.list({ byCity: city, perPage: 12, signal });
    return excludeName ? list.filter((b) => b.name.toLowerCase() !== String(excludeName).toLowerCase()) : list;
  },

  async meta({ signal } = {}) {
    const { data } = await apiRequest({ provider: P, path: '/breweries/meta', signal, ttl: 60 * 60_000 });
    assertObject(data, P);
    return { total: Number(data.total) || null };
  },

  /** Random brewery: OBD has no /random endpoint — draw a random page (1 request). */
  async random({ signal } = {}) {
    const page = 1 + Math.floor(Math.random() * 220);
    const list = await this.list({ page, perPage: 1, signal });
    return list[0] || null;
  },

  async diagnostic() {
    await this.list({ perPage: 1 });
  },
};
