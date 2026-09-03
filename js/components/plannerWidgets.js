/**
 * CULINA — Meal planner widgets (PRD §34–§35): week grid, drag & drop
 * (SortableJS with keyboard/button alternatives), add-to-plan dialog,
 * shopping-list drawer.
 */
import { el, icon } from '../utils/dom.js';
import { refreshIcons } from '../utils/icons.js';
import Sortable from 'sortablejs';
import { DAYS, MEALS } from '../constants.js';
import { planner } from '../services/planner.js';
import { toast } from './toast.js';
import { openModal } from './modal.js';
import { mediaImage } from './cards.js';

/** Dialog: choose day + meal, add a favoritable item envelope. */
export function addToPlanDialog(item) {
  if (!item || !item.id || !item.title) return;
  const daySelect = el(
    'select',
    { class: 'select', id: 'plan-day' },
    ...DAYS.map((d) => el('option', { value: d.id }, d.full)),
  );
  const mealSelect = el(
    'select',
    { class: 'select', id: 'plan-meal' },
    ...MEALS.map((m) => el('option', { value: m.id }, m.label)),
  );
  const confirm = el('button', { class: 'btn btn-primary', type: 'button' }, icon('plus'), 'Add to plan');

  confirm.addEventListener('click', () => {
    const ok = planner.add(daySelect.value, mealSelect.value, {
      id: item.id,
      title: item.title,
      image: item.imagePreview || item.image || null,
      source: item.source,
      sourceId: item.sourceId,
      route: item.route || null,
      entity: item.entity || 'recipe',
    });
    toast(
      ok ? `Added “${item.title}” to ${DAYS.find((d) => d.id === daySelect.value).full} ${MEALS.find((m) => m.id === mealSelect.value).label}` : 'That slot is full (max 6 items)',
      { type: ok ? 'success' : 'error' },
    );
    if (ok) modal.close();
  });

  const modal = openModal({
    title: 'Add to meal plan',
    content: el(
      'div',
      { class: 'stack-4' },
      el('div', { class: 'cluster' }, mediaImage({ image: item.imagePreview || item.image, title: item.title }), el('strong', {}, item.title)),
      el('div', { class: 'grid', style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' } },
        el('div', {}, el('label', { class: 'field-label', for: 'plan-day' }, 'Day'), daySelect),
        el('div', {}, el('label', { class: 'field-label', for: 'plan-meal' }, 'Meal'), mealSelect),
      ),
      el('p', { class: 'muted', style: { fontSize: 'var(--text-sm)' } }, 'You can also drag items between slots on the planner.'),
      el('div', { class: 'cluster', style: { justifyContent: 'flex-end' } }, confirm),
    ),
  });
}

/** Render the full week grid from planner state. */
export function plannerGrid() {
  const state = planner.get();
  const week = el('div', { class: 'planner-week' });

  for (const day of DAYS) {
    const dayNode = el('article', { class: 'planner-day', 'data-day': day.id });
    const clearBtn = el('button', { type: 'button', 'aria-label': `Clear ${day.full}`, title: `Clear ${day.full}` }, icon('trash-2'));
    clearBtn.addEventListener('click', () => {
      planner.clearDay(day.id);
      toast(`Cleared ${day.full}`, { type: 'info' });
    });
    dayNode.append(
      el('header', { class: 'planner-day-head' }, el('span', { class: 'day-name' }, day.short), clearBtn),
      el(
        'div',
        { class: 'planner-slots' },
        ...MEALS.map((meal) => {
          const slotList = state[day.id][meal.id] || [];
          const slot = el(
            'div',
            { class: 'planner-slot', 'data-day': day.id, 'data-meal': meal.id },
            el(
              'span',
              { class: 'planner-slot-label' },
              meal.label,
              el('span', { class: 'slot-count' }, slotList.length || ''),
            ),
          );
          if (!slotList.length) {
            slot.append(el('span', { class: 'planner-empty-slot' }, '—'));
          }
          slotList.forEach((entry, index) => {
            const thumb = mediaImage({ image: entry.image, title: entry.title });
            thumb.style.width = '34px';
            thumb.style.height = '34px';
            thumb.style.borderRadius = 'var(--radius-xs)';
            thumb.style.objectFit = 'cover';
            if (thumb.tagName === 'DIV') thumb.style.display = 'grid';

            const remove = el('button', { type: 'button', 'aria-label': `Remove ${entry.title}` }, icon('x'));
            remove.addEventListener('click', () => planner.removeAt(day.id, meal.id, index));
            const duplicate = el('button', { type: 'button', 'aria-label': `Duplicate ${entry.title}` }, icon('copy'));
            duplicate.addEventListener('click', () => {
              if (!planner.duplicateAt(day.id, meal.id, index)) toast('That slot is full', { type: 'error' });
            });
            const open = entry.route
              ? el('a', { href: entry.route, 'aria-label': `Open ${entry.title}`, style: { display: 'grid', placeItems: 'center', width: '34px', height: '34px' } }, thumb)
              : el('span', { style: { display: 'grid', placeItems: 'center' } }, thumb);

            slot.append(
              el(
                'div',
                { class: 'planner-item', 'data-index': index, title: entry.title },
                el('span', { 'aria-hidden': 'true', style: { display: 'grid', placeItems: 'center', color: 'var(--color-text-muted)' } }, icon('grip-vertical')),
                open,
                el('span', { class: 'item-title' }, entry.title),
                el('span', { class: 'item-actions' }, duplicate, remove),
              ),
            );
          });
          return slot;
        }),
      ),
    );
    week.append(dayNode);
  }
  refreshIcons();
  return week;
}

/**
 * Wire SortableJS drag & drop across slots. Returns a cleanup function.
 * Keyboard alternatives (remove/duplicate/add buttons) exist on every item.
 */
export function initSortable(gridEl) {
  const instances = [];
  gridEl.querySelectorAll('.planner-slot').forEach((slot) => {
    instances.push(
      new Sortable(slot, {
        group: 'culina-planner',
        animation: 150,
        handle: '.planner-item',
        draggable: '.planner-item',
        chosenClass: 'is-chosen',
        onEnd: (event) => {
          const fromDay = event.from.dataset.day;
          const fromMeal = event.from.dataset.meal;
          const toDay = event.to.dataset.day;
          const toMeal = event.to.dataset.meal;
          planner.move(fromDay, fromMeal, event.oldIndex, toDay, toMeal, event.newIndex);
        },
      }),
    );
  });
  return () => instances.forEach((instance) => instance.destroy());
}

/** Shopping list drawer. `generate` returns the list (async). */
export function shoppingListDialog(generate) {
  const body = el('div', { class: 'stack-4' });
  const modal = openModal({ title: 'Shopping list', content: body, size: 'modal-wide' });

  function renderLoading() {
    body.replaceChildren(
      el('div', { class: 'stack-3', role: 'status' }, el('span', { class: 'spinner' }), el('span', { class: 'muted' }, 'Collecting ingredients from your plan…')),
    );
  }

  function renderList({ items, failed }) {
    body.replaceChildren();
    if (!items.length) {
      body.append(
        el(
          'div',
          { class: 'state-block' },
          el('span', { class: 'state-icon' }, icon('shopping-basket')),
          el('h3', { style: { fontSize: '1.05rem' } }, 'Nothing to shop for yet'),
          el('p', {}, 'Add a few recipes to your week and the merged list will appear here.'),
        ),
      );
      refreshIcons();
      return;
    }

    const list = el(
      'ul',
      { class: 'shopping-list' },
      ...items.map((item) =>
        el(
          'li',
          {},
          el('input', { type: 'checkbox', id: `shop-${item.name.replace(/\W+/g, '-')}` }),
          el('label', { for: `shop-${item.name.replace(/\W+/g, '-')}`, style: { cursor: 'pointer' } }, el('strong', {}, item.name)),
          el('span', { class: 'muted', style: { fontSize: 'var(--text-xs)', display: 'block' } }, item.recipes.map((r) => `in ${r}`).join(', ')),
          el('span', { class: 'ing-qty' }, item.display),
        ),
      ),
    );
    list.addEventListener('change', (event) => {
      if (event.target.matches('input[type="checkbox"]')) {
        event.target.closest('li').classList.toggle('got', event.target.checked);
      }
    });

    if (failed.length) {
      body.append(
        el(
          'div',
          { class: 'notice is-warning' },
          icon('alert-triangle'),
          el('span', {}, `Couldn’t load details for: ${failed.join(', ')}. Their ingredients are not merged into this list.`),
        ),
      );
    }

    const copyButton = el('button', { class: 'btn btn-secondary', type: 'button' }, icon('copy'), 'Copy list');
    copyButton.addEventListener('click', async () => {
      const text = ['CULINA shopping list', ...items.map((i) => `${i.name} — ${i.display}`)].join('\n');
      let ok = false;
      try {
        await navigator.clipboard.writeText(text);
        ok = true;
      } catch {
        try {
          const area = el('textarea', { style: { position: 'fixed', opacity: 0 } }, text);
          document.body.append(area);
          area.select();
          ok = document.execCommand('copy');
          area.remove();
        } catch {
          ok = false;
        }
      }
      toast(ok ? 'Shopping list copied to clipboard' : 'Couldn’t access the clipboard', { type: ok ? 'success' : 'error' });
    });

    const refresh = el('button', { class: 'btn btn-ghost', type: 'button' }, icon('rotate-cw'), 'Regenerate');
    refresh.addEventListener('click', () => load());

    body.append(
      el('p', { class: 'muted', style: { fontSize: 'var(--text-sm)' } }, 'Identical ingredients are merged only when units match; everything else is listed as “varies”.'),
      list,
      el('div', { class: 'cluster', style: { justifyContent: 'flex-end' } }, refresh, copyButton),
    );
    refreshIcons();
  }

  async function load() {
    renderLoading();
    try {
      renderList(await generate());
    } catch (err) {
      body.replaceChildren(
        el('div', { class: 'state-block is-error' }, el('h3', { style: { fontSize: '1.05rem' } }, 'Couldn’t build the list'), el('p', {}, 'Some recipes could not be loaded. Try regenerating.')),
      );
    }
  }

  load();
}
