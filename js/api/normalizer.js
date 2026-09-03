/**
 * CULINA — Normalizers: provider payloads → unified domain models (PRD §24–§26).
 * Pure functions over plain data — fully unit-tested (tests/normalizer.test.js).
 * Rules:
 *   - Unknown values become null. Never 0, never invented (PRD §26).
 *   - Provider field names (strMeal, strDrink, strIngredientN…) NEVER leak past
 *     this module (PRD §25).
 *   - URLs pass through safeUrl() (PRD §47).
 */
import { S, N, safeUrl, splitList, titleCase } from '../utils/format.js';

/* ------------------------------------------------------------------ */
/* Shared helpers                                                      */
/* ------------------------------------------------------------------ */

/** Extract strIngredientN/strMeasureN pairs (N = 1..max). */
export function extractIngredients(payload, max = 20) {
  const out = [];
  for (let i = 1; i <= max; i++) {
    const name = S(payload[`strIngredient${i}`]);
    if (!name) continue;
    out.push({ name, measure: S(payload[`strMeasure${i}`]) });
  }
  return out;
}

/** Comma-separated tag string → clean array. */
export function splitTags(value) {
  return splitList(value).map((t) => t.trim()).filter(Boolean);
}

/**
 * Instruction text → numbered steps. Splits on line breaks and strips
 * "STEP n" markers used by some providers.
 */
export function parseInstructions(text) {
  const s = S(text);
  if (!s) return [];
  return s
    .split(/\r\n|\r|\n/)
    .map((line) => line.replace(/^step\s*\d+\s*[:.\-–]?\s*/i, '').trim())
    .filter((line) => line.length > 0)
    .map((t, i) => ({ step: i + 1, text: t }));
}

/** Clean an OFF machine tag like "en:organic" → "Organic". */
export function cleanMachineTag(tag) {
  const s = S(tag);
  if (!s) return null;
  return titleCase(s.replace(/^[a-z]{2}:/, '').replace(/-/g, ' '));
}

function withPreview(thumb) {
  const url = safeUrl(thumb);
  return { image: url, imagePreview: url ? `${url}/preview` : null };
}

/* ------------------------------------------------------------------ */
/* TheMealDB → Recipe                                                  */
/* ------------------------------------------------------------------ */

export function normalizeMeal(m) {
  const media = withPreview(m.strMealThumb);
  return {
    id: `mealdb:${m.idMeal}`,
    source: 'mealdb',
    sourceId: S(m.idMeal),
    title: S(m.strMeal),
    ...media,
    description: null, // TheMealDB provides no meal description
    cuisine: S(m.strArea) || S(m.strCountry),
    country: S(m.strCountry),
    category: S(m.strCategory),
    tags: splitTags(m.strTags),
    ingredients: extractIngredients(m, 20),
    instructions: parseInstructions(m.strInstructions),
    youtube: safeUrl(m.strVideo || m.strYoutube),
    sourceUrl: safeUrl(m.strSource),
    prepTime: null, // not provided by TheMealDB — kept null, never fabricated
    cookTime: null,
    servings: null,
    nutrition: null,
  };
}

/** Summary shape returned by the filter endpoints (no ingredients/instructions). */
export function normalizeMealSummary(m) {
  const media = withPreview(m.strMealThumb);
  return {
    id: `mealdb:${m.idMeal}`,
    source: 'mealdb',
    sourceId: S(m.idMeal),
    title: S(m.strMeal),
    ...media,
    description: null,
    cuisine: S(m.strArea) || S(m.strCountry),
    country: S(m.strCountry),
    category: null,
    tags: [],
    ingredients: [],
    instructions: [],
    youtube: null,
    sourceUrl: null,
    prepTime: null,
    cookTime: null,
    servings: null,
    nutrition: null,
  };
}

export function normalizeCategory(c) {
  return {
    id: S(c.idCategory),
    name: S(c.strCategory),
    image: safeUrl(c.strCategoryThumb),
    description: S(c.strCategoryDescription),
  };
}

export function normalizeArea(a) {
  return {
    name: S(a.strArea),
    country: S(a.strCountry),
  };
}

export function normalizeIngredientEntry(entry) {
  const name = S(entry.strIngredient1 || entry.strIngredient);
  if (!name) return null;
  const encoded = encodeURIComponent(name);
  return {
    id: `mealdb:${encoded}`,
    source: 'mealdb',
    sourceId: encoded,
    name,
    description: S(entry.strDescription),
    type: S(entry.strType),
    image: `https://www.themealdb.com/images/ingredients/${encoded}.png`,
    imageSmall: `https://www.themealdb.com/images/ingredients/${encoded}-small.png`,
    nutrition: null,
  };
}

/* ------------------------------------------------------------------ */
/* TheCocktailDB → Drink                                               */
/* ------------------------------------------------------------------ */

export function normalizeDrink(d) {
  const media = withPreview(d.strDrinkThumb);
  const alcoholic = S(d.strAlcoholic);
  return {
    id: `cocktaildb:${d.idDrink}`,
    source: 'cocktaildb',
    sourceId: S(d.idDrink),
    title: S(d.strDrink),
    ...media,
    category: S(d.strCategory),
    iba: S(d.strIBA),
    alcoholic: alcoholic === 'Alcoholic' ? true : alcoholic === 'Non alcoholic' ? false : null,
    glass: S(d.strGlass),
    tags: splitTags(d.strTags),
    ingredients: extractIngredients(d, 15),
    instructions: parseInstructions(d.strInstructions),
    video: safeUrl(d.strVideo),
    sourceUrl: null,
    prepTime: null,
    servings: null,
    nutrition: null,
  };
}

export function normalizeDrinkSummary(d) {
  const media = withPreview(d.strDrinkThumb);
  return {
    id: `cocktaildb:${d.idDrink}`,
    source: 'cocktaildb',
    sourceId: S(d.idDrink),
    title: S(d.strDrink),
    ...media,
    category: null,
    alcoholic: null,
    glass: null,
    tags: [],
    ingredients: [],
    instructions: [],
  };
}

export function normalizeListEntry(payload, nameKey) {
  const name = S(payload[nameKey]);
  return name ? { name } : null;
}

/* ------------------------------------------------------------------ */
/* Fruityvice → Fruit (ingredient with real nutrition)                  */
/* ------------------------------------------------------------------ */

export function normalizeFruit(f) {
  return {
    id: `fruityvice:${f.id}`,
    source: 'fruityvice',
    sourceId: String(f.id),
    name: S(f.name),
    family: S(f.family),
    genus: S(f.genus),
    order: S(f.order),
    image: null, // Fruityvice provides no imagery — CULINA uses typographic tiles
    description: [S(f.family) && `Family: ${f.family}`, S(f.genus) && `Genus: ${f.genus}`, S(f.order) && `Order: ${f.order}`]
      .filter(Boolean)
      .join(' · '),
    category: 'Fruit',
    nutrition: {
      calories: N(f.nutritions?.calories),
      protein: N(f.nutritions?.protein),
      carbohydrates: N(f.nutritions?.carbohydrates),
      fat: N(f.nutritions?.fat),
      sugar: N(f.nutritions?.sugar),
      fiber: null,
      sodium: null,
      source: 'Fruityvice',
      basis: 'per 100 g',
    },
  };
}

/* ------------------------------------------------------------------ */
/* Open Brewery DB → Brewery                                           */
/* ------------------------------------------------------------------ */

export function normalizeBrewery(b) {
  const latitude = N(b.latitude);
  const longitude = N(b.longitude);
  const street = S(b.address_1) || S(b.street);
  const city = S(b.city);
  const state = S(b.state_province) || S(b.state);
  const country = S(b.country);
  const address = [street, [city, state].filter(Boolean).join(', '), S(b.postal_code), country]
    .filter(Boolean)
    .join(', ');
  return {
    id: `obd:${b.id}`,
    source: 'openbrewerydb',
    sourceId: S(b.id),
    name: S(b.name),
    breweryType: S(b.brewery_type),
    street,
    city,
    state,
    country,
    postalCode: S(b.postal_code),
    address,
    phone: S(b.phone),
    website: safeUrl(b.website_url),
    latitude,
    longitude,
    mapUrl:
      latitude !== null && longitude !== null
        ? `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=15/${latitude}/${longitude}`
        : null,
  };
}

/* ------------------------------------------------------------------ */
/* SampleAPIs → Beer                                                   */
/* ------------------------------------------------------------------ */

function normalizeRating(rating) {
  if (rating === null || rating === undefined) return null;
  if (typeof rating === 'object') {
    const average = N(rating.average);
    return average === null ? null : { average, reviews: N(rating.reviews) };
  }
  const average = N(rating);
  return average === null ? null : { average, reviews: null };
}

export function normalizeBeer(b, style) {
  return {
    id: `sampleapis-beers:${style}:${b.id}`,
    source: 'sampleapis-beers',
    sourceId: String(b.id),
    name: S(b.name),
    style,
    price: S(b.price),
    rating: normalizeRating(b.rating),
    image: safeUrl(b.image),
    description: null, // not provided by this source
    abv: null, // not provided by this source
    brewery: null, // not provided by this source
  };
}

/* ------------------------------------------------------------------ */
/* SampleAPIs → Coffee                                                 */
/* ------------------------------------------------------------------ */

export function normalizeCoffee(c, variant) {
  return {
    id: `sampleapis-coffee:${variant}:${c.id}`,
    source: 'sampleapis-coffee',
    sourceId: String(c.id),
    name: S(c.title),
    description: S(c.description),
    ingredients: Array.isArray(c.ingredients) ? c.ingredients.map(S).filter(Boolean) : [],
    image: safeUrl(c.image),
    variant,
  };
}

/* ------------------------------------------------------------------ */
/* Open Food Facts → Product (+ nutrition)                              */
/* ------------------------------------------------------------------ */

export function normalizeOffNutrition(nm = {}) {
  return {
    calories: N(nm['energy-kcal_100g']),
    protein: N(nm['proteins_100g']),
    carbohydrates: N(nm['carbohydrates_100g']),
    fat: N(nm['fat_100g']),
    saturatedFat: N(nm['saturated-fat_100g']),
    sugar: N(nm['sugars_100g']),
    fiber: N(nm['fiber_100g']),
    salt: N(nm['salt_100g']),
    sodium: N(nm['sodium_100g']),
    source: 'Open Food Facts',
    basis: 'per 100 g/ml',
  };
}

export function normalizeProduct(p, code) {
  const brands = splitList(p.brands);
  const categories = splitList(p.categories);
  const labels = Array.isArray(p.labels_tags)
    ? p.labels_tags.map(cleanMachineTag).filter(Boolean)
    : splitList(p.labels).map((l) => l);
  return {
    id: `off:${code}`,
    source: 'openfoodfacts',
    sourceId: String(code),
    title: S(p.product_name) || S(p.product_name_en) || S(p.generic_name) || 'Unnamed product',
    brands,
    brand: brands[0] || null,
    image: safeUrl(p.image_front_small_url) || safeUrl(p.image_url),
    quantity: S(p.quantity),
    servingSize: S(p.serving_size),
    servingQuantity: N(p.serving_quantity),
    categories: categories.slice(0, 6),
    ingredientsText: S(p.ingredients_text),
    labels: labels.slice(0, 8),
    nutriscore: S(p.nutriscore_grade)?.toLowerCase() || null,
    nova: N(p.nova_group),
    nutrition: normalizeOffNutrition(p.nutriments),
    sourceUrl: `https://world.openfoodfacts.org/product/${code}`,
  };
}
