/**
 * CULINA — “What can I cook?” (PRD §61): ingredient matcher.
 * Ranks recipes by overlap with the user’s pantry and states the exact match
 * count (“3/5 ingredients matched”) — never implying missing items are
 * unnecessary.
 */
import { el, icon } from '../utils/dom.js';
import { refreshIcons } from '../utils/icons.js';
import { applyMeta } from '../seo.js';
import { mealdb } from '../api/adapters/index.js';
import { entityCard, itemRoute } from '../components/cards.js';
import { skeletonGrid, emptyState, renderInto, partialFailureNotice } from '../components/states.js';
import { pageHeader, mountReveal } from './shared.js';
import { ingredientKey } from '../utils/format.js';

const QUICK_START = ['Chicken', 'Rice', 'Tomato', 'Onion', 'Garlic', 'Butter', 'Egg', 'Potato'];
const MAX_INGREDIENTS = 8;

export async function render(ctx) {
  let selected = [];
  let ingredientIndex = [];

  applyMeta({
    title: 'Kitchen Match',
    description: 'Add what’s in your kitchen and CULINA ranks recipes by ingredient overlap — showing exactly how many of your items each recipe uses.',
    path: '/kitchen',
  });

  const picker = el('div', { class: 'kitchen-picker', role: 'group', 'aria-label': 'Your ingredients', tabindex: '-1' });
  const input = el('input', {
    type: 'text',
    class: 'kitchen-input',
    placeholder: 'Type an ingredient (e.g. chicken)…',
    'aria-label': 'Add an ingredient',
    autocomplete: 'off',
  });
  const suggestHost = el('div');
  const suggestWrap = el('div', { style: { position: 'relative', flex: 1, minWidth: 0 } }, input, suggestHost);
  const findButton = el('button', { class: 'btn btn-primary', type: 'button', disabled: '' }, icon('search'), 'Find recipes');
  const clearButton = el('button', { class: 'btn btn-ghost', type: 'button', hidden: '' }, icon('trash-2'), 'Clear all');
  clearButton.addEventListener('click', () => {
    selected = [];
    renderChips();
    renderQuickPicks();
    resultsHost.replaceChildren();
    input.focus();
  });
  const resultsHost = el('div');
  const hint = el('p', { class: 'muted', style: { fontSize: 'var(--text-sm)', marginTop: 'var(--space-2)' } }, 'You haven’t added anything yet — type above or tap a quick pick to add your first ingredient.');

  const root = el(
    'div',
    { class: 'page' },
    el(
      'div',
      { class: 'container' },
      pageHeader({
        overline: 'What’s in your kitchen?',
        title: 'Cook with what you have',
        lead: 'Add your ingredients and CULINA ranks recipes by how many of them each dish actually uses — with the match count stated on every card.',
      }),
      el(
        'form',
        {
          class: 'stack-3',
          onsubmit: (event) => {
            event.preventDefault();
            find();
          },
        },
        picker,
        hint,
        el('div', { class: 'cluster' }, findButton, clearButton),
      ),
      resultsHost,
    ),
  );

  picker.addEventListener('click', () => input.focus());

  function renderChips() {
    clearButton.toggleAttribute('hidden', selected.length === 0);
    const chips = selected.map((name, index) => {
      const removeButton = el('button', { type: 'button', 'aria-label': `Remove ${name}` }, icon('x'));
      removeButton.addEventListener('click', () => {
        selected.splice(index, 1);
        renderChips();
        renderQuickPicks();
      });
      return el('span', { class: 'kitchen-chip' }, name, removeButton);
    });
    picker.replaceChildren(...chips, suggestWrap);
    findButton.disabled = selected.length === 0;
    findButton.replaceChildren(icon('search'), selected.length ? `Find recipes (${selected.length})` : 'Find recipes');
    refreshIcons();
  }

  function renderQuickPicks() {
    const missing = QUICK_START.filter((name) => !selected.includes(name));
    if (!missing.length || selected.length >= MAX_INGREDIENTS) {
      hint.textContent = selected.length
        ? `${selected.length} ingredient${selected.length === 1 ? '' : 's'} added — press Find recipes.`
        : `Up to ${MAX_INGREDIENTS} ingredients.`;
      return;
    }
    hint.replaceChildren(
      el('span', {}, selected.length ? 'Add more: ' : 'Quick picks: '),
      ...missing.slice(0, 5).map((name) =>
        el(
          'button',
          {
            class: 'chip',
            type: 'button',
            style: { minHeight: '28px', padding: '2px 12px', fontSize: 'var(--text-xs)' },
            onclick: () => addIngredient(name),
          },
          '+ ' + name,
        ),
      ),
    );
  }

  function addIngredient(name) {
    const clean = name.trim();
    if (!clean) return;
    const exists = selected.some((s) => ingredientKey(s) === ingredientKey(clean));
    if (!exists && selected.length < MAX_INGREDIENTS) selected.push(clean.charAt(0).toUpperCase() + clean.slice(1));
    input.value = '';
    renderChips();
    renderQuickPicks();
    renderSuggestions('');
  }

  function renderSuggestions(term) {
    const q = term.trim().toLowerCase();
    if (!q || !ingredientIndex.length) {
      suggestHost.replaceChildren();
      return;
    }
    const matches = ingredientIndex
      .filter((item) => item.name.toLowerCase().includes(q) && !selected.some((s) => ingredientKey(s) === ingredientKey(item.name)))
      .slice(0, 8);
    if (!matches.length) {
      suggestHost.replaceChildren();
      return;
    }
    const box = el(
      'div',
      { class: 'autosuggest', role: 'listbox', 'aria-label': 'Ingredient suggestions' },
      ...matches.map((item) =>
        el(
          'button',
          { type: 'button', role: 'option', 'aria-selected': 'false' },
          el('span', {}, item.name),
          el('span', { class: 'muted', style: { fontSize: 'var(--text-xs)' } }, item.type || ''),
        ),
      ),
    );
    box.querySelectorAll('button').forEach((button, i) => {
      button.addEventListener('click', () => addIngredient(matches[i].name));
    });
    suggestHost.replaceChildren(box);
  }

  input.addEventListener('input', () => renderSuggestions(input.value));
  input.addEventListener('keydown', (event) => {
    const options = [...suggestHost.querySelectorAll('button')];
    if (event.key === 'Enter') {
      if (options.length) {
        event.preventDefault();
        options[0].click();
      }
    } else if (event.key === 'ArrowDown' && options.length) {
      event.preventDefault();
      options[0].focus();
    }
  });
  suggestHost.addEventListener('keydown', (event) => {
    const options = [...suggestHost.querySelectorAll('button')];
    const index = options.indexOf(document.activeElement);
    if (event.key === 'ArrowDown' && index < options.length - 1) {
      event.preventDefault();
      options[index + 1].focus();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (index > 0) options[index - 1].focus();
      else input.focus();
    } else if (event.key === 'Enter' && index >= 0) {
      event.preventDefault();
      options[index].click();
      input.focus();
    }
  });

  async function find() {
    if (!selected.length) return;
    renderInto(resultsHost, skeletonGrid(6));
    const settled = await Promise.allSettled(selected.map((name) => mealdb.filterByIngredient(name, { signal: ctx.signal })));
    const failures = [];
    const perIngredient = new Map(); // ingredient -> Set of meal ids

    settled.forEach((result, i) => {
      if (result.status === 'rejected') {
        if (result.reason?.name === 'AbortError') return;
        failures.push(selected[i]);
        return;
      }
      perIngredient.set(selected[i], new Set(result.value.map((meal) => meal.id)));
    });

    if (!perIngredient.size) {
      renderInto(
        resultsHost,
        partialFailureNotice(failures.map((name) => ({ provider: 'mealdb', label: name, message: 'lookup failed' }))),
        emptyState({
          icon: 'alert-triangle',
          title: 'Couldn’t match your kitchen',
          message: 'TheMealDB didn’t respond for any of your ingredients. Try again in a moment.',
          actionLabel: 'Retry',
          onAction: () => find(),
        }),
      );
      refreshIcons();
      return;
    }

    const matchCounts = new Map();
    for (const ids of perIngredient.values()) {
      for (const id of ids) matchCounts.set(id, (matchCounts.get(id) || 0) + 1);
    }
    const catalog = new Map();
    for (const result of settled) {
      if (result.status === 'fulfilled') result.value.forEach((meal) => catalog.set(meal.id, meal));
    }

    const working = [...perIngredient.keys()];
    const ranked = [...matchCounts.entries()]
      .map(([id, count]) => ({ meal: catalog.get(id), count }))
      .filter((entry) => entry.meal)
      .sort((a, b) => b.count - a.count || a.meal.title.localeCompare(b.meal.title))
      .slice(0, 24);

    if (!ranked.length) {
      renderInto(
        resultsHost,
        emptyState({
          icon: 'chef-hat',
          title: 'No recipes used those ingredients',
          message: 'TheMealDB matches one main ingredient per recipe — try removing rare items or adding staples like rice, eggs or chicken.',
          actionLabel: 'Adjust ingredients',
          onAction: () => input.focus(),
        }),
      );
      refreshIcons();
      return;
    }

    const pct = (count) => Math.round((count / working.length) * 100);
    const grid = el(
      'div',
      { class: 'grid-cards' },
      ...ranked.map(({ meal, count }) =>
        entityCard({
          entity: 'recipe',
          item: meal,
          badgeExtra: el(
            'span',
            { class: `badge numeric ${pct(count) === 100 ? 'badge-success' : 'badge-accent'}`, title: `${count} of your ${working.length} ingredients appear in this recipe` },
            `${count}/${working.length} · ${pct(count)}%`,
          ),
        }),
      ),
    );

    const checkHost = el('div');
    renderInto(
      resultsHost,
      el(
        'div',
        { class: 'results-meta' },
        el('span', { class: 'results-count' }, el('strong', {}, String(ranked.length)), ` recipe${ranked.length === 1 ? '' : 's'} ranked by overlap with your ${working.length} ingredients`),
      ),
      el(
        'div',
        { class: 'notice is-info' },
        icon('info'),
        el(
          'span',
          {},
          `Match counts show how many of your selected ingredients each recipe contains — recipes may require additional items not in your kitchen.`,
        ),
      ),
      grid,
      checkHost,
      failures.length ? partialFailureNotice(failures.map((name) => ({ provider: 'mealdb', label: name, message: 'lookup failed' }))) : null,
    );
    refreshIcons();
    mountReveal(ctx, grid);
    enrichTopMatches(ranked.slice(0, 6), working, checkHost);
  }

  /**
   * Fetch full recipes for the top matches and list exactly which of your
   * ingredients they use and which of their ingredients you’re missing.
   * Honest by design: “missing” is always shown, never implied away.
   */
  async function enrichTopMatches(top, working, host) {
    const settled = await Promise.allSettled(top.map(({ meal }) => mealdb.lookup(meal.sourceId, { signal: ctx.signal })));
    const rows = [];
    settled.forEach((result, i) => {
      if (result.status !== 'fulfilled' || !result.value) return;
      const recipe = result.value;
      const mine = new Set(working.map((name) => ingredientKey(name)));
      const have = [];
      const missing = [];
      for (const ingredient of recipe.ingredients) {
        if (!ingredient.name) continue;
        (mine.has(ingredientKey(ingredient.name)) ? have : missing).push(ingredient.name);
      }
      rows.push({ recipe, have, missing });
    });
    if (!host.isConnected || !rows.length) return;
    renderInto(
      host,
      el(
        'section',
        { class: 'detail-section', style: { marginTop: 'var(--space-5)' }, 'aria-labelledby': 'kitchen-check-h' },
        el('h2', { id: 'kitchen-check-h', style: { fontSize: '1.15rem' } }, icon('search-check'), 'Ingredient check — top matches'),
        ...rows.map((row) =>
          el(
            'div',
            { class: 'kitchen-check-row' },
            el('a', { class: 'kitchen-check-title', href: itemRoute('recipe', row.recipe) }, row.recipe.title),
            el(
              'div',
              { class: 'cluster', style: { flexWrap: 'wrap', gap: 'var(--space-2)' } },
              row.have.length
                ? el('span', { class: 'badge badge-success' }, icon('check'), ` You have: ${row.have.slice(0, 6).join(', ')}${row.have.length > 6 ? ` +${row.have.length - 6}` : ''}`)
                : el('span', { class: 'badge badge-neutral' }, 'None of your ingredients listed'),
              row.missing.length
                ? el('span', { class: 'badge badge-warning' }, icon('circle-slash'), ` Missing: ${row.missing.slice(0, 6).join(', ')}${row.missing.length > 6 ? ` +${row.missing.length - 6}` : ''}`)
                : el('span', { class: 'badge badge-success' }, icon('check'), ' Everything listed is in your kitchen'),
            ),
          ),
        ),
        el('p', { class: 'muted', style: { fontSize: 'var(--text-xs)', marginTop: 'var(--space-3)' } }, 'Full ingredient lists fetched live from TheMealDB — summaries may omit items; the recipe page always shows the complete list.'),
      ),
    );
    refreshIcons();
  }

  findButton.addEventListener('click', find);

  /* Load the ingredient index for suggestions (cached 24h) */
  mealdb
    .ingredientList({ signal: ctx.signal })
    .then((list) => {
      ingredientIndex = list;
    })
    .catch(() => {
      /* Suggestions are optional — manual entry still works */
    });

  renderChips();
  renderQuickPicks();
  if (ctx.query.add) {
    addIngredient(String(ctx.query.add));
  }
  refreshIcons();
  return root;
}
