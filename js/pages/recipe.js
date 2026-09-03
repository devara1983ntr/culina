/**
 * CULINA — Recipe detail (PRD §13, §46).
 * Structured data uses ONLY fields the provider actually supplies.
 */
import { el, icon } from '../utils/dom.js';
import { refreshIcons } from '../utils/icons.js';
import { applyMeta } from '../seo.js';
import { mealdb } from '../api/adapters/index.js';
import { favoriteButton, itemRoute, mediaImage } from '../components/cards.js';
import { addToPlanDialog } from '../components/plannerWidgets.js';
import { nutritionPanel } from '../components/nutrition.js';
import { sourcePanel } from '../components/providerBadge.js';
import { entityGrid } from '../components/cards.js';
import { skeletonDetail, emptyState, errorState, renderInto } from '../components/states.js';
import { envelopeFor } from '../services/favorites.js';
import { toast } from '../components/toast.js';
import { shoppingList } from '../services/shoppingList.js';
import { navigate } from '../router.js';
import { truncate, safeUrl } from '../utils/format.js';
import { mountReveal } from './shared.js';
import { history } from '../services/history.js';

export async function render(ctx) {
  const { id: rawId } = ctx.params;
  // Route ids arrive as `provider:sourceId` (e.g. `mealdb:52772`) — providers
  // only understand the sourceId half.
  const id = rawId.includes(':') ? rawId.slice(rawId.indexOf(':') + 1) : rawId;
  const root = el('div', { class: 'page' });
  root.append(skeletonDetail());

  let recipe;
  try {
    recipe = await mealdb.lookup(id, { signal: ctx.signal });
  } catch (err) {
    if (err?.name === 'AbortError') return root;
    renderInto(root, errorState({ error: err, onRetry: () => applyMeta({}) || location.reload() }));
    refreshIcons();
    return root;
  }

  if (!recipe) {
    applyMeta({ title: 'Recipe not found', path: `/recipe/${id}` });
    renderInto(
      root,
      emptyState({
        icon: 'utensils-crossed',
        title: 'Recipe not found',
        message: 'TheMealDB has no recipe with this id. It may have been removed from the database.',
        actionLabel: 'Browse recipes',
        href: '/recipes',
      }),
    );
    refreshIcons();
    return root;
  }

  const route = itemRoute('recipe', recipe);

  history.recordView({
    id: recipe.id,
    entity: 'recipe',
    title: recipe.title,
    subtitle: [recipe.cuisine, recipe.category].filter(Boolean).join(' · ') || null,
    image: recipe.imagePreview || recipe.image,
    route,
  });
  const envelope = envelopeFor('recipe', recipe, route);

  applyMeta({
    title: recipe.title,
    description: recipe.cuisine
      ? `${recipe.title} — a ${recipe.category?.toLowerCase() || 'recipe'} from ${recipe.cuisine} cuisine with ${recipe.ingredients.length} ingredients.`
      : `${recipe.title} — ${recipe.ingredients.length} ingredients, step-by-step instructions.`,
    path: route,
    ogImage: recipe.image || undefined,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'Recipe',
      name: recipe.title,
      image: recipe.image ? [recipe.image] : undefined,
      recipeCategory: recipe.category || undefined,
      recipeCuisine: recipe.cuisine || undefined,
      recipeIngredient: recipe.ingredients.map((i) => [i.measure, i.name].filter(Boolean).join(' ')).filter(Boolean),
      recipeInstructions: recipe.instructions.map((step) => ({ '@type': 'HowToStep', position: step.step, text: step.text })),
      keywords: recipe.tags.length ? recipe.tags.join(', ') : undefined,
      author: { '@type': 'Organization', name: 'TheMealDB' },
      // No nutrition, times or ratings: TheMealDB does not provide them,
      // and CULINA never fabricates schema fields (PRD §46).
    },
  });

  /** Add this recipe's merged ingredients to the shopping-list page state. */
  async function addIngredientsToShoppingList() {
    if (!recipe.ingredients.length) {
      toast('This recipe lists no ingredients', { type: 'info' });
      return;
    }
    let added = 0;
    for (const ingredient of recipe.ingredients) {
      const result = shoppingList.addManual(ingredient.name);
      if (result.added) added++;
    }
    toast(
      added ? `${added} ingredient${added === 1 ? '' : 's'} added to your shopping list` : 'All these ingredients are already on your list',
      { type: added ? 'success' : 'info', action: 'Open list', onAction: () => navigate('/shopping-list') },
    );
  }

  async function share() {
    const url = new URL(route, location.origin).toString();
    const shareData = { title: recipe.title, text: `A recipe discovered on CULINA`, url };
    if (navigator.share) {
      try {
        await navigator.share(shareData);
        return;
      } catch {
        /* user canceled — fall through */
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      toast('Link copied to clipboard', { type: 'success' });
    } catch {
      toast('Couldn’t copy the link', { type: 'error' });
    }
  }

  /* ---------------------------------------------------------- hero */
  const hero = el(
    'header',
    { class: 'detail-hero', style: { marginTop: 'var(--space-6)' } },
    el(
      'div',
      { class: 'detail-hero-grid' },
      el('div', { class: 'detail-hero-media' }, mediaImage({ image: recipe.image, title: recipe.title, eager: true })),
      el(
        'div',
        {},
        el('p', { class: 'overline' }, icon('flame'), 'Recipe'),
        el('h1', {}, recipe.title),
        el(
          'p',
          { class: 'detail-summary' },
          [recipe.cuisine, recipe.category].filter(Boolean).length
            ? `A ${recipe.category?.toLowerCase() || 'dish'}${recipe.cuisine ? ` from ${recipe.cuisine} cuisine` : ''}, brought to you by TheMealDB with ${recipe.ingredients.length} ingredients.`
            : `Brought to you by TheMealDB with ${recipe.ingredients.length} ingredients.`,
        ),
        el(
          'div',
          { class: 'detail-meta-row' },
          recipe.cuisine ? el('span', { class: 'badge badge-accent' }, recipe.cuisine) : null,
          recipe.category ? el('span', { class: 'badge badge-neutral' }, recipe.category) : null,
          ...recipe.tags.slice(0, 4).map((tag) => el('span', { class: 'badge badge-neutral' }, tag)),
          el('span', { class: 'provider-badge' }, el('span', { class: 'badge-dot', 'aria-hidden': 'true' }), 'TheMealDB'),
        ),
        el(
          'div',
          { class: 'detail-actions' },
          favoriteButton('recipe', recipe),
          el('button', { class: 'btn btn-secondary', type: 'button', onclick: () => envelope && addToPlanDialog(envelope) }, icon('calendar-days'), 'Add to plan'),
          el('button', { class: 'btn btn-secondary', type: 'button', onclick: () => addIngredientsToShoppingList() }, icon('shopping-basket'), 'Ingredients to list'),
          el('button', { class: 'btn btn-secondary', type: 'button', onclick: () => share() }, icon('share-2'), 'Share'),
          el('button', { class: 'btn btn-ghost', type: 'button', onclick: () => window.print() }, icon('printer'), 'Print'),
        ),
      ),
    ),
  );

  /* Sticky action bar — becomes the mobile bottom action area via CSS. */
  const stickyBar = el(
    'div',
    { class: 'recipe-actionbar', role: 'toolbar', 'aria-label': 'Recipe actions' },
    el('span', { class: 'recipe-actionbar-title clamp-1' }, recipe.title),
    el(
      'span',
      { class: 'recipe-actionbar-actions' },
      el('button', { class: 'btn btn-secondary btn-sm', type: 'button', onclick: () => envelope && addToPlanDialog(envelope) }, icon('calendar-days'), 'Plan'),
      el('button', { class: 'btn btn-secondary btn-sm', type: 'button', onclick: () => addIngredientsToShoppingList() }, icon('shopping-basket'), 'Add to list'),
      el('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: () => share() }, icon('share-2'), 'Share'),
    ),
  );

  /* ------------------------------------------------- ingredients (aside) */
  const ingredientList = el(
    'ul',
    { class: 'ingredient-list' },
    ...recipe.ingredients.map((ing) => {
      const row = el(
        'li',
        {},
        el('input', { type: 'checkbox', id: `ing-${ing.name.replace(/\W+/g, '-')}` }),
        el('label', { for: `ing-${ing.name.replace(/\W+/g, '-')}`, style: { cursor: 'pointer', flex: 1 } },
          el('span', { class: 'ing-measure' }, ing.measure || '·'),
          el('span', { class: 'ing-name' }, ing.name),
        ),
      );
      return row;
    }),
  );
  ingredientList.addEventListener('change', (event) => {
    if (event.target.matches('input[type="checkbox"]')) {
      event.target.closest('li').classList.toggle('got', event.target.checked);
    }
  });

  /* ------------------------------------------------------- sections */
  const aside = el(
    'aside',
    { class: 'detail-aside' },
    el(
      'section',
      { class: 'detail-section', 'aria-labelledby': 'ingredients-h' },
      el('h2', { id: 'ingredients-h' }, icon('shopping-basket'), `Ingredients (${recipe.ingredients.length})`),
      ingredientList,
      el(
        'p',
        { class: 'muted', style: { fontSize: 'var(--text-xs)', marginTop: 'var(--space-3)' } },
        'Tap to check off what you already have. Measures appear exactly as provided by the source.',
      ),
    ),
    sourcePanel('mealdb', {
      note: 'TheMealDB provides no cooking times, servings or nutrition for recipes — those fields are intentionally absent rather than estimated.',
    }),
  );

  const main = el(
    'div',
    { class: 'detail-main' },
    el(
      'section',
      { class: 'detail-section', 'aria-labelledby': 'instructions-h' },
      el('h2', { id: 'instructions-h' }, icon('cooking-pot'), 'Instructions'),
      recipe.instructions.length
        ? el('ol', { class: 'steps' }, ...recipe.instructions.map((step) => el('li', {}, el('p', {}, step.text))))
        : el('p', { class: 'muted' }, 'This recipe has no written instructions in the source database.'),
    ),
    el(
      'section',
      { class: 'detail-section', 'aria-labelledby': 'nutrition-h' },
      el('h2', { id: 'nutrition-h' }, icon('flask-conical'), 'Nutrition'),
      nutritionPanel(recipe.nutrition),
    ),
    recipe.youtube
      ? el(
          'section',
          { class: 'detail-section', 'aria-labelledby': 'video-h' },
          el('h2', { id: 'video-h' }, icon('eye'), 'Watch it being made'),
          el('a', { class: 'btn btn-secondary', href: recipe.youtube, target: '_blank', rel: 'noopener noreferrer' }, icon('external-link'), 'Open video on YouTube'),
        )
      : null,
    el('div', { id: 'related-host' }, el('div', { class: 'skeleton', style: { height: '3rem', width: '40%' } }), el('div', { class: 'stack-4' })),
  );

  const sections = el(
    'div',
    { class: 'detail-sections' },
    aside,
    main,
  );

  root.replaceChildren(hero, sections);

  /* ------------------------------------------------------ related recipes */
  const relatedHost = root.querySelector('#related-host');
  mealdb
    .filterByCategory(recipe.category, { signal: ctx.signal })
    .then((items) => {
      if (!relatedHost.isConnected) return;
      const related = items.filter((item) => item.sourceId !== recipe.sourceId).slice(0, 4);
      renderInto(
        relatedHost,
        el(
          'section',
          { class: 'detail-section', 'aria-labelledby': 'related-h' },
          el('h2', { id: 'related-h' }, icon('sparkles'), recipe.category ? `More from ${recipe.category}` : 'You might also like'),
          related.length
            ? entityGrid(related, { entity: 'recipe' })
            : el('p', { class: 'muted' }, 'No related recipes in this category right now.'),
        ),
      );
      refreshIcons();
      mountReveal(ctx, relatedHost.querySelector('.grid-cards'));
    })
    .catch(() => {
      if (relatedHost.isConnected) {
        renderInto(relatedHost, el('p', { class: 'muted' }, 'Related recipes are temporarily unavailable.'));
      }
    });

  root.append(stickyBar);
  refreshIcons();
  return root;
}
