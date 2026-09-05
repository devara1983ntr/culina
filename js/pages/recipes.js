/**
 * CULINA — Recipes explorer (PRD §13).
 */
import { el, icon } from '../utils/dom.js';
import { refreshIcons } from '../utils/icons.js';
import { applyMeta } from '../seo.js';
import { mealdb } from '../api/adapters/index.js';
import { entityGrid } from '../components/cards.js';
import { chipRow, selectField, viewToggle, searchField } from '../components/filters.js';
import { loadMoreButton } from '../components/pagination.js';
import { skeletonGrid, emptyState, errorState, renderInto } from '../components/states.js';
import { pageHeader, mountReveal } from './shared.js';
import { replaceUrl } from '../router.js';

const PAGE_SIZE = 24;

export async function render(ctx) {
  applyMeta({
    title: 'Recipes',
    description: 'Browse hundreds of recipes by category and cuisine — live from TheMealDB, with full ingredients and instructions.',
    path: '/recipes',
  });

  let state = { category: ctx.query.category || '', cuisine: ctx.query.cuisine || '', q: ctx.query.q || '', sort: 'default', view: 'grid' };
  let shown = PAGE_SIZE;

  const filterHost = el('div');
  const resultsHost = el('div');

  const root = el(
    'div',
    { class: 'page' },
    el(
      'div',
      { class: 'container' },
      pageHeader({
        overline: 'TheMealDB · live',
        title: 'Recipes',
        lead: 'Full meals with ingredients, measures and step-by-step instructions. Filter by category or cuisine, or search by name.',
      }),
      filterHost,
      resultsHost,
    ),
  );

  function syncUrl() {
    const params = new URLSearchParams();
    if (state.category) params.set('category', state.category);
    if (state.cuisine) params.set('cuisine', state.cuisine);
    if (state.q) params.set('q', state.q);
    const qs = params.toString();
    replaceUrl(qs ? `/recipes?${qs}` : '/recipes');
  }

  async function renderFilters() {
    const [categories, areas] = await Promise.allSettled([
      mealdb.categories({ signal: ctx.signal }),
      mealdb.areas({ signal: ctx.signal }),
    ]);
    const categoryItems = [
      { id: '', label: 'All' },
      ...(categories.status === 'fulfilled' ? categories.value.map((c) => ({ id: c.name, label: c.name })) : []),
    ];
    const areaOptions = [
      { value: '', label: 'All cuisines' },
      ...(areas.status === 'fulfilled' ? areas.value.map((a) => ({ value: a.name, label: a.name })) : []),
    ];

    const search = searchField({
      id: 'recipes-q',
      placeholder: 'Search recipes by name…',
      value: state.q,
      onSubmit: (value) => {
        state.q = value.trim();
        syncUrl();
        load();
      },
      submitLabel: 'Search',
    });
    search.element.style.flex = '0 1 260px';

    renderInto(
      filterHost,
      el(
        'div',
        { class: 'filter-bar' },
        el(
          'div',
          { style: { width: '100%' } },
          chipRow({ items: categoryItems, value: state.category, onSelect: (id) => { state.category = id; state.cuisine = ''; shown = PAGE_SIZE; syncUrl(); load(); }, scrollable: true, ariaLabel: 'Categories' }),
        ),
        search.element,
        selectField({ id: 'recipes-cuisine', label: 'Cuisine', options: areaOptions, value: state.cuisine, onChange: (v) => { state.cuisine = v; state.category = ''; shown = PAGE_SIZE; syncUrl(); load(); } }),
        selectField({ id: 'recipes-sort', label: 'Sort', options: [{ value: 'default', label: 'Source order' }, { value: 'az', label: 'Name A–Z' }], value: state.sort, onChange: (v) => { state.sort = v; shown = PAGE_SIZE; load(); } }),
        viewToggle({ value: state.view, onChange: (v) => { state.view = v; load(); } }),
      ),
    );
    refreshIcons();
  }

  async function load() {
    renderInto(resultsHost, skeletonGrid(8));
    try {
      let items;
      if (state.q) {
        items = await mealdb.searchByName(state.q, { signal: ctx.signal });
      } else if (state.category) {
        items = await mealdb.filterByCategory(state.category, { signal: ctx.signal });
      } else if (state.cuisine) {
        items = await mealdb.filterByArea(state.cuisine, { signal: ctx.signal });
      } else {
        const categories = await mealdb.categories({ signal: ctx.signal });
        const featured = categories[new Date().getDate() % categories.length];
        state.category = featured.name;
        items = await mealdb.filterByCategory(featured.name, { signal: ctx.signal });
        renderFilters();
      }

      if (state.sort === 'az') items = [...items].sort((a, b) => a.title.localeCompare(b.title));

      if (!items.length) {
        renderInto(
          resultsHost,
          emptyState({
            icon: 'utensils-crossed',
            title: 'No recipes found',
            message: 'Try another ingredient or cuisine — or clear the search to browse today’s featured category.',
            actionLabel: 'Clear filters',
            onAction: () => {
              state = { ...state, category: '', cuisine: '', q: '' };
              syncUrl();
              renderFilters();
              load();
            },
          }),
        );
        refreshIcons();
        return;
      }

      const visible = items.slice(0, shown);
      const grid = entityGrid(visible, { entity: 'recipe' });
      grid.classList.toggle('is-list', state.view === 'list');

      renderInto(
        resultsHost,
        el(
          'div',
          { class: 'results-meta' },
          el('span', { class: 'results-count' }, el('strong', {}, String(items.length)), ` recipe${items.length === 1 ? '' : 's'}${state.category ? ` · ${state.category}` : ''}${state.cuisine ? ` · ${state.cuisine}` : ''} · TheMealDB`),
        ),
        grid,
        shown < items.length
          ? loadMoreButton({ label: `Show ${Math.min(PAGE_SIZE, items.length - shown)} more`, onClick: () => { shown += PAGE_SIZE; load(); } })
          : null,
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
