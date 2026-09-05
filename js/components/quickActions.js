/**
 * CULINA — Quick actions sheet (long-press on touch, right-click on desktop).
 *
 * An action-sheet modal for entity cards: Open · Save/Remove favorite ·
 * Add to meal plan (recipes & cocktails) · Copy link · Share (when the
 * device supports the Web Share API).
 *
 * Accessibility contract: every action in this sheet is ALSO reachable
 * through visible UI (card link, heart button, plan button on detail pages,
 * the address bar) — the gesture is a shortcut, never the only way.
 */
import { el, icon } from '../utils/dom.js';
import { refreshIcons } from '../utils/icons.js';
import { openModal } from './modal.js';
import { toast } from './toast.js';
import { favorites, envelopeFor } from '../services/favorites.js';
import { navigate, basePath } from '../router.js';
import { safeUrl, truncate } from '../utils/format.js';
import { ENTITY_LABELS } from '../constants.js';

const COLLECTION_FOR_ENTITY = {
  recipe: 'recipes',
  cocktail: 'cocktails',
  beer: 'beers',
  fruit: 'fruits',
  product: 'products',
  coffee: 'coffees',
  brewery: 'breweries',
};

/**
 * Open the quick-actions sheet for a normalized entity item.
 * @param {{entity: string, item?: object, route?: string|null, envelope?: object|null}} options
 *   Pass `envelope` directly when the caller already has a favorites
 *   envelope (e.g. the Favorites page); otherwise one is derived via
 *   envelopeFor(entity, item, route).
 */
export function openQuickActions({ entity, item = null, route = null, envelope = null }) {
  const env = envelope || (item ? envelopeFor(entity, item, route) : null);
  const title = env?.title || item?.title || item?.name || 'Item';
  const entityRoute = route || env?.route || null;

  const rows = [];
  let modal = null;

  const actionRow = (iconName, label, hint, run, { danger = false } = {}) => {
    const button = el(
      'button',
      { class: `action-row${danger ? ' is-danger' : ''}`, type: 'button' },
      el('span', { class: 'action-icon', 'aria-hidden': 'true' }, icon(iconName)),
      el(
        'span',
        { class: 'action-copy' },
        el('span', { class: 'action-label' }, label),
        hint ? el('span', { class: 'action-hint' }, hint) : null,
      ),
      icon('chevron-right'),
    );
    button.addEventListener('click', () => {
      modal?.close();
      run();
    });
    rows.push(button);
    return button;
  };

  if (entityRoute) {
    actionRow('arrow-up-right', 'Open', `View the full ${String(ENTITY_LABELS[entity] || 'page').replace(/s$/, '').toLowerCase()}`, () => navigate(entityRoute));
  }

  if (env) {
    const collection = COLLECTION_FOR_ENTITY[entity];
    const saved = collection ? favorites.has(collection, env.id) : false;
    actionRow(
      'heart',
      saved ? 'Remove from favorites' : 'Save to favorites',
      'Stored locally on this device',
      () => {
        const added = favorites.toggle(env);
        toast(added ? `Saved “${truncate(title, 42)}” to favorites` : `Removed “${truncate(title, 42)}” from favorites`, {
          type: added ? 'success' : 'info',
        });
      },
      { danger: saved },
    );
    if (entity === 'recipe' || entity === 'cocktail') {
      actionRow('calendar-days', 'Add to meal plan', 'Pick a day & meal', async () => {
        // Dynamic import keeps the card → quick-actions → planner widget
        // dependency acyclic (plannerWidgets imports cards for thumbnails).
        const { addToPlanDialog } = await import('./plannerWidgets.js');
        addToPlanDialog(env);
      });
    }
  }

  if (entityRoute) {
    // Build the shareable absolute URL first, then validate it (safeUrl
    // accepts http/https only — provider data never reaches this path).
    let absolute = null;
    try {
      absolute = safeUrl(new URL(basePath() + entityRoute, location.origin).href);
    } catch {
      absolute = null;
    }
    if (absolute) {
      actionRow('link', 'Copy link', 'Shareable URL for this item', async () => {
        try {
          await navigator.clipboard.writeText(absolute);
          toast('Link copied to clipboard', { type: 'success' });
        } catch {
          toast('Couldn’t copy the link — your browser blocked clipboard access', { type: 'error' });
        }
      });
      if (typeof navigator.share === 'function') {
        actionRow('share-2', 'Share…', 'Via your device’s share sheet', async () => {
          try {
            await navigator.share({ title: `${title} · CULINA`, url: absolute });
          } catch {
            /* dismissed by the user — nothing to report */
          }
        });
      }
    }
  }

  if (!rows.length) return null;

  modal = openModal({
    title: truncate(title, 64),
    content: el(
      'div',
      { class: 'action-sheet' },
      el('p', { class: 'action-sheet-entity' }, ENTITY_LABELS[entity] || entity || 'Quick actions'),
      ...rows,
    ),
  });
  refreshIcons();
  return modal;
}

/**
 * Attach the long-press (touch/pen) + context-menu (mouse) gesture that
 * opens the sheet. Long-press fires after `delay` ms of stillness; movement
 * beyond `moveTolerance` px or any scroll cancels it, and the click that
 * would otherwise follow a fired long-press is suppressed in capture phase.
 *
 * Returns a cleanup function (listeners on removed nodes are harmless, but
 * page-level callers may still want it).
 */
export function attachQuickActions(node, open, { delay = 450, moveTolerance = 10 } = {}) {
  if (!node || typeof open !== 'function') return () => {};

  let timer = null;
  let startX = 0;
  let startY = 0;
  let fired = false;

  const cancel = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    window.removeEventListener('scroll', cancel);
  };

  const onPointerDown = (event) => {
    // Touch/pen only — mouse users get the sheet via right-click, so a slow
    // click-and-hold never surprises them.
    if (event.pointerType !== 'touch' && event.pointerType !== 'pen') return;
    if (event.target instanceof Element && event.target.closest('button, a, input, select, textarea')) return;
    fired = false;
    startX = event.clientX;
    startY = event.clientY;
    cancel();
    timer = setTimeout(() => {
      timer = null;
      fired = true;
      if (navigator.vibrate) navigator.vibrate(12);
      open();
    }, delay);
    window.addEventListener('scroll', cancel, { passive: true });
  };

  const onPointerMove = (event) => {
    if (!timer) return;
    if (Math.abs(event.clientX - startX) > moveTolerance || Math.abs(event.clientY - startY) > moveTolerance) cancel();
  };

  const onPointerUp = () => cancel();

  const onClickCapture = (event) => {
    if (fired) {
      fired = false;
      event.preventDefault();
      event.stopPropagation();
    }
  };

  const onContextMenu = (event) => {
    if (event.target instanceof Element && event.target.closest('input, textarea')) return;
    event.preventDefault();
    open();
  };

  node.addEventListener('pointerdown', onPointerDown);
  node.addEventListener('pointermove', onPointerMove);
  node.addEventListener('pointerup', onPointerUp);
  node.addEventListener('pointercancel', onPointerUp);
  node.addEventListener('click', onClickCapture, true);
  node.addEventListener('contextmenu', onContextMenu);

  return () => {
    cancel();
    node.removeEventListener('pointerdown', onPointerDown);
    node.removeEventListener('pointermove', onPointerMove);
    node.removeEventListener('pointerup', onPointerUp);
    node.removeEventListener('pointercancel', onPointerUp);
    node.removeEventListener('click', onClickCapture, true);
    node.removeEventListener('contextmenu', onContextMenu);
  };
}
