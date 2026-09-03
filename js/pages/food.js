/**
 * CULINA — Food hub (/food): the world of ingredients, fruits, nutrition,
 * products, categories and cuisines in one place (PRD IA).
 */
import { el, icon } from '../utils/dom.js';
import { refreshIcons } from '../utils/icons.js';
import { applyMeta } from '../seo.js';
import { mealdb, fruityvice } from '../api/adapters/index.js';
import { entityGrid } from '../components/cards.js';
import { pageHeader, section, sectionHead, mountReveal } from './shared.js';
import { skeletonGrid, renderInto, emptyState } from '../components/states.js';

const FOOD_TILES = [
  { icon: 'leaf', title: 'Ingredient index', sub: 'The full pantry from TheMealDB, with descriptions and pairings.', href: '/ingredients' },
  { icon: 'citrus', title: 'Fruits & nutrition', sub: 'Botanical profiles with real per-100 g nutrition from Fruityvice.', href: '/ingredients?tab=fruits' },
  { icon: 'flask-conical', title: 'Nutrition explorer', sub: 'Compare fruits and packaged products side by side.', href: '/nutrition' },
  { icon: 'package', title: 'Food products', sub: 'Packaged goods with Nutri-Score, NOVA and full nutrition.', href: '/products' },
  { icon: 'layout-grid', title: 'Recipe categories', sub: 'Browse every MealDB category, from starters to desserts.', href: '/categories' },
  { icon: 'globe', title: 'Cuisines', sub: 'Cook your way around the world, area by area.', href: '/cuisines' },
];

export async function render(ctx) {
  applyMeta({
    title: 'Food',
    description: 'Everything edible on CULINA: ingredients, fruits with real nutrition, packaged products, recipe categories and world cuisines.',
    path: '/food',
  });

  const fruitHost = el('div');

  const root = el(
    'div',
    { class: 'page' },
    el(
      'div',
      { class: 'container' },
      pageHeader({
        overline: 'Food intelligence',
        title: 'Food',
        lead: 'Ingredients, fruits, nutrition and packaged products — the edible half of CULINA, each with its verified data source.',
      }),
      el(
        'div',
        { class: 'hub-grid' },
        ...FOOD_TILES.map((tile) =>
          el(
            'a',
            { class: 'hub-tile reveal', href: tile.href },
            el('span', { class: 'tile-glow', 'aria-hidden': 'true' }),
            el('span', { class: 'icon-tile' }, icon(tile.icon)),
            el('h3', {}, tile.title),
            el('p', {}, tile.sub),
          ),
        ),
      ),
    ),
    section({
      head: sectionHead('Fresh from Fruityvice', { sub: 'A taste of the fruit index — tap any card for real nutrition' }),
      children: [fruitHost],
    }),
  );

  renderInto(fruitHost, skeletonGrid(4));
  fruityvice
    .listFruits({ signal: ctx.signal })
    .then((fruits) => {
      if (!fruitHost.isConnected) return;
      if (!fruits.length) {
        renderInto(
          fruitHost,
          emptyState({
            icon: 'citrus',
            title: 'Fruit data unavailable',
            message: 'The Fruityvice gateway didn’t respond. This feature needs the CULINA gateway — other food sources still work.',
            actionLabel: 'Check API health',
            href: '/health',
          }),
        );
        refreshIcons();
        return;
      }
      const picks = fruits.filter((f) => f.nutrition?.calories != null).slice(0, 8);
      renderInto(fruitHost, entityGrid(picks, { entity: 'fruit' }));
      refreshIcons();
      mountReveal(ctx, fruitHost.querySelector('.grid-cards'));
    })
    .catch(() => {
      if (fruitHost.isConnected) {
        renderInto(
          fruitHost,
          emptyState({
            icon: 'citrus',
            title: 'Fruit data unavailable',
            message: 'The Fruityvice gateway didn’t respond just now. Try again in a moment.',
            actionLabel: 'Retry',
            onAction: () => location.reload(),
          }),
        );
        refreshIcons();
      }
    });

  refreshIcons();
  requestAnimationFrame(() => ctx.onCleanup(mountReveal(ctx, root.querySelector('.hub-grid'))));
  return root;
}
