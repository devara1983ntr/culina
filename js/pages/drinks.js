/**
 * CULINA — Drinks hub (PRD §16): cocktails, beer, breweries, coffee.
 */
import { el, icon } from '../utils/dom.js';
import { refreshIcons } from '../utils/icons.js';
import { applyMeta } from '../seo.js';
import { cocktaildb } from '../api/adapters/index.js';
import { entityGrid } from '../components/cards.js';
import { pageHeader, section, sectionHead, mountReveal } from './shared.js';
import { skeletonGrid, renderInto } from '../components/states.js';

const TILES = [
  { icon: 'martini', title: 'Cocktails', sub: 'IBA classics & contemporary mixes with exact measures and glassware.', href: '/cocktails', meta: 'TheCocktailDB' },
  { icon: 'beer', title: 'Beer', sub: 'Ales & stouts with community ratings — honestly labeled demo data.', href: '/beer', meta: 'SampleAPIs' },
  { icon: 'building-2', title: 'Breweries', sub: '11,800+ breweries, cideries and taprooms across the world.', href: '/breweries', meta: 'Open Brewery DB' },
  { icon: 'coffee', title: 'Coffee', sub: 'Hot & iced brewing guides from black coffee to affogato.', href: '/coffee', meta: 'SampleAPIs' },
];

export async function render(ctx) {
  applyMeta({
    title: 'Drinks',
    description: 'Cocktails, beer, breweries and coffee — separate beverage discovery, powered by TheCocktailDB, SampleAPIs and Open Brewery DB.',
    path: '/drinks',
  });

  const teaserHost = el('div');

  const root = el(
    'div',
    { class: 'page' },
    el(
      'div',
      { class: 'container' },
      pageHeader({
        overline: 'Beverage intelligence',
        title: 'Drinks',
        lead: 'Beverage discovery lives separately from food — each category keeps its own data, filters and honest labeling.',
      }),
      el(
        'div',
        { class: 'hub-grid' },
        ...TILES.map((tile) =>
          el(
            'a',
            { class: 'hub-tile reveal', href: tile.href },
            el('span', { class: 'tile-glow', 'aria-hidden': 'true' }),
            el('span', { class: 'icon-tile' }, icon(tile.icon)),
            el('h2', {}, tile.title),
            el('p', {}, tile.sub),
            el('span', { class: 'provider-badge' }, el('span', { class: 'badge-dot', 'aria-hidden': 'true' }), tile.meta),
          ),
        ),
      ),
    ),
    section({
      head: sectionHead('Sharpen the evening', { sub: 'Three cocktails, live from TheCocktailDB' }),
      children: [teaserHost],
    }),
  );

  renderInto(teaserHost, skeletonGrid(3));
  cocktaildb
    .filterByCategory('Cocktail', { signal: ctx.signal })
    .then((drinks) => {
      if (!teaserHost.isConnected) return;
      const picks = drinks.sort(() => Math.random() - 0.5).slice(0, 3);
      renderInto(teaserHost, entityGrid(picks, { entity: 'cocktail' }));
      refreshIcons();
      mountReveal(ctx, teaserHost.querySelector('.grid-cards'));
    })
    .catch(() => {
      if (teaserHost.isConnected) {
        renderInto(teaserHost, el('p', { class: 'muted' }, 'Cocktail previews are temporarily unavailable — the full explorer still works.'));
      }
    });

  refreshIcons();
  requestAnimationFrame(() => ctx.onCleanup(mountReveal(ctx, root.querySelector('.hub-grid'))));
  return root;
}
