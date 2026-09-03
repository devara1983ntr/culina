/**
 * CULINA — “Surprise me” modal (PRD §60).
 * Random discovery across providers with Explore / Save / Surprise again.
 */
import { el, icon } from '../utils/dom.js';
import { refreshIcons } from '../utils/icons.js';
import { openModal } from './modal.js';
import { surpriseMe } from '../services/surprise.js';
import { navigate } from '../router.js';
import { favorites, envelopeFor } from '../services/favorites.js';
import { itemRoute, mediaImage, monogramTile } from './cards.js';
import { toast } from './toast.js';
import { truncate } from '../utils/format.js';
import { pop } from '../utils/motion.js';

function entityForKind(kind) {
  return { recipe: 'recipe', cocktail: 'cocktail', fruit: 'fruit', brewery: 'brewery', image: null }[kind];
}

function describe(kind, item) {
  switch (kind) {
    case 'recipe':
      return [item.cuisine, item.category].filter(Boolean).join(' · ') || 'A recipe worth your evening';
    case 'cocktail':
      return [item.category, item.glass].filter(Boolean).join(' · ') || 'A drink worth mixing';
    case 'fruit':
      return item.nutrition?.calories != null
        ? `${item.family || 'Fruit'} · ${Math.round(item.nutrition.calories)} kcal per 100 g`
        : item.family || 'Fruit';
    case 'brewery':
      return [item.breweryType, [item.city, item.country].filter(Boolean).join(', ')].filter(Boolean).join(' · ');
    default:
      return 'A little food photography to spark an idea';
  }
}

export function openSurprise() {
  let controller = null;
  const stage = el('div', { class: 'surprise-stage' });

  const { close } = openModal({
    title: 'Surprise me',
    content: stage,
    onClose: () => controller?.abort(),
  });

  function render({ kind, item, route }) {
    const entity = entityForKind(kind);
    const title = item.title || item.name || 'Your next discovery';
    const image = mediaImage({ image: item.image, title, eager: true });
    if (image.tagName === 'IMG') {
      image.style.width = '100%';
      image.style.height = '100%';
    }

    let saveButton = null;
    if (entity) {
      const envelope = envelopeFor(entity, item, route);
      const collectionMap = { recipe: 'recipes', cocktail: 'cocktails', fruit: 'fruits', brewery: 'breweries' };
      const isSaved = envelope && favorites.has(collectionMap[entity], envelope.id);
      saveButton = el(
        'button',
        { class: 'btn btn-secondary', type: 'button', 'aria-pressed': String(Boolean(isSaved)) },
        icon('heart'),
        isSaved ? 'Saved' : 'Save',
      );
      saveButton.addEventListener('click', () => {
        const added = favorites.toggle(envelope);
        saveButton.setAttribute('aria-pressed', String(added));
        saveButton.replaceChildren(icon('heart'), added ? 'Saved' : 'Save');
        pop(saveButton);
        refreshIcons();
        toast(added ? `Saved “${truncate(title, 42)}”` : `Removed “${truncate(title, 42)}”`, { type: added ? 'success' : 'info' });
      });
    }

    const again = el('button', { class: 'btn btn-ghost', type: 'button' }, icon('rotate-cw'), 'Surprise again');
    again.addEventListener('click', () => load());

    stage.replaceChildren(
      el('p', { class: 'overline' }, 'Your next discovery'),
      el('div', { class: 'surprise-media' }, image),
      el('h2', {}, truncate(title, 60)),
      el('p', {}, describe(kind, item)),
      el(
        'div',
        { class: 'surprise-actions' },
        route
          ? el('button', { class: 'btn btn-primary', type: 'button', onclick: () => { close(); navigate(route); } }, 'Explore it', icon('arrow-right'))
          : null,
        saveButton,
        again,
      ),
    );
    refreshIcons();
  }

  function renderLoading() {
    stage.replaceChildren(
      el('div', { class: 'surprise-media', role: 'status', 'aria-label': 'Finding something delicious' },
        el('div', { class: 'monogram-tile' }, el('span', { class: 'spinner spinner-lg', style: { fontSize: 0 } }, '')),
      ),
      el('span', { class: 'spinner spinner-lg', 'aria-hidden': 'true' }),
      el('p', { class: 'muted' }, 'Finding something delicious…'),
    );
  }

  function renderError(err) {
    stage.replaceChildren(
      el('span', { class: 'state-icon', style: { width: '52px', height: '52px', display: 'grid', placeItems: 'center', borderRadius: '50%', background: 'var(--color-danger-soft)', color: 'var(--color-danger)' } }, icon('alert-triangle')),
      el('h2', {}, 'All sources are busy'),
      el('p', { class: 'muted' }, err?.message || 'None of the discovery sources could be reached right now.'),
      el('div', { class: 'surprise-actions' }, el('button', { class: 'btn btn-primary', type: 'button', onclick: () => load() }, icon('rotate-cw'), 'Try again')),
    );
    refreshIcons();
  }

  async function load() {
    controller?.abort();
    controller = new AbortController();
    renderLoading();
    try {
      const result = await surpriseMe({ signal: controller.signal });
      if (controller.signal.aborted) return;
      render(result);
    } catch (err) {
      if (err?.name === 'AbortError') return;
      renderError(err);
    }
  }

  load();
}
