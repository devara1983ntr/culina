/**
 * CULINA — Shopping list (/shopping-list, PRD §20).
 * Merged ingredients from the week’s plan + manual items, with persisted
 * check state, removals, clear-completed and print. Every destructive action
 * has a button alternative; swipe-to-remove is a touch enhancement.
 */
import { el, icon } from '../utils/dom.js';
import { refreshIcons } from '../utils/icons.js';
import { applyMeta } from '../seo.js';
import { planner } from '../services/planner.js';
import { generateShoppingList } from '../services/shopping.js';
import { shoppingList } from '../services/shoppingList.js';
import { appState } from '../state.js';
import { cleanText, validationMessage, INPUT_LIMITS } from '../utils/validate.js';
import { makeSwipeable } from '../utils/touch.js';
import { toast } from '../components/toast.js';
import { pageHeader } from './shared.js';
import { emptyState, renderInto, partialFailureNotice } from '../components/states.js';

export async function render(ctx) {
  applyMeta({
    title: 'Shopping List',
    description: 'Your merged shopping list from planned recipes plus manual items — quantities combined only when units match, checked off as you shop.',
    path: '/shopping-list',
  });

  const listHost = el('div');
  const manualInput = el('input', {
    type: 'text',
    class: 'input',
    id: 'manual-item',
    placeholder: 'Add anything else — e.g. paper towels…',
    maxlength: String(INPUT_LIMITS.shoppingItem),
    autocomplete: 'off',
    'aria-label': 'Add an item manually',
  });
  const manualError = el('p', { class: 'field-error', role: 'alert', hidden: '' });
  const manualForm = el(
    'form',
    {
      class: 'shopping-add-form',
      onsubmit: (event) => {
        event.preventDefault();
        submitManual();
      },
    },
    manualInput,
    el('button', { class: 'btn btn-primary', type: 'submit' }, icon('plus'), 'Add'),
  );

  let merged = { items: [], failed: [] };

  const root = el(
    'div',
    { class: 'page' },
    el(
      'div',
      { class: 'container' },
      pageHeader({
        overline: 'Local-first · saved on this device',
        title: 'Shopping List',
        lead: 'Ingredients from your planned week, merged with care — quantities combine only when units genuinely match. Anything you add by hand lands here too.',
      }),
      el(
        'div',
        { class: 'cluster', style: { justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' } },
        el(
          'div',
          { class: 'cluster' },
          el('button', { class: 'btn btn-secondary', type: 'button', id: 'refresh-list' }, icon('rotate-cw'), 'Refresh from plan'),
          el('button', { class: 'btn btn-ghost', type: 'button', id: 'uncheck-all' }, icon('list-checks'), 'Uncheck all'),
          el('button', { class: 'btn btn-ghost', type: 'button', id: 'print-list' }, icon('printer'), 'Print'),
        ),
      ),
      manualForm,
      manualError,
      listHost,
    ),
  );

  function submitManual() {
    const name = cleanText(manualInput.value, { max: INPUT_LIMITS.shoppingItem });
    const result = shoppingList.addManual(name);
    if (!result.added) {
      manualError.textContent = validationMessage(result.reason, { what: 'item' });
      manualError.removeAttribute('hidden');
      manualInput.setAttribute('aria-invalid', 'true');
      return;
    }
    manualError.setAttribute('hidden', '');
    manualInput.removeAttribute('aria-invalid');
    manualInput.value = '';
    toast(`Added “${name}”`, { type: 'success' });
    renderList();
  }

  function entryRow(entry, { manual = false } = {}) {
    const checked = shoppingList.isChecked(entry);
    const removed = !manual && shoppingList.isRemoved(entry);
    if (removed) return null;

    const checkboxId = `shop-${Math.random().toString(36).slice(2, 9)}`;
    const removeButton = el(
      'button',
      { class: 'icon-btn', type: 'button', 'aria-label': `Remove ${entry.name} from list` },
      icon('x'),
    );
    const row = el(
      'li',
      { class: `shopping-row${checked ? ' is-checked' : ''}` },
      el('input', { type: 'checkbox', id: checkboxId, checked: checked ? '' : null }),
      el(
        'label',
        { for: checkboxId },
        el('span', { class: 'ing-name' }, entry.name),
        el('span', { class: 'ing-qty' }, manual ? 'Added by you' : entry.display),
      ),
      !manual && entry.recipes?.length
        ? el('span', { class: 'shopping-recipes muted', title: entry.recipes.join(', ') }, entry.recipes.length === 1 ? entry.recipes[0] : `${entry.recipes.length} recipes`)
        : null,
      removeButton,
    );

    if (manual) {
      const checkbox = row.querySelector('input');
      checkbox.addEventListener('change', (event) => {
        shoppingList.toggleChecked({ name: entry.name });
        row.classList.toggle('is-checked', event.target.checked);
      });
      removeButton.addEventListener('click', () => {
        shoppingList.removeManual(entry.name);
        renderList();
      });
    } else {
      checkboxId && row.querySelector('input').addEventListener('change', (event) => {
        shoppingList.toggleChecked(entry);
        row.classList.toggle('is-checked', event.target.checked);
      });
      removeButton.addEventListener('click', () => {
        shoppingList.remove(entry);
        toast(`Removed ${entry.name}`, { type: 'info', action: 'Undo', onAction: () => { shoppingList.restore(entry); renderList(); } });
        renderList();
      });
      ctx.onCleanup(makeSwipeable(row, () => {
        shoppingList.remove(entry);
        toast(`Removed ${entry.name}`, { type: 'info', action: 'Undo', onAction: () => { shoppingList.restore(entry); renderList(); } });
        renderList();
      }, { label: 'Remove', threshold: 88 }));
    }
    return row;
  }

  function renderList() {
    const state = shoppingList.state();
    const manualItems = state.manual.map((m) => ({ name: m.name, display: 'Added by you', recipes: [], manual: true }));
    const visibleMerged = merged.items.filter((entry) => !shoppingList.isRemoved(entry));
    const allRows = [...visibleMerged.map((entry) => entryRow(entry)), ...manualItems.map((entry) => entryRow(entry, { manual: true }))].filter(Boolean);

    if (!allRows.length) {
      renderInto(
        listHost,
        emptyState({
          icon: 'shopping-basket',
          title: 'Your shopping list is empty',
          message: planner.itemCount()
            ? 'Your plan has dishes — press “Refresh from plan” to merge their ingredients.'
            : 'Plan a few recipes for the week and their ingredients merge into one list — or add items by hand above.',
          actionLabel: 'Add ingredients from a recipe',
          href: '/planner',
        }),
      );
      refreshIcons();
      return;
    }

    const checkedCount = visibleMerged.filter((e) => shoppingList.isChecked(e)).length;
    renderInto(
      listHost,
      el(
        'div',
        { class: 'results-meta' },
        el('span', { class: 'results-count' }, el('strong', {}, String(allRows.length)), ` item${allRows.length === 1 ? '' : 's'}`, checkedCount ? ` · ${checkedCount} checked` : ''),
        el(
          'button',
          { class: 'btn btn-ghost btn-sm', type: 'button', id: 'clear-completed' },
          icon('trash-2'),
          'Clear checked',
        ),
      ),
      el('ul', { class: 'shopping-list' }, ...allRows),
      merged.failed?.length ? partialFailureNotice(merged.failed.map((title) => ({ provider: 'mealdb', label: title, message: 'recipe lookup failed' }))) : null,
    );
    root.querySelector('#clear-completed')?.addEventListener('click', () => {
      const removedNow = visibleMerged.filter((e) => shoppingList.isChecked(e));
      removedNow.forEach((e) => shoppingList.remove(e));
      if (removedNow.length) toast(`Cleared ${removedNow.length} checked item${removedNow.length === 1 ? '' : 's'}`, { type: 'info' });
      renderList();
    });
    refreshIcons();
  }

  async function refreshFromPlan() {
    const planned = planner.uniquePlanned();
    if (!planned.length) {
      merged = { items: [], failed: [] };
      renderList();
      return;
    }
    renderInto(listHost, el('ul', { class: 'shopping-list', 'aria-busy': 'true' }, el('li', { class: 'shopping-row', style: { opacity: 0.6 } }, el('span', { class: 'skeleton', style: { height: '1rem', width: '70%' } }))));
    try {
      merged = await generateShoppingList(planned, { signal: ctx.signal });
    } catch (err) {
      if (err?.name === 'AbortError') return;
      merged = { items: [], failed: [{ title: 'plan', message: err?.message }] };
    }
    renderList();
  }

  root.querySelector('#refresh-list').addEventListener('click', refreshFromPlan);
  root.querySelector('#uncheck-all').addEventListener('click', () => {
    shoppingList.resetChecks();
    renderList();
  });
  root.querySelector('#print-list').addEventListener('click', () => window.print());

  const unsubscribe = appState.subscribe((state) => {
    if (state.plannerVersion !== undefined && state.plannerVersion !== lastPlannerVersion) {
      lastPlannerVersion = state.plannerVersion;
      refreshFromPlan();
    }
  });
  let lastPlannerVersion = appState.get().plannerVersion;
  ctx.onCleanup(unsubscribe);

  refreshFromPlan();
  refreshIcons();
  return root;
}
