/**
 * CULINA — History (/history, PRD §22).
 * Local-only record of recent searches and viewed items. Disableable from
 * Settings; entries removable individually or all at once.
 */
import { el, icon } from '../utils/dom.js';
import { refreshIcons } from '../utils/icons.js';
import { applyMeta } from '../seo.js';
import { history } from '../services/history.js';
import { settingsService } from '../services/settings.js';
import { navigate } from '../router.js';
import { mediaImage } from '../components/cards.js';
import { pageHeader, mountReveal } from './shared.js';
import { makeSwipeable } from '../utils/touch.js';
import { toast } from '../components/toast.js';
import { emptyState, renderInto } from '../components/states.js';
import { relativeTime } from '../utils/format.js';

const ENTITY_ICON = {
  recipe: 'utensils-crossed',
  cocktail: 'martini',
  beer: 'beer',
  fruit: 'citrus',
  ingredient: 'leaf',
  product: 'package',
  brewery: 'building-2',
  coffee: 'coffee',
};

export async function render(ctx) {
  applyMeta({
    robots: 'noindex',
    title: 'History',
    description: 'Your recent searches and viewed items on this device — local only, disableable, removable at any time.',
    path: '/history',
  });

  const searchesHost = el('div');
  const viewsHost = el('div');

  const root = el(
    'div',
    { class: 'page' },
    el(
      'div',
      { class: 'container' },
      pageHeader({
        overline: 'Local only · never uploaded',
        title: 'History',
        lead: 'The last searches you ran and pages you opened, kept on this device to make rediscovery fast. Turn recording off any time.',
        actions: el('a', { class: 'btn btn-ghost btn-sm', href: '/settings' }, icon('settings'), 'History settings'),
      }),
      el(
        'div',
        { class: 'cluster', style: { justifyContent: 'space-between', marginBottom: 'var(--space-3)' } },
        el('h2', { style: { fontSize: '1.15rem', margin: 0 } }, 'Recent searches'),
        el('div', { class: 'cluster' },
          el('button', { class: 'btn btn-ghost btn-sm', type: 'button', id: 'clear-searches' }, icon('trash-2'), 'Clear'),
        ),
      ),
      searchesHost,
      el(
        'div',
        { class: 'cluster', style: { justifyContent: 'space-between', margin: 'var(--space-6) 0 var(--space-3)' } },
        el('h2', { style: { fontSize: '1.15rem', margin: 0 } }, 'Recently viewed'),
        el('div', { class: 'cluster' },
          el('button', { class: 'btn btn-ghost btn-sm', type: 'button', id: 'clear-views' }, icon('trash-2'), 'Clear'),
        ),
      ),
      viewsHost,
    ),
  );

  /* Swipe wrappers are rebuilt on every render — release the previous set. */
  let swipeCleanups = [];
  function clearSwipes() {
    for (const fn of swipeCleanups) {
      try { fn(); } catch { /* row already detached */ }
    }
    swipeCleanups = [];
  }
  ctx.onCleanup(clearSwipes);

  function renderSearches() {
    clearSwipes();
    const searches = history.searches();
    if (!searches.length) {
      renderInto(searchesHost, el('p', { class: 'muted', style: { fontSize: 'var(--text-sm)' } }, settingsService.get().historyEnabled ? 'No searches yet — what are you craving?' : 'History recording is off. Enable it in Settings.'));
      return;
    }
    renderInto(
      searchesHost,
      el(
        'div',
        { class: 'history-list' },
        ...searches.map((entry) =>
          el(
            'div',
            { class: 'history-row' },
            el('button', { class: 'history-link', type: 'button', onclick: () => navigate(`/search?q=${encodeURIComponent(entry.q)}`) }, icon('search'), el('span', {}, entry.q)),
            el('span', { class: 'muted', style: { fontSize: 'var(--text-xs)' } }, relativeTime(entry.at)),
            el('button', { class: 'icon-btn', type: 'button', 'aria-label': `Remove search “${entry.q}”` }, icon('x')),
          ),
        ),
      ),
    );
    // Wire remove buttons (visible, accessible) + swipe-left as the touch
    // shortcut for the exact same action.
    searchesHost.querySelectorAll('.history-row').forEach((row, index) => {
      const remove = () => {
        history.removeSearch(searches[index].q);
        toast(`Removed search “${searches[index].q.slice(0, 40)}”`, { type: 'info' });
        renderSearches();
      };
      row.querySelector('.icon-btn').addEventListener('click', remove);
      swipeCleanups.push(makeSwipeable(row, remove, { threshold: 88, label: 'Remove' }));
    });
    refreshIcons();
  }

  function renderViews() {
    const views = history.views();
    if (!views.length) {
      renderInto(
        viewsHost,
        el('p', { class: 'muted', style: { fontSize: 'var(--text-sm)' } }, settingsService.get().historyEnabled ? 'Nothing viewed yet — your trail starts with the first recipe you open.' : 'History recording is off. Enable it in Settings.'),
      );
      return;
    }
    renderInto(
      viewsHost,
      el(
        'div',
        { class: 'grid-cards' },
        ...views.map((view) =>
          el(
            'article',
            { class: 'card history-card reveal' },
            view.route
              ? el('a', { class: 'card-media', href: view.route, 'aria-label': `Open ${view.title}` }, mediaImage({ image: view.image, title: view.title }))
              : el('div', { class: 'card-media' }, mediaImage({ image: view.image, title: view.title })),
            el(
              'div',
              { class: 'card-body' },
              view.route
                ? el('a', { class: 'card-title', href: view.route }, view.title)
                : el('h3', { class: 'card-title' }, view.title),
              view.subtitle ? el('div', { class: 'card-meta' }, view.subtitle) : null,
              el(
                'div',
                { class: 'card-footer-row' },
                el('span', { class: 'muted', style: { fontSize: 'var(--text-xs)' } }, icon(ENTITY_ICON[view.entity] || 'sparkles'), ' ', relativeTime(view.at)),
              ),
            ),
          ),
        ),
      ),
    );
    refreshIcons();
    mountReveal(ctx, viewsHost.querySelector('.grid-cards'));
  }

  root.querySelector('#clear-searches').addEventListener('click', () => {
    history.clear({ what: 'searches' });
    renderSearches();
  });
  root.querySelector('#clear-views').addEventListener('click', () => {
    history.clear({ what: 'views' });
    renderViews();
  });

  renderSearches();
  renderViews();
  refreshIcons();
  return root;
}
