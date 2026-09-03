/**
 * CULINA — Recipe categories (/categories): every TheMealDB category with
 * its real description and imagery.
 */
import { el, icon } from '../utils/dom.js';
import { refreshIcons } from '../utils/icons.js';
import { applyMeta } from '../seo.js';
import { mealdb } from '../api/adapters/index.js';
import { mediaImage } from '../components/cards.js';
import { pageHeader, mountReveal } from './shared.js';
import { skeletonGrid, errorState, emptyState, renderInto } from '../components/states.js';

export async function render(ctx) {
  applyMeta({
    title: 'Recipe Categories',
    description: 'Browse every recipe category on CULINA — beef, chicken, seafood, vegetarian, desserts and more — from TheMealDB.',
    path: '/categories',
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
        title: 'Recipe categories',
        lead: 'Every category with its own imagery and description. Counts load live per category.',
      }),
      host,
    ),
  );

  async function load() {
    renderInto(host, skeletonGrid(6));
    try {
      const categories = await mealdb.categories({ signal: ctx.signal });
      if (!categories.length) {
        renderInto(host, emptyState({ icon: 'layout-grid', title: 'No categories returned', message: 'TheMealDB came back empty — try again in a moment.', actionLabel: 'Retry', onAction: () => load() }));
        refreshIcons();
        return;
      }
      const grid = el(
        'div',
        { class: 'grid-cards' },
        ...categories.map((category) =>
          el(
            'a',
            { class: 'card category-card reveal', href: `/discover?entity=recipes&category=${encodeURIComponent(category.name)}` },
            el('div', { class: 'card-media' }, mediaImage({ image: category.image, title: category.name })),
            el(
              'div',
              { class: 'card-body' },
              el('h3', { class: 'card-title' }, category.name),
              category.description
                ? el('p', { class: 'card-desc', style: { fontSize: 'var(--text-sm)', margin: 0 } }, category.description)
                : null,
              el('div', { class: 'card-footer-row' }, el('span', { class: 'provider-badge' }, el('span', { class: 'badge-dot', 'aria-hidden': 'true' }), 'TheMealDB')),
            ),
          ),
        ),
      );
      renderInto(host, el('div', { class: 'results-meta' }, el('span', { class: 'results-count' }, el('strong', {}, String(categories.length)), ' categories · TheMealDB')), grid);
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
