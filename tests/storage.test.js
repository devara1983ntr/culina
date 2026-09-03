/**
 * CULINA — Storage & local services tests (PRD §33–§35, §53):
 * favorites, meal planner, shopping-list merging — all against a mocked
 * localStorage (no network except the shopping fetch mock).
 */
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { makeLocalStorage } from './helpers/setup-storage.js'; // MUST be first

import { favorites, envelopeFor, COLLECTIONS } from '../js/services/favorites.js';
import { planner } from '../js/services/planner.js';
import { generateShoppingList } from '../js/services/shopping.js';

const recipeEnvelope = (id = 'mealdb:52772', title = 'Teriyaki Chicken Casserole') => ({
  id,
  entity: 'recipe',
  source: 'mealdb',
  sourceId: '52772',
  title,
  subtitle: 'Japanese · Chicken',
  image: 'https://example.com/x.jpg',
  route: `/recipe/${id}`,
  savedAt: Date.now(),
});

beforeEach(() => {
  window.localStorage.clear();
});

test('favorites.toggle adds then removes an item', () => {
  const env = recipeEnvelope();
  assert.equal(favorites.toggle(env), true, 'first toggle saves');
  assert.equal(favorites.has('recipes', env.id), true);
  assert.equal(favorites.total(), 1);
  assert.equal(favorites.toggle(env), false, 'second toggle removes');
  assert.equal(favorites.has('recipes', env.id), false);
  assert.equal(favorites.total(), 0);
});

test('favorites keeps collections separate', () => {
  favorites.toggle(recipeEnvelope());
  favorites.toggle({ ...recipeEnvelope('cocktaildb:11007', 'Margarita'), entity: 'cocktail', source: 'cocktaildb', sourceId: '11007', route: '/cocktail/cocktaildb:11007' });
  const counts = favorites.counts();
  assert.equal(counts.recipes, 1);
  assert.equal(counts.cocktails, 1);
  assert.equal(favorites.forCollection('recipes')[0].title, 'Teriyaki Chicken Casserole');
});

test('favorites.remove deletes by id', () => {
  const env = recipeEnvelope();
  favorites.toggle(env);
  favorites.remove('recipes', env.id);
  assert.equal(favorites.total(), 0);
});

test('envelopeFor routes every mapped entity to its collection', () => {
  assert.equal(COLLECTIONS.recipe, 'recipes');
  assert.equal(COLLECTIONS.cocktail, 'cocktails');
  assert.equal(COLLECTIONS.fruit, 'fruits');
  assert.equal(COLLECTIONS.product, 'products');
  const env = envelopeFor('recipe', { id: 'mealdb:1', source: 'mealdb', sourceId: '1', title: 'X', image: null }, '/recipe/mealdb:1');
  assert.equal(env.entity, 'recipe');
  assert.equal(env.route, '/recipe/mealdb:1');
});

test('planner add/remove/move/duplicate across days and meals', () => {
  const item = { id: 'mealdb:1', title: 'Soup', image: null, route: '/recipe/mealdb:1' };
  assert.equal(planner.add('monday', 'dinner', item), true);
  assert.equal(planner.add('monday', 'dinner', { ...item, id: 'mealdb:2', title: 'Salad' }), true);
  assert.equal(planner.slot('monday', 'dinner').length, 2);
  assert.equal(planner.itemCount(), 2);

  planner.move('monday', 'dinner', 0, 'tuesday', 'lunch');
  assert.equal(planner.slot('monday', 'dinner').length, 1);
  assert.equal(planner.slot('tuesday', 'lunch')[0].title, 'Soup');

  planner.duplicateAt('tuesday', 'lunch', 0);
  assert.equal(planner.slot('tuesday', 'lunch').length, 2);
  assert.equal(planner.itemCount(), 3);

  planner.removeAt('tuesday', 'lunch', 1);
  assert.equal(planner.slot('tuesday', 'lunch').length, 1);
});

test('planner enforces MAX_PER_SLOT', () => {
  for (let i = 0; i < planner.MAX_PER_SLOT; i++) {
    assert.equal(planner.add('wednesday', 'dinner', { id: `m${i}`, title: `Dish ${i}` }), true);
  }
  assert.equal(planner.add('wednesday', 'dinner', { id: 'overflow', title: 'Nope' }), false);
  assert.equal(planner.slot('wednesday', 'dinner').length, planner.MAX_PER_SLOT);
});

test('planner clearDay and clearWeek', () => {
  planner.add('thursday', 'lunch', { id: 'a', title: 'A' });
  planner.add('friday', 'lunch', { id: 'b', title: 'B' });
  planner.clearDay('thursday');
  assert.equal(planner.slot('thursday', 'lunch').length, 0);
  assert.equal(planner.itemCount(), 1);
  planner.clearWeek();
  assert.equal(planner.itemCount(), 0);
});

test('planner uniquePlanned deduplicates repeated dishes', () => {
  planner.add('monday', 'dinner', { id: 'mealdb:1', title: 'Soup', source: 'mealdb', sourceId: '1' });
  planner.add('tuesday', 'dinner', { id: 'mealdb:1', title: 'Soup', source: 'mealdb', sourceId: '1' });
  assert.equal(planner.itemCount(), 2);
  assert.equal(planner.uniquePlanned().length, 1);
});

/* --- Shopping list merging (fetch mocked with meal fixtures) ----------- */

function mealPayload(id, title, ingredients) {
  const base = { idMeal: id, strMeal: title, strCategory: 'X', strArea: 'Y', strInstructions: '', strMealThumb: '' };
  ingredients.forEach(([name, measure], i) => {
    base[`strIngredient${i + 1}`] = name;
    base[`strMeasure${i + 1}`] = measure;
  });
  return base;
}

function mockMealsById(map) {
  globalThis.fetch = async (url) => {
    const id = new URL(url).searchParams.get('i');
    const entry = map[id];
    const data = entry ? { meals: [entry] } : { meals: null };
    return {
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: async () => data,
    };
  };
}

test('shopping list merges same-unit quantities and reports failures', async () => {
  mockMealsById({
    11: mealPayload('11', 'Soup One', [
      ['Chicken', '2 breasts'],
      ['rice', '1 cup'],
      ['Onion', '1'],
    ]),
    12: mealPayload('12', 'Soup Two', [
      ['Rice', '2 cups'],
      ['Onion', '2'],
    ]),
  });

  const { items, failed } = await generateShoppingList([
    { id: 'mealdb:11', source: 'mealdb', sourceId: '11', title: 'Soup One' },
    { id: 'mealdb:12', source: 'mealdb', sourceId: '12', title: 'Soup Two' },
    { id: 'mealdb:19', source: 'mealdb', sourceId: '19', title: 'Gone Recipe' },
  ]);

  assert.deepEqual(failed, ['Gone Recipe']);

  const byName = new Map(items.map((i) => [i.name.toLowerCase(), i]));
  assert.equal(byName.get('rice').display, '3 cups', '1 cup + 2 cups must sum');
  assert.equal(byName.get('rice').matchedCount, 2);
  assert.deepEqual(byName.get('rice').recipes.sort(), ['Soup One', 'Soup Two'].sort());
  assert.equal(byName.get('onion').display, '3', 'unitless quantities sum without a unit');
  assert.equal(byName.get('chicken').display, '2 breasts');
  // Sorted output
  const names = items.map((i) => i.name.toLowerCase());
  assert.deepEqual(names, [...names].sort());
});

test('shopping list refuses to merge mismatched units', async () => {
  mockMealsById({
    21: mealPayload('21', 'A', [['Butter', '2 tbsp']]),
    22: mealPayload('22', 'B', [['Butter', '100 g']]),
  });
  const { items } = await generateShoppingList([
    { id: 'mealdb:21', source: 'mealdb', sourceId: '21', title: 'A' },
    { id: 'mealdb:22', source: 'mealdb', sourceId: '22', title: 'B' },
  ]);
  const butter = items.find((i) => i.name.toLowerCase() === 'butter');
  assert.equal(butter.display, 'Quantity varies by recipe', 'tbsp + g must never be summed');
  assert.equal(butter.matchedCount, 2);
});

test('shopping list flags partially unspecified quantities', async () => {
  mockMealsById({
    31: mealPayload('31', 'A', [['Garlic', '3 cloves']]),
    32: mealPayload('32', 'B', [['Garlic', '']]),
  });
  const { items } = await generateShoppingList([
    { id: 'mealdb:31', source: 'mealdb', sourceId: '31', title: 'A' },
    { id: 'mealdb:32', source: 'mealdb', sourceId: '32', title: 'B' },
  ]);
  const garlic = items.find((i) => i.name.toLowerCase() === 'garlic');
  assert.equal(garlic.display, '3 cloves+ (some recipes unspecified)');
});
