/**
 * CULINA — Unified search tests (PRD §31): deterministic scoring,
 * deduplication, ranking, partial failure isolation.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { scoreItem, dedupeItems, rankItems, unifiedSearch, totalResults } from '../js/services/search.js';

const meal = (title, extra = {}) => ({
  id: `mealdb:${title}`,
  source: 'mealdb',
  sourceId: title,
  title,
  image: 'https://example.com/x.jpg',
  description: null,
  ...extra,
});

test('scoreItem: exact > starts-with > contains', () => {
  const q = 'pizza';
  const exact = scoreItem(meal('Pizza'), q);
  const starts = scoreItem(meal('Pizza Margherita'), q);
  const contains = scoreItem(meal('Turkish Pide Pizza Bread'), q);
  const noMatch = scoreItem(meal('Sushi'), q);
  assert.ok(exact > starts, `exact (${exact}) must beat starts-with (${starts})`);
  assert.ok(starts > contains, `starts-with (${starts}) must beat contains (${contains})`);
  assert.equal(noMatch, 0);
});

test('scoreItem: case and diacritics insensitive', () => {
  assert.equal(scoreItem(meal('Crème Brûlée'), 'creme brulee') > 0, true);
  assert.equal(scoreItem(meal('Crème Brûlée'), 'CREME') > 0, true);
});

test('dedupeItems removes same source+id and same normalized title', () => {
  const items = [
    meal('Pizza', { sourceId: '1' }),
    meal('Pizza', { sourceId: '1' }), // exact duplicate
    meal('pizza!', { sourceId: '2' }), // same normalized title
    { ...meal('Sicilian Pizza', { sourceId: '3' }), source: 'cocktaildb' }, // different source AND title: kept
  ];
  const out = dedupeItems(items);
  assert.equal(out.length, 2);
  assert.equal(out[1].title, 'Sicilian Pizza');
});

test('rankItems orders by score, ties alphabetical', () => {
  const ranked = rankItems([meal('Zucchini Pizza'), meal('Pizza'), meal('Apple Pizza')], 'pizza');
  assert.equal(ranked[0].title, 'Pizza');
  assert.equal(ranked[1].title, 'Apple Pizza');
  assert.equal(ranked[2].title, 'Zucchini Pizza');
});

function makeImpls(overrides = {}) {
  return {
    mealdb: { searchByName: async () => [meal('Apple'), meal('Apple Pie')] },
    cocktaildb: { searchByName: async () => [] },
    fruityvice: { listFruits: async () => [{ source: 'fruityvice', sourceId: '1', name: 'Pineapple' }] },
    openfoodfacts: { search: async () => ({ products: [] }) },
    openbrewerydb: { search: async () => [] },
    beers: { all: async () => ({ ales: [], stouts: [] }) },
    coffee: { all: async () => ({ hot: [], iced: [] }) },
    ...overrides,
  };
}

test('unifiedSearch fills groups and ranks within them', async () => {
  const result = await unifiedSearch('apple', { impls: makeImpls() });
  assert.equal(result.groups.recipes.length, 2);
  assert.equal(result.groups.recipes[0].title, 'Apple');
  assert.equal(result.groups.fruits.length, 1);
  assert.equal(result.failures.length, 0);
  assert.equal(totalResults(result), 3);
});

test('unifiedSearch with empty query returns empty groups, no requests', async () => {
  let called = false;
  const impls = makeImpls({ mealdb: { searchByName: async () => { called = true; return []; } } });
  const result = await unifiedSearch('   ', { impls });
  assert.equal(called, false);
  assert.equal(totalResults(result), 0);
});

test('unifiedSearch isolates provider failures (allSettled semantics)', async () => {
  const impls = makeImpls({
    cocktaildb: {
      searchByName: async () => {
        throw Object.assign(new Error('429 Rate limited'), { provider: 'cocktaildb', status: 429 });
      },
    },
    mealdb: {
      searchByName: async () => {
        throw Object.assign(new Error('network down'), { provider: 'mealdb' });
      },
    },
  });
  const result = await unifiedSearch('apple', { impls });
  assert.equal(result.groups.recipes.length, 0, 'failed provider contributes nothing');
  assert.equal(result.groups.fruits.length, 1, 'other providers keep working');
  assert.equal(result.failures.length, 2);
  const labels = result.failures.map((f) => f.label);
  assert.ok(labels.includes('TheMealDB'));
  assert.ok(labels.includes('TheCocktailDB'));
});

test('unifiedSearch ignores AbortError (navigation, not failure)', async () => {
  const impls = makeImpls({
    mealdb: {
      searchByName: async () => {
        throw new DOMException('Aborted', 'AbortError');
      },
    },
  });
  const result = await unifiedSearch('apple', { impls });
  assert.equal(result.failures.length, 0);
});
