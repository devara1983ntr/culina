/**
 * Open Food Facts adapter — https://openfoodfacts.org
 * Verified 2026-09-02: DIRECT, CORS *. Text search (cgi) intermittently
 * returns 503 maintenance pages under load — retried with backoff and surfaced
 * as a partial-degradation state, never as fake data. Barcode lookup is stable.
 * Data license: ODbL 1.0 (attribution required — shown in product UI).
 */
import { apiRequest } from '../client.js';
import { assertObject } from '../errors.js';
import { normalizeProduct } from '../normalizer.js';
import { N } from '../../utils/format.js';

const P = 'openfoodfacts';

const SEARCH_FIELDS = [
  'code',
  'product_name',
  'product_name_en',
  'generic_name',
  'brands',
  'image_front_small_url',
  'image_url',
  'quantity',
  'serving_size',
  'serving_quantity',
  'categories',
  'ingredients_text',
  'labels_tags',
  'nutriscore_grade',
  'nova_group',
  'nutriments',
].join(',');

export const openfoodfacts = {
  providerId: P,

  /**
   * Full-text product search (provider's documented text-search endpoint).
   * @returns {Promise<{products: Array, count: number|null, page: number}>}
   */
  async search(q, { page = 1, pageSize = 24, signal } = {}) {
    const { data } = await apiRequest({
      provider: P,
      path: '/cgi/search.pl',
      params: {
        search_terms: q,
        search_simple: 1,
        action: 'process',
        json: 1,
        page,
        page_size: pageSize,
        fields: SEARCH_FIELDS,
      },
      signal,
      ttl: 10 * 60_000,
      retries: 2,
      timeout: 12_000,
    });
    assertObject(data, P);
    const products = (data.products || [])
      .filter((p) => p && p.code)
      .map((p) => normalizeProduct(p, p.code));
    return { products, count: N(data.count), page: N(data.page) || page };
  },

  /** Product by barcode — the most reliable OFF endpoint. */
  async product(code, { signal } = {}) {
    const { data } = await apiRequest({
      provider: P,
      path: `/api/v2/product/${encodeURIComponent(code)}.json`,
      params: { fields: '*' },
      signal,
      ttl: 30 * 60_000,
      retries: 1,
      timeout: 10_000,
    });
    assertObject(data, P);
    if (data.status === 0 || !data.product) return null;
    return normalizeProduct(data.product, code);
  },

  async diagnostic() {
    await this.product('3017620422003');
  },
};
