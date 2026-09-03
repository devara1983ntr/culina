/**
 * TheMealDB adapter — https://www.themealdb.com/api.php
 * Verified 2026-09-02: DIRECT, CORS *, keyless (community test key documented).
 */
import { apiRequest } from '../client.js';
import { assertObject } from '../errors.js';
import {
  normalizeMeal,
  normalizeMealSummary,
  normalizeCategory,
  normalizeArea,
  normalizeIngredientEntry,
} from '../normalizer.js';

const P = 'mealdb';

const TTL = {
  search: 10 * 60_000,
  filter: 10 * 60_000,
  lookup: 60 * 60_000,
  random: 5 * 60_000,
  taxonomy: 24 * 60 * 60_000,
};

export const mealdb = {
  providerId: P,

  async searchByName(q, { signal } = {}) {
    const { data } = await apiRequest({ provider: P, path: '/search.php', params: { s: q }, signal, ttl: TTL.search });
    assertObject(data, P);
    return (data.meals || []).map(normalizeMeal);
  },

  async filterByIngredient(ingredient, { signal } = {}) {
    const { data } = await apiRequest({ provider: P, path: '/filter.php', params: { i: ingredient }, signal, ttl: TTL.filter });
    assertObject(data, P);
    return (data.meals || []).map(normalizeMealSummary);
  },

  async filterByCategory(category, { signal } = {}) {
    const { data } = await apiRequest({ provider: P, path: '/filter.php', params: { c: category }, signal, ttl: TTL.filter });
    assertObject(data, P);
    return (data.meals || []).map(normalizeMealSummary);
  },

  async filterByArea(area, { signal } = {}) {
    const { data } = await apiRequest({ provider: P, path: '/filter.php', params: { a: area }, signal, ttl: TTL.filter });
    assertObject(data, P);
    return (data.meals || []).map(normalizeMealSummary);
  },

  async lookup(id, { signal } = {}) {
    const { data } = await apiRequest({ provider: P, path: '/lookup.php', params: { i: id }, signal, ttl: TTL.lookup });
    assertObject(data, P);
    const meal = Array.isArray(data.meals) ? data.meals[0] : null;
    return meal ? normalizeMeal(meal) : null;
  },

  async random({ signal } = {}) {
    const { data } = await apiRequest({ provider: P, path: '/random.php', signal, ttl: TTL.random });
    assertObject(data, P);
    const meal = Array.isArray(data.meals) ? data.meals[0] : null;
    return meal ? normalizeMeal(meal) : null;
  },

  async categories({ signal } = {}) {
    const { data } = await apiRequest({ provider: P, path: '/categories.php', signal, ttl: TTL.taxonomy });
    assertObject(data, P);
    return (data.categories || []).map(normalizeCategory).filter((c) => c.name);
  },

  async areas({ signal } = {}) {
    const { data } = await apiRequest({ provider: P, path: '/list.php', params: { a: 'list' }, signal, ttl: TTL.taxonomy });
    assertObject(data, P);
    return (data.meals || []).map(normalizeArea).filter((a) => a.name);
  },

  async ingredientList({ signal } = {}) {
    const { data } = await apiRequest({ provider: P, path: '/list.php', params: { i: 'list' }, signal, ttl: TTL.taxonomy });
    assertObject(data, P);
    return (data.meals || []).map(normalizeIngredientEntry).filter(Boolean);
  },

  async diagnostic() {
    await this.random();
  },
};
