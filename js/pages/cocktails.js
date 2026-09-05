/**
 * CULINA — Cocktails explorer (PRD §16).
 */
import { el, icon } from '../utils/dom.js';
import { refreshIcons } from '../utils/icons.js';
import { applyMeta } from '../seo.js';
import { cocktaildb } from '../api/adapters/index.js';
import { entityGrid } from '../components/cards.js';
import { chipRow, searchField, switchField, viewToggle } from '../components/filters.js';
import { loadMoreButton } from '../components/pagination.js';
import { skeletonGrid, emptyState, errorState, renderInto } from '../components/states.js';
import { pageHeader, mountReveal } from './shared.js';
import { replaceUrl } from '../router.js';

const PAGE_SIZE = 24;
const POPULAR = ['Gin', 'Vodka', 'Rum', 'Tequila', 'Whiskey', 'Bourbon', 'Brandy', 'Champagne', 'Coffee', 'Cream'];

export async function render(ctx) {
  let state = {
    q: ctx.query.q || '',
    category: ctx.query.category || '',
    ingredient: ctx.query.ingredient || '',
    nonAlcoholic: ctx.query.nonAlcoholic === '1',
    view: 'grid',
    sort: 'default',
  };
  let shown = PAGE_SIZE;

  applyMeta({
    title: 'Cocktails',
    description: 'Explore cocktails by category, base spirit or non-alcoholic — with ingredients, measures and glassware from TheCocktailDB.',
    path: '/cocktails',
  });

  const filterHost = el('div');
  const resultsHost = el('div');

  const root = el(
    'div',
    { class: 'page' },
    el(
      'div',
      { class: 'container' },
      pageHeader({
        overline: 'TheCocktailDB · live',
        title: 'Cocktails',
        lead: 'Every recipe carries its full ingredient list with measures, the correct glass and IBA classification where applicable.',
      }),
      filterHost,
      resultsHost,
    ),
  );

  function syncUrl() {
    const params = new URLSearchParams();
    if (state.q) params.set('q', state.q);
    if (state.category) params.set('category', state.category);
    if (state.ingredient) params.set('ingredient', state.ingredient);
    if (state.nonAlcoholic) params.set('nonAlcoholic', '1');
    const qs = params.toString();
    replaceUrl(qs ? `/cocktails?${qs}` : '/cocktails');
  }

  async function renderFilters() {
    const categories = await cocktaildb.categories({ signal: ctx.signal }).catch(() => []);
    const search = searchField({
      id: 'cocktails-q',
      placeholder: 'Search by name (e.g. margarita)…',
      value: state.q,
      onSubmit: (value) => {
        state.q = value.trim();
        state.category = '';
        state.ingredient = '';
        state.nonAlcoholic = false;
        shown = PAGE_SIZE;
        syncUrl();
        load();
      },
      submitLabel: 'Search',
    });
    search.element.style.flex = '0 1 250px';

    renderInto(
      filterHost,
      el(
        'div',
        { class: 'filter-bar', style: { flexDirection: 'column', alignItems: 'stretch' } },
        el(
          'div',
          { style: { overflow: 'hidden' } },
          chipRow({
            items: [{ id: '', label: 'All categories' }, ...categories.map((c) => ({ id: c.name, label: c.name }))],
            value: state.category,
            onSelect: (id) => {
              state.category = id;
              state.q = '';
              state.ingredient = '';
              state.nonAlcoholic = false;
              shown = PAGE_SIZE;
              syncUrl();
              load();
            },
            scrollable: true,
            ariaLabel: 'Cocktail categories',
          }),
        ),
        el(
          'div',
          { class: 'cluster', style: { flexWrap: 'wrap' } },
          el('span', { class: 'filter-label' }, 'Base spirit'),
          chipRow({
            items: POPULAR.map((name) => ({ id: name, label: name })),
            value: state.ingredient,
            onSelect: (id) => {
              state.ingredient = state.ingredient === id ? '' : id;
              state.q = '';
              state.category = '';
              state.nonAlcoholic = false;
              shown = PAGE_SIZE;
              syncUrl();
              load();
            },
            ariaLabel: 'Base spirit',
          }),
        ),
        el(
          'div',
          { class: 'cluster' },
          search.element,
          switchField({
            id: 'nonalc',
            label: 'Non-alcoholic only',
            checked: state.nonAlcoholic,
            onChange: (v) => {
              state.nonAlcoholic = v;
              state.q = '';
              state.category = '';
              state.ingredient = '';
              shown = PAGE_SIZE;
              syncUrl();
              load();
            },
          }),
          viewToggle({ value: state.view, onChange: (v) => { state.view = v; load(); } }),
        ),
      ),
    );
    refreshIcons();
  }

  async function load() {
    renderInto(resultsHost, skeletonGrid(8));
    try {
      let items;
      let label;
      if (state.q) {
        items = await cocktaildb.searchByName(state.q, { signal: ctx.signal });
        label = `Search: “${state.q}”`;
      } else if (state.nonAlcoholic) {
        items = await cocktaildb.filterNonAlcoholic({ signal: ctx.signal });
        label = 'Non-alcoholic';
      } else if (state.ingredient) {
        items = await cocktaildb.filterByIngredient(state.ingredient, { signal: ctx.signal });
        label = `With ${state.ingredient}`;
      } else if (state.category) {
        items = await cocktaildb.filterByCategory(state.category, { signal: ctx.signal });
        label = state.category;
      } else {
        items = await cocktaildb.filterByCategory('Cocktail', { signal: ctx.signal });
        label = 'Cocktail classics';
      }

      if (state.sort === 'az') items = [...items].sort((a, b) => a.title.localeCompare(b.title));

      if (!items.length) {
        renderInto(
          resultsHost,
          emptyState({
            icon: 'martini',
            title: 'No cocktails found',
            message: 'Try a base spirit like Gin, a category, or the non-alcoholic filter.',
            actionLabel: 'Reset filters',
            onAction: () => {
              state = { ...state, q: '', category: '', ingredient: '', nonAlcoholic: false };
              shown = PAGE_SIZE;
              syncUrl();
              load();
            },
          }),
        );
        refreshIcons();
        return;
      }

      const grid = entityGrid(items.slice(0, shown), { entity: 'cocktail' });
      grid.classList.toggle('is-list', state.view === 'list');
      renderInto(
        resultsHost,
        el(
          'div',
          { class: 'results-meta' },
          el('span', { class: 'results-count' }, el('strong', {}, String(items.length)), ` cocktail${items.length === 1 ? '' : 's'} · ${label} · TheCocktailDB`),
        ),
        grid,
        shown < items.length ? loadMoreButton({ label: `Show ${Math.min(PAGE_SIZE, items.length - shown)} more`, onClick: () => { shown += PAGE_SIZE; load(); } }) : null,
      );
      refreshIcons();
      mountReveal(ctx, grid);
    } catch (err) {
      if (err?.name === 'AbortError') return;
      renderInto(resultsHost, errorState({ error: err, onRetry: () => load() }));
      refreshIcons();
    }
  }

  renderFilters();
  load();
  refreshIcons();
  return root;
}
