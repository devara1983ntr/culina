/**
 * CULINA — Discover page (PRD §12): the discovery engine.
 * Entity switcher + per-entity filters + sorting + grid/list toggle +
 * pagination or load-more + skeletons + shareable URL state (?entity=&…).
 */
import { el, icon } from '../utils/dom.js';
import { refreshIcons } from '../utils/icons.js';
import { applyMeta } from '../seo.js';
import { navigate, replaceUrl } from '../router.js';
import {
  mealdb,
  cocktaildb,
  fruityvice,
  openfoodfacts,
  openbrewerydb,
  beers,
} from '../api/adapters/index.js';
import { entityGrid, itemRoute } from '../components/cards.js';
import { renderTabs } from '../components/tabs.js';
import { chipRow, selectField, viewToggle, searchField, switchField } from '../components/filters.js';
import { loadMoreButton, pagination } from '../components/pagination.js';
import { skeletonGrid, errorState, emptyState, renderInto, partialFailureNotice } from '../components/states.js';
import { pageHeader, mountReveal } from './shared.js';
import { attachTabSwipe } from '../utils/touch.js';
import { userMessage } from '../api/errors.js';

const PAGE_SIZE = 24;
const POPULAR_COCKTAIL_INGREDIENTS = [
  'Gin', 'Vodka', 'Rum', 'Tequila', 'Whiskey', 'Bourbon', 'Brandy', 'Cognac',
  'Champagne', 'Coffee', 'Cream', 'Lime', 'Lemon', 'Orange Juice', 'Cranberry juice',
];
const OBD_COUNTRIES = [
  'United States', 'Germany', 'England', 'Canada', 'Australia', 'Belgium', 'Ireland',
  'Netherlands', 'New Zealand', 'Portugal', 'Scotland', 'Singapore', 'South Africa',
  'South Korea', 'Sweden', 'France', 'Japan', 'Poland', 'Austria',
];
const BREWERY_TYPES = [
  'micro', 'brewpub', 'nano', 'regional', 'large', 'cidery', 'taproom', 'bar',
  'contract', 'proprietor', 'planning', 'closed', 'beergarden',
];

const ENTITY_TAB_IDS = ['recipes', 'cocktails', 'beers', 'breweries', 'fruits', 'products'];

const state = {
  entity: 'recipes',
  category: '',
  cuisine: '',
  q: '',
  nonAlcoholic: false,
  ingredient: '',
  style: 'ale',
  breweryType: '',
  country: '',
  page: 1,
  sort: 'default',
  view: 'grid',
};

function syncUrl() {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(state)) {
    if (value && value !== 'default' && value !== 'grid' && !(key === 'page' && value === 1)) {
      params.set(key, String(value));
    }
  }
  const qs = params.toString();
  replaceUrl(qs ? `/discover?${qs}` : '/discover');
}

function readUrl(query) {
  // Fresh render → reset to defaults, then apply URL params (shareable state).
  Object.assign(state, {
    entity: 'recipes', category: '', cuisine: '', q: '', nonAlcoholic: false,
    ingredient: '', style: 'ale', breweryType: '', country: '', page: 1,
    sort: 'default', view: 'grid',
  });
  for (const key of Object.keys(state)) {
    if (query[key] !== undefined && query[key] !== '' && query[key] !== null) {
      state[key] = query[key];
    }
  }
  state.nonAlcoholic = query.nonAlcoholic === '1';
  state.page = Number(state.page) || 1;
  state.view = state.view === 'list' ? 'list' : 'grid';
}

function sortItems(items) {
  if (state.sort === 'az') return [...items].sort((a, b) => String(a.title).localeCompare(String(b.title)));
  return items;
}

export async function render(ctx) {
  readUrl(ctx.query);
  applyMeta({
    title: 'Discover',
    description: 'Filter and explore recipes, cocktails, beers, breweries, fruits and food products across every verified data source.',
    path: '/discover',
  });

  const resultsHost = el('div');
  const filterHost = el('div');

  const root = el(
    'div',
    { class: 'page' },
    el(
      'div',
      { class: 'container' },
      pageHeader({
        overline: 'Discovery engine',
        title: 'Discover',
        lead: 'One interface, every source. Filters adapt to what each provider actually supports — nothing is simulated.',
      }),
      el('div', { style: { marginBottom: 'var(--space-5)' } }, renderEntityTabs()),
      filterHost,
      resultsHost,
    ),
  );

  function renderEntityTabs() {
    return renderTabs({
      tabs: [
        { id: 'recipes', label: 'Recipes' },
        { id: 'cocktails', label: 'Cocktails' },
        { id: 'beers', label: 'Beers' },
        { id: 'breweries', label: 'Breweries' },
        { id: 'fruits', label: 'Fruits' },
        { id: 'products', label: 'Food Products' },
      ],
      active: state.entity,
      onSelect: (id) => selectEntity(id),
      ariaLabel: 'Choose what to discover',
    });
  }

  const entityTabsHost = root.querySelector('.tabs').parentElement;

  function refreshEntityTabs() {
    entityTabsHost.replaceChildren(renderEntityTabs());
  }

  /** Switch the discovered entity (tab click or horizontal swipe). */
  function selectEntity(id) {
    if (id === state.entity) return;
    Object.assign(state, {
      entity: id, category: '', cuisine: '', q: '', nonAlcoholic: false,
      ingredient: '', breweryType: '', country: '', page: 1,
    });
    syncUrl();
    renderFilters();
    load();
    refreshEntityTabs();
  }

  /* Swipe the results area left/right to move between entity tabs. */
  ctx.onCleanup(
    attachTabSwipe(resultsHost, {
      ids: ENTITY_TAB_IDS,
      getActive: () => state.entity,
      onSelect: selectEntity,
    }),
  );

  function set(patch) {
    Object.assign(state, patch, { page: patch.page ?? 1 });
    syncUrl();
    load();
  }

  /* ------------------------------------------------------------------ */
  /* Filter bars per entity                                              */
  /* ------------------------------------------------------------------ */

  async function renderFilters() {
    renderInto(filterHost, el('div', { class: 'filter-bar' }));

    if (state.entity === 'recipes') {
      const [categories, areas] = await Promise.allSettled([
        mealdb.categories({ signal: ctx.signal }),
        mealdb.areas({ signal: ctx.signal }),
      ]);
      const categoryItems = [
        { id: '', label: 'All categories' },
        ...(categories.status === 'fulfilled' ? categories.value.map((c) => ({ id: c.name, label: c.name })) : []),
      ];
      const areaOptions = [
        { value: '', label: 'All cuisines' },
        ...(areas.status === 'fulfilled' ? areas.value.map((a) => ({ value: a.name, label: a.name })) : []),
      ];
      renderInto(
        filterHost,
        el(
          'div',
          { class: 'filter-bar' },
          chipRow({ items: categoryItems.slice(0, 14), value: state.category, onSelect: (id) => set({ category: id, cuisine: '' }), scrollable: true, ariaLabel: 'Meal categories' }),
          selectField({ id: 'cuisine', label: 'Cuisine', options: areaOptions, value: state.cuisine, onChange: (v) => set({ cuisine: v, category: '' }), hideLabel: false }),
          searchFieldEl(),
          selectField({ id: 'sort', label: 'Sort', options: [{ value: 'default', label: 'Source order' }, { value: 'az', label: 'Name A–Z' }], value: state.sort, onChange: (v) => set({ sort: v }) }),
          viewToggleEl(),
        ),
      );
    } else if (state.entity === 'cocktails') {
      const categories = await cocktaildb.categories({ signal: ctx.signal }).catch(() => []);
      renderInto(
        filterHost,
        el(
          'div',
          { class: 'filter-bar' },
          chipRow({
            items: [{ id: '', label: 'All' }, ...categories.map((c) => ({ id: c.name, label: c.name }))],
            value: state.category,
            onSelect: (id) => set({ category: id, ingredient: '', nonAlcoholic: false }),
            scrollable: true,
            ariaLabel: 'Cocktail categories',
          }),
          chipRow({
            items: POPULAR_COCKTAIL_INGREDIENTS.map((name) => ({ id: name, label: name })),
            value: state.ingredient,
            onSelect: (id) => set({ ingredient: state.ingredient === id ? '' : id, category: '', nonAlcoholic: false }),
            scrollable: true,
            ariaLabel: 'Filter by ingredient',
          }),
          switchField({ id: 'nonalc', label: 'Non-alcoholic only', checked: state.nonAlcoholic, onChange: (v) => set({ nonAlcoholic: v, category: '', ingredient: '' }) }),
          searchFieldEl(),
          viewToggleEl(),
        ),
      );
    } else if (state.entity === 'beers') {
      renderInto(
        filterHost,
        el(
          'div',
          { class: 'filter-bar' },
          chipRow({
            items: [{ id: 'ale', label: 'Ales' }, { id: 'stout', label: 'Stouts' }],
            value: state.style,
            onSelect: (id) => set({ style: id }),
            ariaLabel: 'Beer styles',
          }),
          selectField({ id: 'bsort', label: 'Sort', options: [{ value: 'default', label: 'Source order' }, { value: 'az', label: 'Name A–Z' }, { value: 'rating', label: 'Top rated' }], value: state.sort, onChange: (v) => set({ sort: v }) }),
          viewToggleEl(),
        ),
      );
    } else if (state.entity === 'breweries') {
      const countries = OBD_COUNTRIES.map((c) => ({ value: c, label: c }));
      renderInto(
        filterHost,
        el(
          'div',
          { class: 'filter-bar' },
          searchFieldEl('Search breweries by name'),
          selectField({ id: 'btype', label: 'Type', options: [{ value: '', label: 'All types' }, ...BREWERY_TYPES.map((t) => ({ value: t, label: t[0].toUpperCase() + t.slice(1) }))], value: state.breweryType, onChange: (v) => set({ breweryType: v }) }),
          selectField({ id: 'bcountry', label: 'Country', options: [{ value: '', label: 'All countries' }, ...countries], value: state.country, onChange: (v) => set({ country: v }) }),
          viewToggleEl(),
        ),
      );
    } else if (state.entity === 'fruits') {
      renderInto(
        filterHost,
        el(
          'div',
          { class: 'filter-bar' },
          searchFieldEl('Search fruits…'),
          selectField({ id: 'fsort', label: 'Sort', options: [{ value: 'default', label: 'Source order' }, { value: 'az', label: 'Name A–Z' }], value: state.sort, onChange: (v) => set({ sort: v }) }),
          viewToggleEl(),
        ),
      );
    } else if (state.entity === 'products') {
      renderInto(
        filterHost,
        el(
          'div',
          { class: 'filter-bar' },
          searchFieldEl('Search food products…'),
          viewToggleEl(),
        ),
      );
    }
    refreshIcons();
  }

  function searchFieldEl(placeholder = 'Search by name…') {
    const field = searchField({
      id: `discover-q-${state.entity}`,
      placeholder,
      value: state.q,
      onInput: () => {},
      onSubmit: (value) => set({ q: value.trim() }),
      submitLabel: 'Go',
    });
    field.element.style.minWidth = '210px';
    field.element.style.flex = '0 1 240px';
    return field.element;
  }

  function viewToggleEl() {
    return viewToggle({
      value: state.view,
      onChange: (value) => {
        state.view = value;
        syncUrl();
        load();
      },
    });
  }

  /* ------------------------------------------------------------------ */
  /* Data loading per entity                                             */
  /* ------------------------------------------------------------------ */

  async function load() {
    renderInto(resultsHost, skeletonGrid(PAGE_SIZE / 2));
    try {
      switch (state.entity) {
        case 'recipes':
          return await loadRecipes();
        case 'cocktails':
          return await loadCocktails();
        case 'beers':
          return await loadBeers();
        case 'breweries':
          return await loadBreweries();
        case 'fruits':
          return await loadFruits();
        case 'products':
          return await loadProducts();
      }
    } catch (err) {
      if (err?.name === 'AbortError') return;
      renderInto(
        resultsHost,
        errorState({ error: err, onRetry: () => load() }),
      );
      refreshIcons();
    }
  }

  function renderList({ entity, items, shown = PAGE_SIZE, emptyMessage, loadMore = true }) {
    if (!items.length) {
      renderInto(
        resultsHost,
        emptyState({
          icon: 'search',
          title: 'Nothing matched those filters',
          message: emptyMessage || 'Try removing a filter or broadening your search — every source is still live.',
          actionLabel: 'Reset filters',
          onAction: () => {
            Object.assign(state, { category: '', cuisine: '', q: '', nonAlcoholic: false, ingredient: '', page: 1, sort: 'default' });
            syncUrl();
            renderFilters();
            load();
          },
        }),
      );
      refreshIcons();
      return;
    }
    const visible = sortItems(items).slice(0, shown);
    const grid = entityGrid(visible, { entity });
    grid.classList.toggle('is-list', state.view === 'list');

    renderInto(
      resultsHost,
      el(
        'div',
        { class: 'results-meta' },
        el('span', { class: 'results-count' },
          el('strong', {}, String(items.length)),
          ` result${items.length === 1 ? '' : 's'} · ${sourceName()}`),
      ),
      grid,
      loadMore && shown < items.length
        ? loadMoreButton({
            label: `Show ${Math.min(PAGE_SIZE, items.length - shown)} more`,
            onClick: () => renderList({ entity, items, shown: shown + PAGE_SIZE, emptyMessage, loadMore: true }),
          })
        : null,
    );
    refreshIcons();
    mountReveal(ctx, grid);
  }

  function sourceName() {
    return {
      recipes: 'TheMealDB',
      cocktails: 'TheCocktailDB',
      beers: 'SampleAPIs (community dataset)',
      breweries: 'Open Brewery DB',
      fruits: 'Fruityvice',
      products: 'Open Food Facts',
    }[state.entity];
  }

  async function loadRecipes() {
    let items;
    if (state.q) items = await mealdb.searchByName(state.q, { signal: ctx.signal });
    else if (state.category) items = await mealdb.filterByCategory(state.category, { signal: ctx.signal });
    else if (state.cuisine) items = await mealdb.filterByArea(state.cuisine, { signal: ctx.signal });
    else {
      const categories = await mealdb.categories({ signal: ctx.signal });
      const fallback = categories[new Date().getDate() % categories.length];
      items = await mealdb.filterByCategory(fallback.name, { signal: ctx.signal });
    }
    renderList({ entity: 'recipe', items, emptyMessage: 'No recipes matched. Try a cuisine (e.g. Italian) or a category (e.g. Dessert).' });
  }

  async function loadCocktails() {
    let items;
    if (state.q) items = await cocktaildb.searchByName(state.q, { signal: ctx.signal });
    else if (state.nonAlcoholic) items = await cocktaildb.filterNonAlcoholic({ signal: ctx.signal });
    else if (state.ingredient) items = await cocktaildb.filterByIngredient(state.ingredient, { signal: ctx.signal });
    else if (state.category) items = await cocktaildb.filterByCategory(state.category, { signal: ctx.signal });
    else items = await cocktaildb.filterByCategory('Cocktail', { signal: ctx.signal });
    renderList({ entity: 'cocktail', items, emptyMessage: 'No cocktails matched. Try “Gin”, a category, or non-alcoholic only.' });
  }

  async function loadBeers() {
    const { ales, stouts, failures } = await beers.all({ signal: ctx.signal });
    let items = state.style === 'stout' ? stouts : ales;
    if (state.sort === 'rating') {
      items = [...items].sort((a, b) => (b.rating?.average ?? 0) - (a.rating?.average ?? 0));
    }
    const notice = failures.length ? partialFailureNotice(failures.map((f) => ({ provider: 'sampleapis-beers', label: 'SampleAPIs Beers', message: f?.message }))) : null;
    renderList({ entity: 'beer', items, emptyMessage: 'This beer list came back empty — the community dataset may be updating.' });
    if (notice) resultsHost.prepend(notice);
  }

  async function loadBreweries() {
    const perPage = 24;
    const items = await openbrewerydb.list({
      page: state.page,
      perPage,
      byType: state.breweryType || undefined,
      byCountry: state.country || undefined,
      byName: state.q || undefined,
      signal: ctx.signal,
    });
    if (!items.length && state.page > 1) {
      renderInto(
        resultsHost,
        emptyState({
          icon: 'building-2',
          title: 'No more breweries on this page',
          message: 'You’ve reached the end of the results for these filters.',
          actionLabel: 'Back to page 1',
          onAction: () => set({ page: 1 }),
        }),
      );
      refreshIcons();
      return;
    }
    const grid = entityGrid(items, { entity: 'brewery' });
    grid.classList.toggle('is-list', state.view === 'list');
    renderInto(
      resultsHost,
      el(
        'div',
        { class: 'results-meta' },
        el('span', { class: 'results-count' }, 'Page ', el('strong', {}, String(state.page)), ' · Open Brewery DB (rate-limited source, results cached 10 min)'),
      ),
      grid,
      pagination({
        page: state.page,
        totalPages: items.length < perPage ? state.page : state.page + 1,
        onPage: (p) => set({ page: p }),
        ariaLabel: 'Brewery pages',
      }),
    );
    refreshIcons();
    mountReveal(ctx, grid);
  }

  async function loadFruits() {
    const all = await fruityvice.listFruits({ signal: ctx.signal });
    const tokens = state.q.trim().toLowerCase();
    const items = tokens ? all.filter((f) => f.name.toLowerCase().includes(tokens)) : all;
    renderList({ entity: 'fruit', items, emptyMessage: 'No fruits matched that name. Fruityvice indexes 40+ botanical fruits — try “berry” or “melon”.' });
  }

  async function loadProducts() {
    if (!state.q) {
      renderInto(
        resultsHost,
        emptyState({
          icon: 'package',
          title: 'Search the world’s open food database',
          message: 'Open Food Facts holds 3M+ packaged products with ingredients, Nutri-Score and per-100 g nutrition. Search by product or brand — or look one up by barcode on the product page.',
          actionLabel: 'Try “nutella”',
          onAction: () => set({ q: 'nutella' }),
        }),
      );
      refreshIcons();
      return;
    }
    const { products, count } = await openfoodfacts.search(state.q, { page: state.page, pageSize: 24, signal: ctx.signal });
    const grid = entityGrid(products, { entity: 'product' });
    grid.classList.toggle('is-list', state.view === 'list');
    renderInto(
      resultsHost,
      el(
        'div',
        { class: 'results-meta' },
        el('span', { class: 'results-count' },
          count ? `${count.toLocaleString()} matches` : 'Results',
          ' · Open Food Facts'),
      ),
      grid,
      pagination({ page: state.page, totalPages: Math.max(1, Math.ceil((count || products.length) / 24)), onPage: (p) => set({ page: p }), ariaLabel: 'Product pages' }),
    );
    refreshIcons();
    mountReveal(ctx, grid);
  }

  renderFilters();
  load();
  refreshIcons();
  return root;
}
