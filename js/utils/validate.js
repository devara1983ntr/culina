/**
 * CULINA — Input validation (PRD: never trust user input; inline validation
 * everywhere, never rely on browser-native validation alone).
 * Pure functions, unit-tested (tests/expansion.test.js).
 */

export const INPUT_LIMITS = {
  search: 100,
  ingredient: 60,
  shoppingItem: 80,
  plannerItem: 120,
  list: 8, // kitchen ingredients
};

/** Normalize free text: trim, collapse whitespace, hard length cap. */
export function cleanText(value, { max = INPUT_LIMITS.search } = {}) {
  const s = String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
  return s;
}

/** A search-like query is valid when non-blank after cleaning. */
export function isValidQuery(value, { max = INPUT_LIMITS.search } = {}) {
  const q = cleanText(value, { max });
  return q.length >= 1;
}

/**
 * Add an item to a list with duplicate protection (case/diacritic-insensitive
 * via keyFn). Returns { list, added, reason }.
 */
export function addUnique(list, item, { max = INPUT_LIMITS.list, keyFn = (v) => String(v).toLowerCase() } = {}) {
  const clean = cleanText(item, { max: 200 });
  if (!clean) return { list, added: false, reason: 'empty' };
  if (list.length >= max) return { list, added: false, reason: 'limit' };
  const key = keyFn(clean);
  if (list.some((existing) => keyFn(existing) === key)) {
    return { list, added: false, reason: 'duplicate' };
  }
  return { list: [...list, clean], added: true, reason: null };
}

/** Clamp a numeric quantity to a safe range; null when unparseable. */
export function parseQuantity(value, { min = 0, max = 100_000 } = {}) {
  const raw = String(value ?? '').replace(',', '.').trim();
  if (!raw) return null; // Number('') === 0 — explicitly reject empty
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  if (n < min || n > max) return null;
  return n;
}

/** Friendly messages for validation failures (never technical). */
export function validationMessage(reason, { what = 'item', max = INPUT_LIMITS.list } = {}) {
  switch (reason) {
    case 'empty':
      return `Enter a ${what} first — empty or whitespace-only entries aren’t added.`;
    case 'duplicate':
      return `That ${what} is already on your list.`;
    case 'limit':
      return `You’ve reached the maximum of ${max} entries.`;
    default:
      return 'That entry can’t be added.';
  }
}

/** Debounce-safe read of a signal value used for optimistic UI. */
export function isAbortLike(err) {
  return Boolean(err && (err.name === 'AbortError' || err instanceof DOMException));
}
