/**
 * CULINA — Unified search page (PRD §32).
 * Shareable URL state: /search?q=pasta&type=recipe — back/forward works.
 */
import { el, icon } from '../utils/dom.js';
import { refreshIcons } from '../utils/icons.js';
import { applyMeta } from '../seo.js';
import { navigate } from '../router.js';
import { unifiedSearch, totalResults } from '../services/search.js';
import { entityGrid } from '../components/cards.js';
import { searchField } from '../components/filters.js';
import { skeletonGrid, emptyState, renderInto, partialFailureNotice } from '../components/states.js';
import { pageHeader, mountReveal } from './shared.js';
import { read as readStorage, write as writeStorage } from '../storage.js';
import { revealGrid } from '../utils/motion.js';
import { STORAGE_KEYS, ENTITY_LABELS } from '../constants.js';
import { truncate } from '../utils/format.js';
import { userMessage } from '../api/errors.js';
import { history } from '../services/history.js';

const POPULAR = ['chicken', 'pasta', 'margarita', 'salad', 'espresso', 'chocolate', 'gin', 'banana'];

const CATEGORY_SHORTCUTS = [
  { label: 'Recipes', href: '/recipes', icon: 'utensils-crossed' },
  { label: 'Cocktails', href: '/cocktails', icon: 'martini' },
  { label: 'Ingredients', href: '/ingredients', icon: 'leaf' },
  { label: 'Fruits', href: '/ingredients?tab=fruits', icon: 'citrus' },
  { label: 'Products', href: '/products', icon: 'package' },
  { label: 'Breweries', href: '/breweries', icon: 'building-2' },
  { label: 'Coffee', href: '/coffee', icon: 'coffee' },
  { label: 'Cuisines', href: '/cuisines', icon: 'globe' },
];

const GROUP_ENTITY = {
  recipes: 'recipe',
  cocktails: 'cocktail',
  fruits: 'fruit',
  products: 'product',
  breweries: 'brewery',
  beers: 'beer',
  coffees: 'coffee',
};

export async function render(ctx) {
  const query = String(ctx.query.q || '').trim();
  const typeFilter = ctx.query.type || 'all';

  applyMeta({
    title: query ? `Search: ${truncate(query, 40)}` : 'Search',
    description: query
      ? `Unified results for “${query}” across recipes, cocktails, fruits, products, breweries, beers and coffee.`
      : 'One search across every verified food & drink data source.',
    path: query ? `/search?q=${encodeURIComponent(query)}` : '/search',
  });

  const resultsHost = el('div');
  const root = el(
    'div',
    { class: 'page' },
    el(
      'div',
      { class: 'container' },
      pageHeader({
        overline: 'Unified search',
        title: 'Search everything',
        lead: 'One query, every enabled provider — deduplicated and ranked by a transparent rule. Failures in one source never hide the others.',
      }),
      (() => {
        const field = searchField({
          id: 'page-search',
          placeholder: 'Search recipes, ingredients, drinks, products…',
          value: query,
          onSubmit: (value) => navigate(`/search?q=${encodeURIComponent(value.trim())}`),
          submitLabel: 'Search',
        });
        field.element.style.maxWidth = '560px';
        field.element.style.marginBottom = 'var(--space-5)';
        return field.element;
      })(),
      resultsHost,
    ),
  );

  function saveRecent() {
    if (!query || query.length < 2) return;
    const list = readStorage(STORAGE_KEYS.recentSearches, []).filter((item) => item.q.toLowerCase() !== query.toLowerCase());
    list.unshift({ q: query, at: Date.now() });
    writeStorage(STORAGE_KEYS.recentSearches, list.slice(0, 8));
    history.recordSearch(query);
  }

  function renderIdle() {
    const recents = readStorage(STORAGE_KEYS.recentSearches, []).slice(0, 5);
    renderInto(
      resultsHost,
      recents.length
        ? el(
            'div',
            { class: 'search-landing' },
            el('h2', { class: 'search-landing-label' }, 'Recent searches'),
            el('div', { class: 'cluster', style: { flexWrap: 'wrap' } }, ...recents.map((r) => el('a', { class: 'chip', href: `/search?q=${encodeURIComponent(r.q)}` }, icon('clock'), r.q))),
          )
        : null,
      el(
        'div',
        { class: 'search-landing' },
        el('h2', { class: 'search-landing-label' }, 'Popular right now'),
        el(
          'div',
          { class: 'cluster', style: { flexWrap: 'wrap' } },
          ...POPULAR.map((q) => el('a', { class: 'chip', href: `/search?q=${encodeURIComponent(q)}` }, icon('flame'), q)),
        ),
      ),
      el(
        'div',
        { class: 'search-landing' },
        el('h2', { class: 'search-landing-label' }, 'Browse instead'),
        el(
          'div',
          { class: 'hub-grid is-compact' },
          ...CATEGORY_SHORTCUTS.map((shortcut) =>
            el(
              'a',
              { class: 'hub-tile reveal', href: shortcut.href },
              el('span', { class: 'tile-glow', 'aria-hidden': 'true' }),
              el('span', { class: 'icon-tile' }, icon(shortcut.icon)),
              el('h3', {}, shortcut.label),
            ),
          ),
        ),
      ),
    );
    refreshIcons();
  }

  async function run() {
    if (!query) {
      renderIdle();
      return;
    }
    saveRecent();
    renderInto(resultsHost, skeletonGrid(6));

    let result;
    try {
      result = await unifiedSearch(query, { signal: ctx.signal });
    } catch (err) {
      if (err?.name === 'AbortError') return;
      renderInto(
        resultsHost,
        emptyState({
          icon: err?.type === 'TIMEOUT' ? 'clock' : 'alert-triangle',
          title: err?.type === 'TIMEOUT' ? 'This search took too long' : 'Search failed',
          message: userMessage(err) || 'Providers could not be reached. Check your connection and try again.',
          actionLabel: 'Retry',
          onAction: () => run(),
        }),
        el(
          'div',
          { class: 'cluster', style: { justifyContent: 'center', marginTop: 'var(--space-3)' } },
          el('a', { class: 'btn btn-soft btn-sm', href: '/discover' }, 'Browse Discover instead'),
          navigator.onLine ? null : el('a', { class: 'btn btn-soft btn-sm', href: '/offline' }, 'Offline info'),
        ),
      );
      refreshIcons();
      return;
    }
    if (!resultsHost.isConnected) return;

    const total = totalResults(result);
    if (!total) {
      /* Broader-search suggestion: the longest word of the query. */
      const words = query.toLowerCase().split(/\s+/).filter(Boolean);
      const broaden = words.length > 1 ? words.slice().sort((a, b) => b.length - a.length)[0] : null;
      renderInto(
        resultsHost,
        emptyState({
          icon: 'search-check',
          title: `No results for “${truncate(query, 48)}”`,
          message: result.failures.length
            ? 'Nothing matched — and some sources were unavailable besides. The misses below may not be their fault.'
            : 'Nothing matched across any live source. Names vary — try a shorter or more common term.',
          actionLabel: 'Open Discover',
          href: '/discover',
        }),
        el(
          'div',
          { class: 'cluster', style: { justifyContent: 'center', marginTop: 'var(--space-3)', flexWrap: 'wrap' } },
          broaden ? el('a', { class: 'chip', href: `/search?q=${encodeURIComponent(broaden)}` }, icon('search'), `Search just “${truncate(broaden, 24)}”`) : null,
          ...POPULAR.slice(0, 4).map((q) => el('a', { class: 'chip', href: `/search?q=${encodeURIComponent(q)}` }, icon('flame'), q)),
          el('a', { class: 'chip', href: '/categories' }, icon('layout-grid'), 'Browse categories'),
        ),
        result.failures.length ? partialFailureNotice(result.failures, { context: 'Some sources were unavailable during this search:' }) : null,
      );
      refreshIcons();
      return;
    }

    const activeGroups = Object.entries(result.groups).filter(([, items]) => items.length);

    const countChips = el(
      'div',
      { class: 'search-counts-row', role: 'group', 'aria-label': 'Filter results by type' },
      el('a', { class: 'chip', href: `/search?q=${encodeURIComponent(query)}`, 'aria-pressed': String(typeFilter === 'all') }, `All ${total}`),
      ...activeGroups.map(([group, items]) =>
        el(
          'a',
          { class: 'chip', href: `/search?q=${encodeURIComponent(query)}&type=${group}`, 'aria-pressed': String(typeFilter === group) },
          `${ENTITY_LABELS[group]} ${items.length}`,
        ),
      ),
    );

    const sections = [];
    const notice = result.failures.length ? partialFailureNotice(result.failures, { context: 'These sources were unavailable — the results below are all live data:' }) : null;
    if (notice) sections.push(notice);

    for (const [group, items] of activeGroups) {
      if (typeFilter !== 'all' && typeFilter !== group) continue;
      const entity = GROUP_ENTITY[group];
      const grid = entityGrid(items, { entity });
      sections.push(
        el(
          'section',
          { class: 'result-section', 'aria-labelledby': `results-${group}` },
          el(
            'div',
            { class: 'result-section-head' },
            el('h2', { id: `results-${group}` }, ENTITY_LABELS[group]),
            el('span', { class: 'count' }, `${items.length} result${items.length === 1 ? '' : 's'}`),
          ),
          grid,
        ),
      );
      requestAnimationFrame(() => ctx.onCleanup(revealGrid(grid)));
    }

    renderInto(resultsHost, countChips, ...sections.filter(Boolean));
    refreshIcons();
  }

  run();
  refreshIcons();
  return root;
}
