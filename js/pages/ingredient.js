/**
 * CULINA — Ingredient detail (PRD §14): overview, recipes using it, nutrition
 * (when the source provides it), related ingredients (clearly labeled as
 * derived), and matching food products.
 */
import { el, icon } from '../utils/dom.js';
import { refreshIcons } from '../utils/icons.js';
import { applyMeta } from '../seo.js';
import { mealdb, fruityvice, openfoodfacts } from '../api/adapters/index.js';
import { entityGrid, mediaImage, monogramTile } from '../components/cards.js';
import { nutritionPanel } from '../components/nutrition.js';
import { sourcePanel } from '../components/providerBadge.js';
import { skeletonRows, emptyState, renderInto, partialFailureNotice } from '../components/states.js';
import { mountReveal } from './shared.js';
import { truncate, ingredientKey } from '../utils/format.js';
import { revealGrid as mountRevealRef } from '../utils/motion.js';
import { history } from '../services/history.js';


function asyncSection(sectionEl, loader) {
  const body = el('div', {}, skeletonRows(3));
  sectionEl.append(body);
  loader()
    .then((node) => {
      if (body.isConnected) renderInto(body, node);
    })
    .catch((err) => {
      if (err?.name === 'AbortError') return;
      if (body.isConnected) {
        renderInto(
          body,
          el('p', { class: 'muted', style: { fontSize: 'var(--text-sm)' } },
            `Temporarily unavailable (${err?.type === 'HTTP_ERROR' ? 'the provider returned an error' : 'connection issue'}).`),
        );
      }
    });
  return sectionEl;
}

export async function render(ctx) {
  const { source, id } = ctx.params;
  const decodedId = decodeURIComponent(id);

  const root = el('div', { class: 'page' });

  /* ------------------------------------------------------------------ */
  /* Resolve the ingredient                                              */
  /* ------------------------------------------------------------------ */
  let ingredient = null;
  try {
    if (source === 'fruityvice') {
      ingredient = await fruityvice.fruitById(decodedId, { signal: ctx.signal });
    } else {
      const list = await mealdb.ingredientList({ signal: ctx.signal });
      ingredient = list.find((item) => decodeURIComponent(item.sourceId).toLowerCase() === decodedId.toLowerCase()) || null;
    }
  } catch (err) {
    if (err?.name === 'AbortError') return root;
    renderInto(
      root,
      emptyState({
        icon: 'alert-triangle',
        title: 'Couldn’t load this ingredient',
        message: 'The source didn’t respond. Other parts of CULINA are unaffected.',
        actionLabel: 'Try again',
        onAction: () => location.reload(),
      }),
    );
    refreshIcons();
    return root;
  }

  if (!ingredient) {
    applyMeta({ title: 'Ingredient not found', path: ctx.path });
    renderInto(
      root,
      emptyState({
        icon: 'leaf',
        title: 'Ingredient not found',
        message: `No ${source === 'fruityvice' ? 'fruit' : 'ingredient'} matches “${decodedId}” in this source.`,
        actionLabel: 'Browse ingredients',
        href: '/ingredients',
      }),
    );
    refreshIcons();
    return root;
  }

  const name = ingredient.name;

  history.recordView({
    id: ingredient.id || `ingredient:${source}:${decodedId}`,
    entity: source === 'fruityvice' ? 'fruit' : 'ingredient',
    title: name,
    subtitle: source === 'fruityvice' ? ingredient.family : (ingredient.type || null),
    image: ingredient.imageSmall || ingredient.image || null,
    route: ctx.path,
  });

  applyMeta({
    title: name,
    description: source === 'fruityvice'
      ? `${name} (${ingredient.family}) — nutrition per 100 g from Fruityvice, plus recipes and products containing it.`
      : `${name} — description, recipes that use it, co-occurring ingredients and matching food products.`,
    path: ctx.path,
  });

  /* ------------------------------------------------------------------ */
  /* Hero                                                                */
  /* ------------------------------------------------------------------ */
  const media =
    source === 'fruityvice'
      ? el('div', { class: 'detail-hero-media monogram-tile', style: { aspectRatio: '4 / 3.4', display: 'grid', placeItems: 'center' } }, el('span', { style: { fontSize: '4.5rem' } }, name.charAt(0)))
      : el('div', { class: 'detail-hero-media' }, mediaImage({ image: ingredient.image, title: name, eager: true }));

  const hero = el(
    'header',
    { class: 'detail-hero', style: { marginTop: 'var(--space-6)' } },
    el(
      'div',
      { class: 'detail-hero-grid' },
      media,
      el(
        'div',
        {},
        el('p', { class: 'overline' }, icon('leaf'), source === 'fruityvice' ? 'Fruit profile' : 'Pantry ingredient'),
        el('h1', {}, name),
        el(
          'p',
          { class: 'detail-summary' },
          ingredient.description
            ? truncate(ingredient.description, 260)
            : source === 'fruityvice'
              ? `Botanical profile from Fruityvice — ${[ingredient.family && `family ${ingredient.family}`, ingredient.genus && `genus ${ingredient.genus}`].filter(Boolean).join(', ')}.`
              : 'A cooking ingredient indexed by TheMealDB. Full recipes using it are listed below.',
        ),
        el(
          'div',
          { class: 'detail-meta-row' },
          source === 'fruityvice' && ingredient.family ? el('span', { class: 'badge badge-accent' }, ingredient.family) : null,
          source === 'fruityvice' && ingredient.nutrition?.calories != null ? el('span', { class: 'badge badge-neutral' }, `${Math.round(ingredient.nutrition.calories)} kcal / 100 g`) : null,
          ingredient.type ? el('span', { class: 'badge badge-neutral' }, ingredient.type) : null,
          el('span', { class: 'provider-badge' }, el('span', { class: 'badge-dot', 'aria-hidden': 'true' }), source === 'fruityvice' ? 'Fruityvice' : 'TheMealDB'),
        ),
      ),
    ),
  );

  /* ------------------------------------------------------------------ */
  /* Aside: nutrition (fruits) + source panel                            */
  /* ------------------------------------------------------------------ */
  const aside = el(
    'aside',
    { class: 'detail-aside' },
    source === 'fruityvice'
      ? el(
          'section',
          { class: 'detail-section', 'aria-labelledby': 'nutrition-h' },
          el('h2', { id: 'nutrition-h' }, icon('flask-conical'), 'Nutrition'),
          nutritionPanel(ingredient.nutrition),
        )
      : el(
          'section',
          { class: 'detail-section', 'aria-labelledby': 'nutrition-h' },
          el('h2', { id: 'nutrition-h' }, icon('flask-conical'), 'Nutrition'),
          el(
            'div',
            { class: 'notice is-info' },
            icon('info'),
            el(
              'div',
              {},
              el('strong', {}, 'No nutrition for pantry ingredients'),
              el('p', { class: 'muted', style: { marginTop: '2px' } }, 'TheMealDB doesn’t provide nutrition data. Fruit profiles (Fruityvice) and packaged products (Open Food Facts) both carry verified values.'),
              el('a', { class: 'text-link', href: '/ingredients?tab=fruits', style: { fontSize: 'var(--text-sm)' } }, 'Browse fruits with nutrition →'),
            ),
          ),
        ),
    sourcePanel(source === 'fruityvice' ? 'fruityvice' : 'mealdb'),
  );

  /* ------------------------------------------------------------------ */
  /* Main: recipes / products / pairings                                 */
  /* ------------------------------------------------------------------ */
  const recipesSection = asyncSection(
    el('section', { class: 'detail-section', 'aria-labelledby': 'recipes-h' }, el('h2', { id: 'recipes-h' }, icon('utensils-crossed'), `Recipes with ${name}`)),
    async () => {
      const recipes = await mealdb.filterByIngredient(name, { signal: ctx.signal });
      if (!recipes.length) {
        return el('p', { class: 'muted' }, `TheMealDB lists no recipes with “${name}” as a main ingredient.`);
      }
      const grid = entityGrid(recipes.slice(0, 12), { entity: 'recipe' });
      requestAnimationFrame(() => ctx.onCleanup(mountRevealRef(grid)));
      return el('div', {}, el('p', { class: 'muted', style: { marginBottom: 'var(--space-4)', fontSize: 'var(--text-sm)' } }, `${recipes.length} recipe${recipes.length === 1 ? '' : 's'} use this ingredient`), grid);
    },
  );

  const productsSection = asyncSection(
    el('section', { class: 'detail-section', 'aria-labelledby': 'products-h' }, el('h2', { id: 'products-h' }, icon('package'), `Food products matching “${name}”`)),
    async () => {
      const { products } = await openfoodfacts.search(name, { signal: ctx.signal, pageSize: 8 });
      if (!products.length) return el('p', { class: 'muted' }, 'No matching products in Open Food Facts right now.');
      return entityGrid(products, { entity: 'product' });
    },
  );

  const pairingsSection =
    source === 'mealdb'
      ? asyncSection(
          el('section', { class: 'detail-section', 'aria-labelledby': 'pairings-h' }, el('h2', { id: 'pairings-h' }, icon('sparkles'), 'Frequently paired with')),
          async () => {
            const recipes = await mealdb.filterByIngredient(name, { signal: ctx.signal });
            const top = recipes.slice(0, 4);
            if (!top.length) return el('p', { class: 'muted' }, 'Not enough data to derive pairings.');
            const lookups = await Promise.allSettled(top.map((r) => mealdb.lookup(r.sourceId, { signal: ctx.signal })));
            const counts = new Map();
            for (const result of lookups) {
              if (result.status !== 'fulfilled' || !result.value) continue;
              for (const ing of result.value.ingredients) {
                const key = ingredientKey(ing.name);
                if (!key || key === ingredientKey(name)) continue;
                counts.set(key, (counts.get(key) || 0) + 1);
              }
            }
            const pairs = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
            if (!pairs.length) return el('p', { class: 'muted' }, 'Not enough data to derive pairings.');
            return el(
              'div',
              {},
              el('div', { class: 'cluster' },
                ...pairs.map(([key]) => el('a', { class: 'chip', href: `/ingredient/mealdb/${encodeURIComponent(key.replace(/\s+/g, ' ').trim().split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' '))}` }, key.replace(/\b\w/g, (c) => c.toUpperCase()))),
              ),
              el('p', { class: 'muted', style: { fontSize: 'var(--text-xs)', marginTop: 'var(--space-3)' } }, 'Derived by CULINA from the ingredients of the top TheMealDB recipes using this ingredient — an application-generated relationship, not source data.'),
            );
          },
        )
      : asyncSection(
          el('section', { class: 'detail-section', 'aria-labelledby': 'pairings-h' }, el('h2', { id: 'pairings-h' }, icon('sparkles'), 'Related fruits')),
          async () => {
            const fruits = await fruityvice.listFruits({ signal: ctx.signal });
            const related = fruits.filter((f) => f.family === ingredient.family && f.sourceId !== ingredient.sourceId).slice(0, 8);
            if (!related.length) return el('p', { class: 'muted' }, 'No other indexed fruits in this family.');
            return el(
              'div',
              {},
              entityGrid(related, { entity: 'fruit' }),
              el('p', { class: 'muted', style: { fontSize: 'var(--text-xs)', marginTop: 'var(--space-3)' } }, `Derived from the Fruityvice botanical family (${ingredient.family}) — an application-generated relationship.`),
            );
          },
        );

  const sections = el(
    'div',
    { class: 'detail-sections', style: { marginTop: 'var(--space-8)' } },
    aside,
    el(
      'div',
      { class: 'detail-main' },
      recipesSection,
      pairingsSection,
      productsSection,
    ),
  );

  root.replaceChildren(hero, sections);
  refreshIcons();
  return root;
}

