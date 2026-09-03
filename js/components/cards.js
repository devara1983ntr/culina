/**
 * CULINA — The card system: one visual language for every entity,
 * provider badges included (data-source transparency, PRD §62).
 */
import { el, icon } from '../utils/dom.js';
import { refreshIcons } from '../utils/icons.js';
import { pop } from '../utils/motion.js';
import { favorites, envelopeFor } from '../services/favorites.js';
import { toast } from './toast.js';
import { providerBadge } from './providerBadge.js';
import { formatRating, truncate } from '../utils/format.js';

/** Route for a normalized item (null when the entity has no detail page). */
export function itemRoute(entity, item) {
  if (!item) return null;
  switch (entity) {
    case 'recipe':
      return `/recipe/${item.sourceId}`;
    case 'cocktail':
      return `/cocktail/${item.sourceId}`;
    case 'fruit':
      return `/ingredient/fruityvice/${item.sourceId}`;
    case 'ingredient':
      return `/ingredient/mealdb/${item.sourceId}`;
    case 'product':
      return `/product/${item.sourceId}`;
    case 'beer':
      return `/beer/${item.style || 'ale'}/${item.sourceId}`;
    case 'brewery':
      return item.name ? `/brewery/${encodeURIComponent(item.name)}` : null;
    default:
      return null;
  }
}

/** Typographic tile for providers without imagery — honest, designed, no fake photos. */
export function monogramTile(title, { small = false } = {}) {
  const letter = (title || '?').trim().charAt(0).toUpperCase() || '?';
  return el('div', { class: 'monogram-tile', 'aria-hidden': 'true' }, el('span', {}, letter));
}

/** Image with graceful degradation to a monogram tile (PRD §41). */
export function mediaImage({ image, title, eager = false, className = '' }) {
  if (!image) return monogramTile(title);
  const img = el('img', {
    src: image,
    alt: title ? truncate(title, 90) : '',
    loading: eager ? 'eager' : 'lazy',
    decoding: 'async',
    referrerpolicy: 'no-referrer',
  });
  img.addEventListener('error', () => {
    const tile = monogramTile(title);
    img.replaceWith(tile);
  });
  return img;
}

/* ------------------------------------------------------------------ */
/* Favorite button                                                     */
/* ------------------------------------------------------------------ */

export function favoriteButton(entity, item, { label } = {}) {
  const route = itemRoute(entity, item);
  const envelope = envelopeFor(entity, item, route);
  if (!envelope) return null;
  const collection = favorites.has(
    { recipe: 'recipes', cocktail: 'cocktails', beer: 'beers', fruit: 'fruits', product: 'products', coffee: 'coffees', brewery: 'breweries' }[entity],
    envelope.id,
  );

  const button = el(
    'button',
    {
      class: 'fav-btn',
      type: 'button',
      'aria-pressed': String(collection),
      'aria-label': collection ? `Remove ${envelope.title} from favorites` : `Save ${envelope.title} to favorites`,
      title: label || 'Save to favorites',
    },
    icon('heart'),
  );

  button.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    const added = favorites.toggle(envelope);
    button.setAttribute('aria-pressed', String(added));
    button.setAttribute('aria-label', added ? `Remove ${envelope.title} from favorites` : `Save ${envelope.title} to favorites`);
    pop(button);
    refreshIcons();
    toast(added ? `Saved “${truncate(envelope.title, 42)}” to favorites` : `Removed “${truncate(envelope.title, 42)}” from favorites`, {
      type: added ? 'success' : 'info',
      action: added ? 'View' : null,
      onAction: added ? () => location.assign('/favorites') : null,
    });
  });

  return button;
}

/* ------------------------------------------------------------------ */
/* Meta lines per entity                                               */
/* ------------------------------------------------------------------ */

function metaFor(entity, item) {
  switch (entity) {
    case 'recipe': {
      const parts = [item.cuisine, item.category];
      if (item.ingredients?.length) parts.push(`${item.ingredients.length} ingredients`);
      return parts.filter(Boolean);
    }
    case 'cocktail':
      return [item.category, item.glass].filter(Boolean);
    case 'beer':
      return [item.style, item.rating ? `★ ${formatRating(item.rating.average)}` : null, item.price].filter(Boolean);
    case 'fruit':
      return [item.family, item.nutrition?.calories != null ? `${Math.round(item.nutrition.calories)} kcal / 100 g` : null].filter(Boolean);
    case 'product':
      return [item.brand, item.nutrition?.calories != null ? `${Math.round(item.nutrition.calories)} kcal / 100 g` : null].filter(Boolean);
    case 'brewery':
      return [item.breweryType, [item.city, item.country].filter(Boolean).join(', ')].filter(Boolean);
    case 'coffee':
      return [item.variant === 'iced' ? 'Iced' : 'Hot', item.ingredients?.length ? `${item.ingredients.length} ingredients` : null].filter(Boolean);
    case 'ingredient':
      return [item.type, item.description ? truncate(item.description, 60) : null].filter(Boolean);
    default:
      return [];
  }
}

function tagChipsFor(entity, item) {
  if (entity === 'recipe') return (item.tags || []).slice(0, 2);
  if (entity === 'cocktail') return (item.tags || []).slice(0, 2);
  if (entity === 'product') return item.nutriscore ? [`Nutri-Score ${item.nutriscore.toUpperCase()}`] : [];
  return [];
}

/* ------------------------------------------------------------------ */
/* The card                                                             */
/* ------------------------------------------------------------------ */

/**
 * @param {{entity: string, item: object, showFavorite?: boolean,
 *          eager?: boolean, footerExtra?: Node, badgeExtra?: Node}} options
 */
export function entityCard({ entity, item, showFavorite = true, eager = false, footerExtra = null, badgeExtra = null }) {
  if (!item) return null;
  const route = itemRoute(entity, item);
  const title = item.title || item.name || 'Untitled';
  const meta = metaFor(entity, item).filter(Boolean);
  const tags = tagChipsFor(entity, item);

  const mediaInner = mediaImage({ image: item.imagePreview || item.image, title, eager });
  const media = route
    ? el('a', { class: 'card-media', href: route, 'aria-label': `Open ${title}` }, mediaInner)
    : el('div', { class: 'card-media' }, mediaInner);

  if (tags.length) {
    media.append(el('span', { class: 'badge badge-neutral media-overlay-tag' }, tags[0]));
  }

  const titleNode = route
    ? el('a', { class: 'card-title', href: route }, title)
    : el('h2', { class: 'card-title', style: { fontSize: '1.02rem' } }, title);

  const metaNode = meta.length
    ? el(
        'div',
        { class: 'card-meta' },
        meta.slice(0, 3).flatMap((part, i) => (i === 0 ? [part] : [el('span', { class: 'sep', 'aria-hidden': 'true' }, '·'), part])),
      )
    : null;

  const card = el(
    'article',
    { class: `card reveal${route ? ' is-clickable' : ''}` },
    media,
    showFavorite ? favoriteButton(entity, item) : null,
    el(
      'div',
      { class: 'card-body' },
      titleNode,
      metaNode,
      el(
        'div',
        { class: 'card-footer-row' },
        el('div', { class: 'cluster' }, badgeExtra || providerBadge(item.source)),
        footerExtra,
      ),
    ),
  );

  return card;
}

/** Grid of cards for one entity type. */
export function entityGrid(items, { entity, limit, ...cardOptions } = {}) {
  const list = typeof limit === 'number' ? items.slice(0, limit) : items;
  return el(
    'div',
    { class: `grid-cards${['brewery', 'product', 'beer'].includes(entity) ? ' wide' : ''}` },
    ...list.map((item) => entityCard({ entity, item, ...cardOptions })).filter(Boolean),
  );
}
