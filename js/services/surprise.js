/**
 * CULINA — “Surprise me” discovery engine (PRD §60).
 * Weighted random pick across enabled providers with a fallback chain:
 * if the chosen provider fails, the next candidate is tried. Never fabricates.
 */
import { mealdb, cocktaildb, fruityvice, openbrewerydb, foodish } from '../api/adapters/index.js';

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

const CANDIDATES = [
  {
    kind: 'recipe',
    weight: 3,
    run: async () => {
      const item = await mealdb.random();
      return item ? { item, route: `/recipe/${item.sourceId}` } : null;
    },
  },
  {
    kind: 'cocktail',
    weight: 2,
    run: async () => {
      const item = await cocktaildb.random();
      return item ? { item, route: `/cocktail/${item.sourceId}` } : null;
    },
  },
  {
    kind: 'fruit',
    weight: 1,
    run: async () => {
      const fruits = await fruityvice.listFruits();
      if (!fruits.length) return null;
      const item = pick(fruits);
      return { item, route: `/ingredient/fruityvice/${item.sourceId}` };
    },
  },
  {
    kind: 'brewery',
    weight: 1,
    run: async () => {
      const item = await openbrewerydb.random();
      return item ? { item, route: '/breweries' } : null;
    },
  },
  {
    kind: 'image',
    weight: 1,
    run: async () => {
      const { image } = await foodish.randomImage();
      return image ? { item: { title: 'A dish to inspire you', image }, route: null } : null;
    },
  },
];

function weightedChoice() {
  const total = CANDIDATES.reduce((sum, c) => sum + c.weight, 0);
  let roll = Math.random() * total;
  for (const candidate of CANDIDATES) {
    roll -= candidate.weight;
    if (roll <= 0) return candidate;
  }
  return CANDIDATES[0];
}

/**
 * @returns {Promise<{kind: string, item: object, route: string|null}>}
 * @throws when every candidate fails (all providers unavailable).
 */
export async function surpriseMe({ signal } = {}) {
  const order = [weightedChoice()];
  for (const candidate of CANDIDATES) if (candidate !== order[0]) order.push(candidate);

  const errors = [];
  for (const candidate of order) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    try {
      const result = await candidate.run();
      if (result) return { kind: candidate.kind, ...result };
    } catch (err) {
      if (err?.name === 'AbortError') throw err;
      errors.push(`${candidate.kind}: ${err?.message || 'failed'}`);
    }
  }
  throw new Error(`All discovery sources failed (${errors.join('; ')})`);
}
