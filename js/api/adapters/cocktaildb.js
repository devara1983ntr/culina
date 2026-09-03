/**
 * TheCocktailDB adapter — https://www.thecocktaildb.com/api.php
 * Verified 2026-09-02: DIRECT, CORS *, keyless (community test key documented).
 */
import { apiRequest } from '../client.js';
import { assertObject } from '../errors.js';
import { normalizeDrink, normalizeDrinkSummary, normalizeListEntry } from '../normalizer.js';

const P = 'cocktaildb';

const TTL = {
  search: 10 * 60_000,
  filter: 10 * 60_000,
  lookup: 60 * 60_000,
  random: 5 * 60_000,
  taxonomy: 24 * 60 * 60_000,
};

export const cocktaildb = {
  providerId: P,

  async searchByName(q, { signal } = {}) {
    const { data } = await apiRequest({ provider: P, path: '/search.php', params: { s: q }, signal, ttl: TTL.search });
    assertObject(data, P);
    return (data.drinks || []).map(normalizeDrink);
  },

  async searchByFirstLetter(letter, { signal } = {}) {
    const { data } = await apiRequest({ provider: P, path: '/search.php', params: { f: letter }, signal, ttl: TTL.search });
    assertObject(data, P);
    return (data.drinks || []).map(normalizeDrink);
  },

  async filterByIngredient(ingredient, { signal } = {}) {
    const { data } = await apiRequest({ provider: P, path: '/filter.php', params: { i: ingredient }, signal, ttl: TTL.filter });
    assertObject(data, P);
    return (data.drinks || []).map(normalizeDrinkSummary);
  },

  async filterByCategory(category, { signal } = {}) {
    const { data } = await apiRequest({ provider: P, path: '/filter.php', params: { c: category }, signal, ttl: TTL.filter });
    assertObject(data, P);
    return (data.drinks || []).map(normalizeDrinkSummary);
  },

  async filterNonAlcoholic({ signal } = {}) {
    const { data } = await apiRequest({ provider: P, path: '/filter.php', params: { a: 'Non_Alcoholic' }, signal, ttl: TTL.filter });
    assertObject(data, P);
    return (data.drinks || []).map(normalizeDrinkSummary);
  },

  async lookup(id, { signal } = {}) {
    const { data } = await apiRequest({ provider: P, path: '/lookup.php', params: { i: id }, signal, ttl: TTL.lookup });
    assertObject(data, P);
    const drink = Array.isArray(data.drinks) ? data.drinks[0] : null;
    return drink ? normalizeDrink(drink) : null;
  },

  async random({ signal } = {}) {
    const { data } = await apiRequest({ provider: P, path: '/random.php', signal, ttl: TTL.random });
    assertObject(data, P);
    const drink = Array.isArray(data.drinks) ? data.drinks[0] : null;
    return drink ? normalizeDrink(drink) : null;
  },

  async categories({ signal } = {}) {
    const { data } = await apiRequest({ provider: P, path: '/list.php', params: { c: 'list' }, signal, ttl: TTL.taxonomy });
    assertObject(data, P);
    return (data.drinks || []).map((d) => normalizeListEntry(d, 'strCategory')).filter(Boolean);
  },

  async glasses({ signal } = {}) {
    const { data } = await apiRequest({ provider: P, path: '/list.php', params: { g: 'list' }, signal, ttl: TTL.taxonomy });
    assertObject(data, P);
    return (data.drinks || []).map((d) => normalizeListEntry(d, 'strGlass')).filter(Boolean);
  },

  async ingredientList({ signal } = {}) {
    const { data } = await apiRequest({ provider: P, path: '/list.php', params: { i: 'list' }, signal, ttl: TTL.taxonomy });
    assertObject(data, P);
    return (data.drinks || []).map((d) => normalizeListEntry(d, 'strIngredient1')).filter(Boolean);
  },

  async diagnostic() {
    await this.random();
  },
};
