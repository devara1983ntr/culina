/**
 * Adapter registry — one import surface for every enabled provider.
 * Adding a new provider = 1 registry entry + 1 adapter + 1 normalizer
 * (PRD §77); nothing else in the application changes.
 */
import { mealdb } from './mealdb.js';
import { cocktaildb } from './cocktaildb.js';
import { fruityvice } from './fruityvice.js';
import { foodish } from './foodish.js';
import { openbrewerydb } from './openbrewerydb.js';
import { openfoodfacts } from './openfoodfacts.js';
import { coffee } from './coffee.js';
import { beers } from './beers.js';

export const adapters = {
  mealdb,
  cocktaildb,
  fruityvice,
  foodish,
  openbrewerydb,
  openfoodfacts,
  coffee,
 beers,
};

/* Named re-exports — pages and services import adapters directly. */
export { mealdb, cocktaildb, fruityvice, foodish, openbrewerydb, openfoodfacts, coffee, beers };

export function adapterFor(providerId) {
  return adapters[providerId] || null;
}
