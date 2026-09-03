/**
 * CULINA — Cuisines (/cuisines): every TheMealDB area.
 * TheMealDB provides no imagery for areas — honest typographic tiles
 * (monogram + name), never fake flags or photos.
 */
import { el, icon } from '../utils/dom.js';
import { refreshIcons } from '../utils/icons.js';
import { applyMeta } from '../seo.js';
import { mealdb } from '../api/adapters/index.js';
import { monogramTile } from '../components/cards.js';
import { pageHeader, mountReveal } from './shared.js';
import { skeletonGrid, errorState, emptyState, renderInto } from '../components/states.js';

export async function render(ctx) {
  applyMeta({
    title: 'Cuisines',
    description: 'Cook your way around the world — browse recipes by cuisine, from British to Vietnamese, live from TheMealDB.',
    path: '/cuisines',
  });

  const host = el('div');
  const root = el(
    'div',
    { class: 'page' },
    el(
      'div',
      { class: 'container' },
      pageHeader({
        overline: 'TheMealDB · live',
        title: 'Cuisines',
        lead: 'Every area TheMealDB indexes. No flag imagery exists in the source — so each cuisine gets a designed typographic tile instead of an invented one.',
      }),
      host,
    ),
  );

  async function load() {
    renderInto(host, skeletonGrid(6));
    try {
      const areas = await mealdb.areas({ signal: ctx.signal });
      if (!areas.length) {
        renderInto(host, emptyState({ icon: 'globe', title: 'No cuisines returned', message: 'TheMealDB came back empty — try again in a moment.', actionLabel: 'Retry', onAction: () => load() }));
        refreshIcons();
        return;
      }
      const grid = el(
        'div',
        { class: 'grid-cards' },
        ...areas.map((area) =>
          el(
            'a',
            { class: 'card cuisine-card reveal', href: `/recipes?area=${encodeURIComponent(area.name)}` },
            el('div', { class: 'card-media cuisine-tile' }, monogramTile(area.name)),
            el(
              'div',
              { class: 'card-body' },
              el('h3', { class: 'card-title' }, area.name),
              el('div', { class: 'card-footer-row' },
                el('span', { class: 'provider-badge' }, el('span', { class: 'badge-dot', 'aria-hidden': 'true' }), 'TheMealDB'),
                el('span', { class: 'muted', style: { fontSize: 'var(--text-xs)' } }, 'View recipes →'),
              ),
            ),
          ),
        ),
      );
      renderInto(host, el('div', { class: 'results-meta' }, el('span', { class: 'results-count' }, el('strong', {}, String(areas.length)), ` cuisine${areas.length === 1 ? '' : 's'} · TheMealDB`)), grid);
      refreshIcons();
      mountReveal(ctx, grid);
    } catch (err) {
      if (err?.name === 'AbortError') return;
      renderInto(host, errorState({ error: err, onRetry: () => load() }));
      refreshIcons();
    }
  }

  load();
  refreshIcons();
  return root;
}
