/**
 * CULINA — Nutrition visualization (PRD §27).
 * Accessible by construction: every value is real text; bars are decorative.
 * Unknown values render as “—” and are NEVER converted to zero or estimated.
 */
import { el, icon } from '../utils/dom.js';
import { N } from '../utils/format.js';

function fmt(value, unit = 'g') {
  const n = N(value);
  return n === null ? '—' : `${Math.round(n * 10) / 10} ${unit}`;
}

function macroCard(label, iconName, grams, basisGrams = 100) {
  const n = N(grams);
  const pct = n === null ? 0 : Math.min(100, (n / basisGrams) * 100);
  return el(
    'div',
    { class: 'macro-card' },
    el('span', { class: 'macro-label' }, icon(iconName, ''), label),
    el(
      'div',
      { class: 'macro-value' },
      n === null ? '—' : String(Math.round(n * 10) / 10),
      el('span', { class: 'macro-unit' }, n === null ? '' : ' g'),
    ),
    el('div', { class: 'progress-inline', role: 'presentation' }, el('span', { style: { width: `${pct}%` } })),
  );
}

/**
 * @param {object|null} nutrition normalized nutrition model
 * @param {{basisNote?: string, title?: string}} options
 */
export function nutritionPanel(nutrition, { basisNote, title = 'Nutrition' } = {}) {
  if (!nutrition) {
    return el(
      'div',
      { class: 'notice is-info' },
      icon('info'),
      el(
        'div',
        {},
        el('strong', {}, 'No nutrition data available'),
        el(
          'p',
          { class: 'muted', style: { marginTop: '2px' } },
          'This data source doesn’t provide nutrition for this item. CULINA never estimates or invents nutritional values — try fruit profiles or packaged food products for verified nutrition.',
        ),
      ),
    );
  }

  const { calories, protein, carbohydrates, fat, sugar, fiber, saturatedFat, salt, sodium, source, basis } = nutrition;

  const hasMacros = [protein, carbohydrates, fat].every((v) => N(v) !== null);
  const energyKcal = hasMacros ? N(protein) * 4 + N(carbohydrates) * 4 + N(fat) * 9 : null;

  const detailRows = [
    ['Sugar', fmt(sugar)],
    ['Fiber', fmt(fiber)],
    ['Saturated fat', fmt(saturatedFat)],
    ['Salt', fmt(salt)],
    ['Sodium', fmt(sodium, 'mg')],
  ];

  const table = el(
    'table',
    { class: 'data-table', style: { minWidth: 0 } },
    el(
      'thead',
      {},
      el('tr', {}, el('th', { scope: 'col' }, 'Nutrient'), el('th', { scope: 'col', style: { textAlign: 'right' } }, 'Value')),
    ),
    el(
      'tbody',
      {},
      ...detailRows.map(([label, value]) =>
        el('tr', {}, el('td', {}, label), el('td', { class: 'num', style: { textAlign: 'right' } }, value)),
      ),
    ),
  );

  return el(
    'div',
    { class: 'nutrition-panel' },
    el(
      'div',
      {},
      el('div', { class: 'calories-hero' }, el('span', { class: 'value' }, calories != null ? String(Math.round(calories)) : '—'), el('span', { class: 'unit' }, 'kcal')),
      el(
        'p',
        { class: 'muted', style: { fontSize: 'var(--text-sm)' } },
        basisNote || `${basis || 'per 100 g'} · reported by ${source || 'the provider'}${energyKcal ? ` · macros ≈ ${Math.round(energyKcal)} kcal (estimated from provided values)` : ''}`,
      ),
    ),
    el('div', { class: 'macro-grid' }, macroCard('Protein', 'beef', protein), macroCard('Carbohydrates', 'wheat', carbohydrates), macroCard('Fat', 'droplet', fat)),
    el(
      'details',
      { class: 'detail-section' },
      el('summary', { style: { cursor: 'pointer', fontWeight: 600, fontSize: 'var(--text-sm)' } }, `Detailed nutrition (${basis || 'per 100 g'})`),
      el(
        'p',
        { class: 'muted', style: { fontSize: 'var(--text-xs)', margin: 'var(--space-3) 0' } },
        'Values are shown exactly as provided by the source. Missing values are not estimated.',
      ),
      el('div', { class: 'data-table-wrap', style: { border: 'none' } }, table),
    ),
  );
}

/** Nutri-Score chip for products (only when the source provides a grade). */
export function nutriscoreBadge(grade) {
  if (!grade || !/^[a-e]$/.test(grade)) return null;
  const colors = { a: 'var(--color-success)', b: '#7fae4e', c: 'var(--color-warning)', d: '#c96a2b', e: 'var(--color-danger)' };
  return el(
    'span',
    {
      class: 'badge',
      style: { background: 'transparent', border: `1.5px solid ${colors[grade]}`, color: colors[grade] },
      title: `Nutri-Score ${grade.toUpperCase()} — as reported by Open Food Facts`,
    },
    `Nutri-Score ${grade.toUpperCase()}`,
  );
}

export function novaBadge(nova) {
  if (nova == null) return null;
  const labels = { 1: 'NOVA 1 · unprocessed', 2: 'NOVA 2 · processed ingredients', 3: 'NOVA 3 · processed', 4: 'NOVA 4 · ultra-processed' };
  return el('span', { class: 'badge badge-neutral', title: 'NOVA food processing group — as reported by Open Food Facts' }, labels[nova] || `NOVA ${nova}`);
}
