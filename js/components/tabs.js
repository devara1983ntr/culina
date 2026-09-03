/**
 * CULINA — Accessible tabs (WAI-ARIA authoring pattern:
 * roving tabindex, arrow keys, Home/End).
 */
import { el } from '../utils/dom.js';

export function renderTabs({ tabs, active, onSelect, ariaLabel = 'Sections' }) {
  const tablist = el('div', { class: 'tabs', role: 'tablist', 'aria-label': ariaLabel });

  const buttons = tabs.map((tab) =>
    el(
      'button',
      {
        class: 'tab',
        role: 'tab',
        type: 'button',
        id: `tab-${tab.id}`,
        'aria-selected': String(tab.id === active),
        tabindex: tab.id === active ? 0 : -1,
        onclick: () => onSelect(tab.id),
      },
      tab.label,
      tab.count !== undefined && tab.count !== null ? el('span', { class: 'count' }, tab.count) : null,
    ),
  );

  buttons.forEach((button, index) => {
    button.addEventListener('keydown', (event) => {
      let target = null;
      if (event.key === 'ArrowRight') target = buttons[(index + 1) % buttons.length];
      else if (event.key === 'ArrowLeft') target = buttons[(index - 1 + buttons.length) % buttons.length];
      else if (event.key === 'Home') target = buttons[0];
      else if (event.key === 'End') target = buttons[buttons.length - 1];
      if (target) {
        event.preventDefault();
        buttons.forEach((b) => (b.tabIndex = -1));
        target.tabIndex = 0;
        target.focus();
        target.click();
      }
    });
  });

  tablist.append(...buttons);
  return tablist;
}
