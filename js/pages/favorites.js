/**
 * CULINA — Favorites (PRD §33): local-first collections with tabs, counts,
 * per-collection empty states and quick actions.
 */
import { el, icon } from '../utils/dom.js';
import { refreshIcons } from '../utils/icons.js';
import { applyMeta } from '../seo.js';
import { favorites, COLLECTION_LABELS } from '../services/favorites.js';
import { appState } from '../state.js';
import { favoriteButton, mediaImage } from '../components/cards.js';
import { providerBadge } from '../components/providerBadge.js';
import { addToPlanDialog } from '../components/plannerWidgets.js';
import { renderTabs } from '../components/tabs.js';
import { viewToggle, selectField } from '../components/filters.js';
import { emptyState, renderInto } from '../components/states.js';
import { pageHeader, mountReveal } from './shared.js';

const COLLECTION_ORDER = ['recipes', 'cocktails', 'beers', 'fruits', 'products', 'coffees', 'breweries'];

const EMPTY_COPY = {
  recipes: { icon: 'utensils-crossed', title: 'Your recipe collection is empty', message: 'Tap the heart on any recipe to keep it here — favorites live on your device, forever yours.', href: '/recipes', cta: 'Browse recipes' },
  cocktails: { icon: 'martini', title: 'No cocktails saved yet', message: 'Save the mixes you want to master and they’ll be one tap away.', href: '/cocktails', cta: 'Explore cocktails' },
  beers: { icon: 'beer', title: 'No beers saved yet', message: 'Keep your favorite ales and stouts handy.', href: '/beer', cta: 'Browse beer' },
  fruits: { icon: 'citrus', title: 'No fruits saved yet', message: 'Save fruit profiles with their nutrition for quick reference.', href: '/ingredients?tab=fruits', cta: 'Explore fruits' },
  products: { icon: 'package', title: 'No products saved yet', message: 'Save packaged products you buy often to check their nutrition instantly.', href: '/products', cta: 'Search products' },
  coffees: { icon: 'coffee', title: 'No coffee guides saved yet', message: 'Save brewing guides for your morning rotation.', href: '/coffee', cta: 'Browse coffee' },
  breweries: { icon: 'building-2', title: 'No breweries saved yet', message: 'Save the taprooms you want to visit.', href: '/breweries', cta: 'Find breweries' },
};

function favoriteCard(env) {
  const entity = env.entity;
  const card = el(
    'article',
    { class: 'card reveal' },
    env.route
      ? el('a', { class: 'card-media', href: env.route, 'aria-label': `Open ${env.title}` }, mediaImage({ image: env.image, title: env.title }))
      : el('div', { class: 'card-media' }, mediaImage({ image: env.image, title: env.title })),
    favoriteButton(entity, env),
    el(
      'div',
      { class: 'card-body' },
      env.route
        ? el('a', { class: 'card-title', href: env.route }, env.title)
        : el('h3', { class: 'card-title', style: { fontSize: '1.02rem' } }, env.title),
      env.subtitle ? el('div', { class: 'card-meta' }, env.subtitle) : null,
      el(
        'div',
        { class: 'card-footer-row' },
        providerBadge(env.source),
        entity === 'recipe'
          ? el('button', { class: 'btn btn-soft btn-sm', type: 'button', 'aria-label': `Add ${env.title} to meal plan`, onclick: () => addToPlanDialog(env) }, icon('calendar-days'), 'Plan')
          : null,
      ),
    ),
  );
  return card;
}

export async function render(ctx) {
  let active = ctx.query.tab && COLLECTION_LABELS[ctx.query.tab] ? ctx.query.tab : 'recipes';

  applyMeta({
    robots: 'noindex',
    title: 'Favorites',
    description: 'Your saved recipes, cocktails, beers, fruits, products, coffee guides and breweries — stored locally on your device.',
    path: `/favorites?tab=${active}`,
  });

  const tabsHost = el('div');
  const toolsHost = el('div');
  const gridHost = el('div');
  let view = 'grid';
  let sort = 'recent';

  const root = el(
    'div',
    { class: 'page' },
    el(
      'div',
      { class: 'container' },
      pageHeader({
        overline: 'Local-first · private by design',
        title: 'Favorites',
        lead: 'Everything you save lives in this browser — no account, no sync, no tracking. Clearing site data clears your collection.',
      }),
      tabsHost,
      toolsHost,
      gridHost,
    ),
  );

  function renderTabsBar() {
    const counts = favorites.counts();
    renderInto(
      tabsHost,
      renderTabs({
        tabs: COLLECTION_ORDER.map((id) => ({ id, label: COLLECTION_LABELS[id], count: counts[id] })),
        active,
        onSelect: (id) => {
          active = id;
          history.replaceState(history.state, '', `/favorites?tab=${id}`);
          renderTabsBar();
          renderGrid();
        },
        ariaLabel: 'Favorite collections',
      }),
    );
  }

  function renderTools(count) {
    if (!count) {
      renderInto(toolsHost);
      return;
    }
    renderInto(
      toolsHost,
      el(
        'div',
        { class: 'cluster', style: { justifyContent: 'space-between', marginBottom: 'var(--space-4)', flexWrap: 'wrap', gap: 'var(--space-3)' } },
        el('span', { class: 'muted', style: { fontSize: 'var(--text-sm)' } }, `${count} saved`),
        el(
          'div',
          { class: 'cluster' },
          selectField({
            id: 'fav-sort',
            label: 'Sort',
            options: [
              { value: 'recent', label: 'Recently saved' },
              { value: 'name', label: 'Name A–Z' },
            ],
            value: sort,
            onChange: (v) => {
              sort = v;
              renderGrid();
            },
          }),
          viewToggle({ value: view, onChange: (v) => { view = v; renderGrid(); } }),
        ),
      ),
    );
    refreshIcons();
  }

  function renderGrid() {
    const items = favorites.forCollection(active);
    renderTools(items.length);
    if (!items.length) {
      const copy = EMPTY_COPY[active];
      renderInto(
        gridHost,
        emptyState({ icon: copy.icon, title: copy.title, message: copy.message, actionLabel: copy.cta, href: copy.href }),
      );
      refreshIcons();
      return;
    }
    const sorted = sort === 'name' ? [...items].sort((a, b) => a.title.localeCompare(b.title)) : items;
    const grid = el('div', { class: 'grid-cards' }, ...sorted.map(favoriteCard));
    grid.classList.toggle('is-list', view === 'list');
    renderInto(gridHost, grid);
    refreshIcons();
    mountReveal(ctx, gridHost.querySelector('.grid-cards'));
  }

  const unsubscribe = appState.subscribe(() => renderGrid());
  ctx.onCleanup(unsubscribe);

  renderTabsBar();
  renderGrid();
  refreshIcons();
  return root;
}
