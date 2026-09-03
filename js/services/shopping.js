/**
 * CULINA — Shopping list generation (PRD §35).
 * Merges ingredients across planned recipes. Safe merging only:
 *   - identical normalized ingredient name + identical unit + parseable
 *     quantities → summed
 *   - anything else → “quantity varies by recipe”
 * Semantically different ingredients are never merged.
 */
import { mealdb } from '../api/adapters/index.js';
import { ingredientKey, parseMeasure, S } from '../utils/format.js';
import { formatQuantity } from '../utils/fn.js';

/**
 * Providers mix singular and plural units (“1 cup”, “2 cups”). Two units are
 * mergeable when identical or simple plural forms of each other. Anything
 * else (tbsp vs g) is never merged.
 */
function sameUnit(a, b) {
  const x = (a || '').toLowerCase().trim();
  const y = (b || '').toLowerCase().trim();
  if (!x || !y) return false;
  if (x === y) return true;
  return x + 's' === y || y + 's' === x || x + 'es' === y || y + 'es' === x;
}

/**
 * @param {Array<{id, title, source, sourceId}>} plannedItems
 * @returns {Promise<{items: Array<{name: string, display: string,
 *            recipes: string[], matchedCount: number}>, failed: string[]}>}
 */
export async function generateShoppingList(plannedItems, { signal } = {}) {
  const failed = [];
  const recipes = [];

  const lookups = await Promise.allSettled(
    plannedItems.map((item) => {
      if (item.source === 'mealdb') return mealdb.lookup(item.sourceId, { signal });
      return Promise.resolve(null);
    }),
  );

  for (let i = 0; i < plannedItems.length; i++) {
    const result = lookups[i];
    if (result.status === 'rejected') {
      failed.push(plannedItems[i].title);
      continue;
    }
    const recipe = result.value;
    if (recipe && Array.isArray(recipe.ingredients)) recipes.push(recipe);
    else if (!recipe) failed.push(plannedItems[i].title);
  }

  const merged = new Map(); // key → { name, parts: [{quantity, unit, recipeTitle}] }

  for (const recipe of recipes) {
    for (const ing of recipe.ingredients) {
      const name = S(ing.name);
      if (!name) continue;
      const key = ingredientKey(name);
      if (!key) continue;
      if (!merged.has(key)) merged.set(key, { name, parts: [] });
      merged.get(key).parts.push({
        ...parseMeasure(ing.measure),
        raw: S(ing.measure),
        recipeTitle: recipe.title,
      });
    }
  }

  const items = [...merged.values()].map((entry) => {
    const withQty = entry.parts.filter((p) => p.quantity !== null);
    const unitForms = [...new Set(withQty.map((p) => (p.unit || '').trim()).filter(Boolean))];
    const unitsCompatible = unitForms.length <= 1 || unitForms.every((u) => sameUnit(u, unitForms[0]));
    const allQuantified = withQty.length === entry.parts.length;
    let display = 'Quantity varies by recipe';

    if (withQty.length > 0 && unitsCompatible) {
      const total = withQty.reduce((sum, p) => sum + p.quantity, 0);
      // Display: prefer a plural form when summing (1 cup + 2 cups → 3 cups).
      let unit = unitForms[0] || '';
      if (unitForms.length && total !== 1) {
        unit = unitForms.find((u) => u.toLowerCase().endsWith('s')) ?? unit;
      }
      const pretty = formatQuantity(Math.round(total * 100) / 100);
      if (!allQuantified) {
        display = unit ? `${pretty} ${unit}+ (some recipes unspecified)` : `${pretty}+ (some recipes unspecified)`;
      } else {
        display = unit ? `${pretty} ${unit}` : String(pretty);
      }
    }

    return {
      name: entry.name,
      display,
      recipes: [...new Set(entry.parts.map((p) => p.recipeTitle))],
      matchedCount: entry.parts.length,
    };
  });

  items.sort((a, b) => a.name.localeCompare(b.name));

  return { items, failed };
}
