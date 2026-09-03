/**
 * CULINA — Formatting & parsing helpers.
 * Pure functions, no DOM — usable from tests.
 */

/** Trimmed string or null. Never ''. */
export function S(v) {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t === '' ? null : t;
}

/** Finite number or null. Guards null/''/NaN — unknown stays unknown (PRD §26). */
export function N(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function truncate(str, max = 120) {
  const s = S(str);
  if (!s) return '';
  return s.length <= max ? s : s.slice(0, max - 1).trimEnd() + '…';
}

/** Split a comma (or other) separated API string into clean values. */
export function splitList(str, sep = ',') {
  const s = S(str);
  if (!s) return [];
  return s
    .split(sep)
    .map((part) => part.trim())
    .filter(Boolean);
}

/** Normalized title for deduplication & ranking (case, diacritics, punctuation). */
export function normalizeTitle(str) {
  return S(str)
    ? S(str)
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim()
    : '';
}

/** Stable key for ingredient merging. */
export function ingredientKey(name) {
  return normalizeTitle(name);
}

/**
 * Only http(s) URLs pass — blocks javascript:/data: schemes coming from
 * third-party data (PRD §47: never construct unsafe URLs).
 */
export function safeUrl(v) {
  const s = S(v);
  if (!s) return null;
  try {
    const url = new URL(s);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function slug(str) {
  return S(str)
    ? S(str)
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')
    : '';
}

export function titleCase(str) {
  const s = S(str);
  if (!s) return '';
  return s.replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
}

export function formatRating(value) {
  const n = N(value);
  return n === null ? null : (Math.round(n * 10) / 10).toFixed(1);
}

export function formatMs(ms) {
  const n = N(ms);
  if (n === null) return '—';
  return n >= 1000 ? `${(n / 1000).toFixed(1)} s` : `${Math.round(n)} ms`;
}

export function relativeTime(iso) {
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return '—';
  const diff = Date.now() - then;
  if (diff < 45_000) return 'just now';
  if (diff < 3_600_000) return `${Math.round(diff / 60_000)} min ago`;
  if (diff < 86_400_000) return `${Math.round(diff / 3_600_000)} h ago`;
  return `${Math.round(diff / 86_400_000)} d ago`;
}

export function formatCount(n) {
  const v = N(n);
  if (v === null) return '—';
  if (v >= 1000) return `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k`;
  return String(v);
}

/** Clamp helper for bars. */
export function clamp01(v) {
  return Math.max(0, Math.min(1, N(v) ?? 0));
}

/** Split a measure like "1/2 cup" into {quantity, unit} when safely parseable. */
export function parseMeasure(measure) {
  const s = S(measure);
  if (!s) return { quantity: null, unit: null };
  const m = s.match(/^(\d+(?:\.\d+)?(?:\s*\/\s*\d+(?:\.\d+)?)?)\s*(.*)$/);
  if (!m) return { quantity: null, unit: s };
  const [, qtyRaw, unit] = m;
  let qty = null;
  if (qtyRaw.includes('/')) {
    const [a, b] = qtyRaw.split('/').map(Number);
    if (Number.isFinite(a) && Number.isFinite(b) && b !== 0) qty = a / b;
  } else {
    qty = Number(qtyRaw);
  }
  return { quantity: Number.isFinite(qty) ? qty : null, unit: unit || null };
}

/** Keyword tokens of a query for ranking. */
export function queryTokens(q) {
  return normalizeTitle(q).split(' ').filter((t) => t.length > 1);
}
