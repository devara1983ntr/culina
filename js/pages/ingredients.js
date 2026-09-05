/**
 * CULINA — Ingredients explorer (PRD §14): pantry index (TheMealDB) + fruits
 * (Fruityvice, with real nutrition).
 */
import { el, icon } from '../utils/dom.js';
import { refreshIcons } from '../utils/icons.js';
import { applyMeta } from '../seo.js';
import { mealdb, fruityvice } from '../api/adapters/index.js';
import { entityGrid } from '../components/cards.js';
import { searchField, viewToggle } from '../components/filters.js';
import { renderTabs } from '../components/tabs.js';
import { attachTabSwipe } from '../utils/touch.js';
import { loadMoreButton } from '../components/pagination.js';
import { skeletonGrid, errorState, emptyState, renderInto } from '../components/states.js';
import { pageHeader, mountReveal } from './shared.js';
import { replaceUrl } from '../router.js';

const PAGE_SIZE = 36;

export async function render(ctx) {
  let tab = ctx.query.tab === 'fruits' ? 'fruits' : 'pantry';
  let query = '';
  let shown = PAGE_SIZE;

  applyMeta({
    title: 'Ingredients',
    description: 'Explore the pantry ingredient index from TheMealDB and botanical fruit profiles with real nutrition from Fruityvice.',
    path: `/ingredients?tab=${tab}`,
  });

  const tabsHost = el('div', { style: { marginBottom: 'var(--space-4)' } });
  const toolsHost = el('div');
  const resultsHost = el('div');

  const root = el(
    'div',
    { class: 'page' },
    el(
      'div',
      { class: 'container' },
      pageHeader({
        overline: 'Ingredients & fruits',
        title: 'Ingredients',
        lead: 'Two complementary sources: a pantry index of 570+ cooking ingredients, and botanical fruit profiles with verified nutrition.',
      }),
      tabsHost,
      toolsHost,
      resultsHost,
    ),
  );

  function renderTabsBar() {
    renderInto(
      tabsHost,
      renderTabs({
        tabs: [
          { id: 'pantry', label: 'Pantry index' },
          { id: 'fruits', label: 'Fruits & nutrition' },
        ],
        active: tab,
        onSelect: (id) => selectTab(id),
        ariaLabel: 'Ingredient sources',
      }),
    );
  }

  /** Switch source tab (tab click or horizontal swipe on results). */
  function selectTab(id) {
    if (id === tab) return;
    tab = id;
    query = '';
    shown = PAGE_SIZE;
    replaceUrl(`/ingredients?tab=${tab}`);
    applyMeta({ title: 'Ingredients', path: `/ingredients?tab=${tab}` });
    renderTabsBar();
    load();
  }

  /* Swipe the results area left/right to move between the two sources. */
  ctx.onCleanup(
    attachTabSwipe(resultsHost, {
      ids: ['pantry', 'fruits'],
      getActive: () => tab,
      onSelect: selectTab,
    }),
  );

  async function load() {
    renderInto(toolsHost);
    renderInto(resultsHost, skeletonGrid(8));
    try {
      if (tab === 'pantry') await loadPantry();
      else await loadFruits();
    } catch (err) {
      if (err?.name === 'AbortError') return;
      renderInto(resultsHost, errorState({ error: err, onRetry: () => load() }));
      refreshIcons();
    }
  }

  async function loadPantry() {
    const list = await mealdb.ingredientList({ signal: ctx.signal });
    const search = searchField({
      id: 'pantry-q',
      placeholder: `Search ${list.length} ingredients…`,
      value: query,
      onSubmit: (value) => {
        query = value.trim();
        shown = PAGE_SIZE;
        load();
      },
      submitLabel: 'Search',
    });
    renderInto(
      toolsHost,
      el('div', { class: 'filter-bar' }, search.element),
    );

    const tokens = query.toLowerCase();
    const items = tokens ? list.filter((item) => item.name.toLowerCase().includes(tokens)) : list;

    if (!items.length) {
      renderInto(
        resultsHost,
        emptyState({
          icon: 'leaf',
          title: 'No ingredient matched',
          message: 'TheMealDB index uses common English ingredient names — try “chicken”, “rice” or “tomato”.',
          actionLabel: 'Clear search',
          onAction: () => {
            query = '';
            load();
          },
        }),
      );
      refreshIcons();
      return;
    }

    const grid = entityGrid(items.slice(0, shown), { entity: 'ingredient' });
    renderInto(
      resultsHost,
      el(
        'div',
        { class: 'results-meta' },
        el('span', { class: 'results-count' }, el('strong', {}, String(items.length)), ` ingredient${items.length === 1 ? '' : 's'} · TheMealDB`),
      ),
      grid,
      shown < items.length ? loadMoreButton({ label: `Show ${Math.min(PAGE_SIZE, items.length - shown)} more`, onClick: () => { shown += PAGE_SIZE; load(); } }) : null,
    );
    refreshIcons();
    mountReveal(ctx, grid);
  }

  async function loadFruits() {
    const fruits = await fruityvice.listFruits({ signal: ctx.signal });
    const search = searchField({
      id: 'fruits-q',
      placeholder: `Search ${fruits.length} fruits…`,
      value: query,
      onSubmit: (value) => {
        query = value.trim();
        shown = PAGE_SIZE;
        load();
      },
      submitLabel: 'Search',
    });
    renderInto(
      toolsHost,
      el('div', { class: 'filter-bar' }, search.element),
    );

    const tokens = query.toLowerCase();
    const items = tokens ? fruits.filter((f) => f.name.toLowerCase().includes(tokens) || (f.family || '').toLowerCase().includes(tokens)) : fruits;

    if (!items.length) {
      renderInto(
        resultsHost,
        emptyState({
          icon: 'citrus',
          title: 'No fruit matched',
          message: 'Fruityvice indexes botanical fruits — try “berry”, “melon” or “apple”.',
          actionLabel: 'Clear search',
          onAction: () => {
            query = '';
            load();
          },
        }),
      );
      refreshIcons();
      return;
    }

    const grid = entityGrid(items.slice(0, shown), { entity: 'fruit' });
    renderInto(
      resultsHost,
      el(
        'div',
        { class: 'results-meta' },
        el('span', { class: 'results-count' }, el('strong', {}, String(items.length)), ` fruit${items.length === 1 ? '' : 's'} · Fruityvice (via gateway)`),
      ),
      grid,
      shown < items.length ? loadMoreButton({ label: `Show ${Math.min(PAGE_SIZE, items.length - shown)} more`, onClick: () => { shown += PAGE_SIZE; load(); } }) : null,
    );
    refreshIcons();
    mountReveal(ctx, grid);
  }

  renderTabsBar();
  load();
  refreshIcons();
  return root;
}
