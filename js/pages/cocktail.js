/**
 * CULINA — Cocktail detail (PRD §16): image, name, ingredients, measurements,
 * instructions, glass, category, alcoholic status.
 */
import { el, icon } from '../utils/dom.js';
import { refreshIcons } from '../utils/icons.js';
import { applyMeta } from '../seo.js';
import { cocktaildb } from '../api/adapters/index.js';
import { favoriteButton, itemRoute, mediaImage, entityGrid } from '../components/cards.js';
import { sourcePanel } from '../components/providerBadge.js';
import { skeletonDetail, emptyState, errorState, renderInto } from '../components/states.js';
import { toast } from '../components/toast.js';
import { mountReveal } from './shared.js';
import { history } from '../services/history.js';

export async function render(ctx) {
  const { id: rawId } = ctx.params;
  // Route ids arrive as `provider:sourceId` (e.g. `mealdb:52772`) — providers
  // only understand the sourceId half.
  const id = rawId.includes(':') ? rawId.slice(rawId.indexOf(':') + 1) : rawId;
  const root = el('div', { class: 'page' });
  root.append(skeletonDetail());

  let drink;
  try {
    drink = await cocktaildb.lookup(id, { signal: ctx.signal });
  } catch (err) {
    if (err?.name === 'AbortError') return root;
    renderInto(root, errorState({ error: err, onRetry: () => location.reload() }));
    refreshIcons();
    return root;
  }

  if (!drink) {
    applyMeta({ title: 'Cocktail not found', path: ctx.path });
    renderInto(
      root,
      emptyState({
        icon: 'martini',
        title: 'Cocktail not found',
        message: 'TheCocktailDB has no cocktail with this id.',
        actionLabel: 'Browse cocktails',
        href: '/cocktails',
      }),
    );
    refreshIcons();
    return root;
  }

  const route = itemRoute('cocktail', drink);

  history.recordView({
    id: drink.id,
    entity: 'cocktail',
    title: drink.title,
    subtitle: drink.category || null,
    image: drink.imagePreview || drink.image,
    route,
  });

  applyMeta({
    title: drink.title,
    description: `${drink.title} — ${drink.category || 'cocktail'}${drink.glass ? ` served in a ${drink.glass.toLowerCase()}` : ''} with ${drink.ingredients.length} ingredients. Recipe from TheCocktailDB.`,
    path: route,
    ogImage: drink.image || undefined,
  });

  async function share() {
    const url = new URL(route, location.origin).toString();
    if (navigator.share) {
      try {
        await navigator.share({ title: drink.title, text: 'A cocktail discovered on CULINA', url });
        return;
      } catch {
        /* canceled */
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      toast('Link copied to clipboard', { type: 'success' });
    } catch {
      toast('Couldn’t copy the link', { type: 'error' });
    }
  }

  const hero = el(
    'header',
    { class: 'detail-hero', style: { marginTop: 'var(--space-6)' } },
    el(
      'div',
      { class: 'detail-hero-grid' },
      el('div', { class: 'detail-hero-media' }, mediaImage({ image: drink.image, title: drink.title, eager: true })),
      el(
        'div',
        {},
        el('p', { class: 'overline' }, icon('martini'), 'Cocktail'),
        el('h1', {}, drink.title),
        el(
          'p',
          { class: 'detail-summary' },
          [drink.category, drink.iba, drink.glass].filter(Boolean).length
            ? `A ${drink.category?.toLowerCase() || 'cocktail'}${drink.iba ? ` on the IBA ${drink.iba} list` : ''}${drink.glass ? `, served in a ${drink.glass.toLowerCase()}` : ''} — mixed with ${drink.ingredients.length} ingredients.`
            : `Mixed with ${drink.ingredients.length} ingredients.`,
        ),
        el(
          'div',
          { class: 'detail-meta-row' },
          drink.category ? el('span', { class: 'badge badge-accent' }, drink.category) : null,
          drink.alcoholic === true ? el('span', { class: 'badge badge-warning' }, 'Alcoholic') : null,
          drink.alcoholic === false ? el('span', { class: 'badge badge-success' }, 'Non-alcoholic') : null,
          drink.glass ? el('span', { class: 'badge badge-neutral' }, icon('glass-water'), ` ${drink.glass}`) : null,
          ...drink.tags.slice(0, 3).map((tag) => el('span', { class: 'badge badge-neutral' }, tag)),
          el('span', { class: 'provider-badge' }, el('span', { class: 'badge-dot', 'aria-hidden': 'true' }), 'TheCocktailDB'),
        ),
        el(
          'div',
          { class: 'detail-actions' },
          favoriteButton('cocktail', drink),
          el('button', { class: 'btn btn-secondary', type: 'button', onclick: () => share() }, icon('share-2'), 'Share'),
          el('button', { class: 'btn btn-ghost', type: 'button', onclick: () => window.print() }, icon('printer'), 'Print'),
        ),
      ),
    ),
  );

  const ingredientList = el(
    'ul',
    { class: 'ingredient-list' },
    ...drink.ingredients.map((ing) => {
      const row = el(
        'li',
        {},
        el('input', { type: 'checkbox', id: `ding-${ing.name.replace(/\W+/g, '-')}` }),
        el('label', { for: `ding-${ing.name.replace(/\W+/g, '-')}`, style: { cursor: 'pointer', flex: 1 } },
          el('span', { class: 'ing-measure' }, ing.measure || '·'),
          el('span', { class: 'ing-name' }, ing.name),
        ),
      );
      return row;
    }),
  );

  const relatedHost = el('div');

  const root2 = el(
    'div',
    {},
    hero,
    el(
      'div',
      { class: 'detail-sections' },
      el(
        'aside',
        { class: 'detail-aside' },
        el(
          'section',
          { class: 'detail-section', 'aria-labelledby': 'dingredients-h' },
          el('h2', { id: 'dingredients-h' }, icon('shopping-basket'), `Ingredients (${drink.ingredients.length})`),
          ingredientList,
        ),
        sourcePanel('cocktaildb'),
      ),
      el(
        'div',
        { class: 'detail-main' },
        el(
          'section',
          { class: 'detail-section', 'aria-labelledby': 'dinstructions-h' },
          el('h2', { id: 'dinstructions-h' }, icon('cooking-pot'), 'Instructions'),
          drink.instructions.length
            ? el('ol', { class: 'steps' }, ...drink.instructions.map((step) => el('li', {}, el('p', {}, step.text))))
            : el('p', { class: 'muted' }, 'No written instructions in the source database.'),
        ),
        el(
          'section',
          { class: 'detail-section', 'aria-labelledby': 'dvideo-h' },
          el('h2', { id: 'dvideo-h' }, icon('sparkles'), 'Keep mixing'),
          relatedHost,
        ),
      ),
    ),
  );

  root.replaceChildren(...root2.children);

  cocktaildb
    .filterByCategory(drink.category, { signal: ctx.signal })
    .then((items) => {
      if (!relatedHost.isConnected) return;
      const related = items.filter((item) => item.sourceId !== drink.sourceId).slice(0, 4);
      renderInto(
        relatedHost,
        related.length
          ? entityGrid(related, { entity: 'cocktail' })
          : el('p', { class: 'muted' }, 'No related cocktails in this category right now.'),
      );
      refreshIcons();
      mountReveal(ctx, relatedHost.querySelector('.grid-cards'));
    })
    .catch(() => {
      if (relatedHost.isConnected) renderInto(relatedHost, el('p', { class: 'muted' }, 'Related cocktails are temporarily unavailable.'));
    });

  refreshIcons();
  return root;
}
