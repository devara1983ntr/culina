/**
 * CULINA — Meal planner (PRD §34–§35): weekly grid, drag & drop with button
 * alternatives, shopping list generation, full local persistence.
 */
import { el, icon } from '../utils/dom.js';
import { refreshIcons } from '../utils/icons.js';
import { applyMeta } from '../seo.js';
import { planner } from '../services/planner.js';
import { generateShoppingList } from '../services/shopping.js';
import { appState } from '../state.js';
import { plannerGrid, initSortable, shoppingListDialog } from '../components/plannerWidgets.js';
import { emptyState, renderInto } from '../components/states.js';
import { pageHeader } from './shared.js';
import { toast } from '../components/toast.js';

export async function render(ctx) {
  applyMeta({
    title: 'Meal Planner',
    description: 'Plan your week: drag recipes between days and meals, duplicate, clear, and generate a merged shopping list. Everything stays on your device.',
    path: '/planner',
  });

  const gridHost = el('div');
  let destroySortable = null;
  let lastVersion = -1;

  const countLabel = el('span', { class: 'muted', style: { fontSize: 'var(--text-sm)' } });

  const root = el(
    'div',
    { class: 'page' },
    el(
      'div',
      { class: 'container-wide' },
      pageHeader({
        overline: 'Local-first · nothing leaves your device',
        title: 'Meal Planner',
        lead: 'Drag dishes between days and meals — or use the remove/duplicate buttons on every item. Planned recipes merge into one shopping list.',
      }),
      el(
        'div',
        { class: 'cluster', style: { justifyContent: 'space-between', marginBottom: 'var(--space-5)' } },
        el('div', { class: 'cluster' }, countLabel,
          el('button', { class: 'btn btn-primary', type: 'button', id: 'shopping-btn' }, icon('shopping-basket'), 'Shopping list'),
          el('button', { class: 'btn btn-ghost', type: 'button', id: 'clear-week' }, icon('trash-2'), 'Clear week'),
        ),
      ),
      gridHost,
    ),
  );

  function renderWeek() {
    const count = planner.itemCount();
    countLabel.textContent = `${count} dish${count === 1 ? '' : 'es'} planned this week`;

    if (count === 0) {
      destroySortable?.();
      destroySortable = null;
      renderInto(
        gridHost,
        emptyState({
          icon: 'calendar-days',
          title: 'Build your week around something delicious',
          message: 'Open any recipe and press “Add to plan”, or add straight from your favorites. Your plan is saved on this device — no account, no cloud.',
          actionLabel: 'Browse recipes',
          href: '/recipes',
        }),
      );
      refreshIcons();
      return;
    }

    destroySortable?.();
    renderInto(gridHost, plannerGrid());
    destroySortable = initSortable(gridHost);
    refreshIcons();
  }

  root.querySelector('#clear-week').addEventListener('click', () => {
    if (planner.itemCount() === 0) return;
    if (window.confirm('Clear the entire week? This removes all planned dishes.')) {
      planner.clearWeek();
      toast('Week cleared', { type: 'info' });
    }
  });

  root.querySelector('#shopping-btn').addEventListener('click', () => {
    shoppingListDialog(async () => generateShoppingList(planner.uniquePlanned(), { signal: ctx.signal }));
  });

  const unsubscribe = appState.subscribe((state) => {
    if (state.plannerVersion !== lastVersion) {
      lastVersion = state.plannerVersion;
      renderWeek();
    }
  });
  ctx.onCleanup(unsubscribe);

  renderWeek();
  refreshIcons();
  return root;
}
