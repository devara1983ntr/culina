/**
 * CULINA — Local-first favorites (PRD §33).
 * Everything stays in localStorage; duplicates are prevented; the store signal
 * lets badges & pages react to changes.
 */
import { read, write } from '../storage.js';
import { STORAGE_KEYS } from '../constants.js';
import { appState } from '../state.js';

/** entity (singular) → collection key */
export const COLLECTIONS = {
  recipe: 'recipes',
  cocktail: 'cocktails',
  beer: 'beers',
  fruit: 'fruits',
  product: 'products',
  coffee: 'coffees',
  brewery: 'breweries',
};

export const COLLECTION_LABELS = {
  recipes: 'Recipes',
  cocktails: 'Cocktails',
  beers: 'Beers',
  fruits: 'Fruits',
  products: 'Products',
  coffees: 'Coffee',
  breweries: 'Breweries',
};

function empty() {
  return { recipes: [], cocktails: [], beers: [], fruits: [], products: [], coffees: [], breweries: [] };
}

function sanitize(raw) {
  const data = raw && typeof raw === 'object' ? raw : {};
  const out = empty();
  for (const key of Object.keys(out)) {
    if (Array.isArray(data[key])) out[key] = data[key].filter((it) => it && it.id && it.title);
  }
  return out;
}

function persist(data) {
  write(STORAGE_KEYS.favorites, data);
  appState.set((s) => ({ favoritesVersion: s.favoritesVersion + 1 }));
}

/**
 * Build a favoritable envelope from a normalized item.
 * Keeps display data + route so the favorites page can render cards
 * without re-fetching.
 */
export function envelopeFor(entity, item, route) {
  const collection = COLLECTIONS[entity];
  if (!collection || !item) return null;
  return {
    id: item.id,
    entity,
    source: item.source,
    sourceId: item.sourceId,
    title: item.title || item.name,
    image: item.imagePreview || item.image || null,
    subtitle:
      entity === 'recipe'
        ? [item.cuisine, item.category].filter(Boolean).join(' · ') || null
        : entity === 'cocktail'
          ? item.category
          : entity === 'beer'
            ? item.style
            : entity === 'fruit'
              ? item.family
              : entity === 'product'
                ? item.brand
                : entity === 'brewery'
                  ? [item.breweryType, item.country].filter(Boolean).join(' · ')
                  : entity === 'coffee'
                    ? item.variant === 'iced' ? 'Iced' : 'Hot'
                    : null,
    route: route ?? null,
    addedAt: new Date().toISOString(),
  };
}

export const favorites = {
  all() {
    return sanitize(read(STORAGE_KEYS.favorites, null));
  },

  forCollection(collection) {
    return this.all()[collection] || [];
  },

  has(collection, id) {
    return this.forCollection(collection).some((it) => it.id === id);
  },

  /** @returns {boolean} true when the item was added, false when removed */
  toggle(envelope) {
    if (!envelope || !envelope.id) return false;
    const collection = COLLECTIONS[envelope.entity];
    if (!collection) return false;
    const data = this.all();
    const list = data[collection];
    const index = list.findIndex((it) => it.id === envelope.id);
    if (index >= 0) {
      list.splice(index, 1);
      persist(data);
      return false;
    }
    list.unshift(envelope);
    persist(data);
    return true;
  },

  remove(collection, id) {
    const data = this.all();
    const before = data[collection].length;
    data[collection] = data[collection].filter((it) => it.id !== id);
    if (data[collection].length !== before) persist(data);
  },

  counts() {
    const data = this.all();
    const counts = {};
    for (const key of Object.keys(empty())) counts[key] = data[key].length;
    return counts;
  },

  total() {
    return Object.values(this.counts()).reduce((a, b) => a + b, 0);
  },
};
