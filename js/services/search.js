/**
 * CULINA — Unified search (PRD §28–§32).
 * Pipeline: query → provider selection → parallel requests (Promise.allSettled)
 * → normalization (done in adapters) → deduplication → deterministic ranking
 * → grouped results. One failed provider never sinks the search.
 */
import {
  mealdb,
  cocktaildb,
  fruityvice,
  openfoodfacts,
  openbrewerydb,
  beers,
  coffee,
} from '../api/adapters/index.js';
import { normalizeTitle, queryTokens } from '../utils/format.js';

const defaultImpls = { mealdb, cocktaildb, fruityvice, openfoodfacts, openbrewerydb, beers, coffee };

function matchesQuery(item, tokens) {
  if (!tokens.length) return true;
  const title = normalizeTitle(item.title || item.name);
  return tokens.some((t) => title.includes(t));
}

/**
 * Deterministic relevance (documented rule — PRD §31):
 *   exact title match 100 · starts-with 60 · contains 35 · token overlap +8
 *   data completeness: image +3, description +1
 * Ties break alphabetically by title. No hidden “provider quality” bias.
 */
export function scoreItem(item, query) {
  const title = normalizeTitle(item.title || item.name);
  if (!title) return 0;
  const q = normalizeTitle(query);
  const tokens = queryTokens(query);
  let score = 0;
  if (q && title === q) score += 100;
  else if (q && title.startsWith(q)) score += 60;
  else if (q && title.includes(q)) score += 35;
  for (const t of tokens) if (t && title.includes(t)) score += 8;
  // Completeness bonuses only apply to textually relevant results — an
  // unrelated item must score exactly 0 so callers can threshold on it.
  if (score > 0) {
    if (item.image) score += 3;
    if (item.description) score += 1;
  }
  return score;
}

/** Deduplicate by source+sourceId, then by normalized title (per group). */
export function dedupeItems(items) {
  const seenIds = new Set();
  const seenTitles = new Set();
  const out = [];
  for (const item of items) {
    const idKey = `${item.source}:${item.sourceId}`;
    if (seenIds.has(idKey)) continue;
    const titleKey = normalizeTitle(item.title || item.name);
    if (titleKey && seenTitles.has(titleKey)) continue;
    seenIds.add(idKey);
    if (titleKey) seenTitles.add(titleKey);
    out.push(item);
  }
  return out;
}

export function rankItems(items, query) {
  return items
    .map((item) => ({ item, score: scoreItem(item, query) }))
    .sort((a, b) => b.score - a.score || String(a.item.title || '').localeCompare(String(b.item.title || '')))
    .map((entry) => entry.item);
}

function buildTasks(query, impls) {
  const tokens = queryTokens(query);
  return [
    {
      entity: 'recipes',
      provider: 'mealdb',
      label: 'TheMealDB',
      run: () => impls.mealdb.searchByName(query),
    },
    {
      entity: 'cocktails',
      provider: 'cocktaildb',
      label: 'TheCocktailDB',
      run: () => impls.cocktaildb.searchByName(query),
    },
    {
      entity: 'fruits',
      provider: 'fruityvice',
      label: 'Fruityvice',
      run: async () => (await impls.fruityvice.listFruits()).filter((f) => matchesQuery(f, tokens)),
    },
    {
      entity: 'products',
      provider: 'openfoodfacts',
      label: 'Open Food Facts',
      run: async () => (await impls.openfoodfacts.search(query)).products,
    },
    {
      entity: 'breweries',
      provider: 'openbrewerydb',
      label: 'Open Brewery DB',
      run: () => impls.openbrewerydb.search(query),
    },
    {
      entity: 'beers',
      provider: 'sampleapis-beers',
      label: 'SampleAPIs Beers',
      run: async () => {
        const { ales, stouts } = await impls.beers.all();
        return [...ales, ...stouts].filter((b) => matchesQuery(b, tokens));
      },
    },
    {
      entity: 'coffees',
      provider: 'sampleapis-coffee',
      label: 'SampleAPIs Coffee',
      run: async () => {
        const { hot, iced } = await impls.coffee.all();
        return [...hot, ...iced].filter((c) => matchesQuery(c, tokens));
      },
    },
  ];
}

/**
 * @returns {Promise<{query: string, groups: Object<string, Array>,
 *                    failures: Array<{provider: string, label: string, message: string}>}>}
 */
export async function unifiedSearch(query, { signal, impls = defaultImpls } = {}) {
  const q = String(query || '').trim();
  const groups = {
    recipes: [],
    cocktails: [],
    fruits: [],
    products: [],
    breweries: [],
    beers: [],
    coffees: [],
  };
  const failures = [];

  if (!q) return { query: q, groups, failures };

  const tasks = buildTasks(q, impls);
  const settled = await Promise.allSettled(
    tasks.map(async (task) => {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      return { task, items: await task.run() };
    }),
  );

  for (const result of settled) {
    if (result.status === 'rejected') {
      const reason = result.reason;
      if (reason?.name === 'AbortError') continue; // caller navigated — not a failure
      failures.push({
        provider: reason?.provider || 'unknown',
        label: tasks.find((t) => t.provider === reason?.provider)?.label || reason?.provider || 'Provider',
        message: reason?.message || 'Request failed',
      });
      continue;
    }
    const { task, items } = result.value;
    if (Array.isArray(items) && items.length) {
      const ranked = rankItems(dedupeItems(items), q);
      groups[task.entity] = ranked;
    }
  }

  return { query: q, groups, failures };
}

export function totalResults(result) {
  return Object.values(result.groups).reduce((sum, list) => sum + list.length, 0);
}
