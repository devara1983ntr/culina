/**
 * CULINA — Filter & input components (semantic, keyboard-native controls).
 */
import { el, icon } from '../utils/dom.js';

/** Single-select chip row. */
export function chipRow({ items, value, onSelect, scrollable = false, ariaLabel = 'Filters' }) {
  const row = el('div', { class: `chip-row${scrollable ? ' is-scrollable' : ''}`, role: 'group', 'aria-label': ariaLabel });
  for (const item of items) {
    row.append(
      el(
        'button',
        {
          class: 'chip',
          type: 'button',
          'aria-pressed': String(item.id === value),
          onclick: () => onSelect(item.id),
        },
        item.icon ? icon(item.icon) : null,
        item.label,
        item.count !== undefined && item.count !== null ? el('span', { class: 'numeric muted' }, item.count) : null,
      ),
    );
  }
  return row;
}

/** Labeled native select. */
export function selectField({ id, label, options, value, onChange, hideLabel = false }) {
  const select = el(
    'select',
    { class: 'select', id, onchange: (e) => onChange(e.target.value) },
    ...options.map((opt) =>
      el('option', { value: opt.value, selected: opt.value === value ? '' : null }, opt.label),
    ),
  );
  const labelEl = el('label', { class: hideLabel ? 'visually-hidden' : 'filter-label', for: id }, label);
  return el('div', { class: 'filter-group' }, labelEl, select);
}

/** Grid / list view toggle. */
export function viewToggle({ value = 'grid', onChange }) {
  const buttons = [
    { id: 'grid', iconName: 'layout-grid', label: 'Grid view' },
    { id: 'list', iconName: 'list', label: 'List view' },
  ].map((view) =>
    el(
      'button',
      {
        class: 'view-toggle-btn',
        type: 'button',
        'aria-pressed': String(view.id === value),
        'aria-label': view.label,
        onclick: () => onChange(view.id),
      },
      icon(view.iconName),
    ),
  );
  return el('div', { class: 'view-toggle', role: 'group', 'aria-label': 'View' }, ...buttons);
}

/** Search input with leading icon + clear button. */
export function searchField({ id, placeholder = 'Search…', value = '', onInput, onSubmit, submitLabel = 'Search', autoFocus = false }) {
  const input = el('input', {
    type: 'search',
    class: 'input',
    id,
    placeholder,
    value,
    autofocus: autoFocus ? '' : null,
    'aria-label': placeholder,
    autocomplete: 'off',
  });
  const clearBtn = el('button', { class: 'input-clear', type: 'button', 'aria-label': 'Clear search', hidden: value ? null : '' }, icon('x'));

  const updateClear = () => {
    if (input.value) clearBtn.removeAttribute('hidden');
    else clearBtn.setAttribute('hidden', '');
  };
  input.addEventListener('input', () => {
    updateClear();
    onInput?.(input.value);
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && onSubmit) onSubmit(input.value);
  });
  clearBtn.addEventListener('click', () => {
    input.value = '';
    updateClear();
    onInput?.('');
    input.focus();
  });

  /* Structural layout: CSS grid columns [lead icon | input | trail].
     The icon owns its column (it can never overlap text), the input owns a
     minmax(0,1fr) column (it can never push the field wider than its parent),
     and the trail owns the trailing column for clear/voice/submit actions —
     every control keeps its own non-overlapping layout area. */
  const trail = el('div', { class: 'search-trail' }, clearBtn);
  const children = [icon('search', 'lead-icon'), input, trail];
  const wrap = el('div', { class: 'search-input-wrap' }, ...children);
  if (onSubmit) {
    wrap.classList.add('has-actions');
    wrap.append(
      el(
        'button',
        { class: 'btn btn-primary search-submit', type: 'button', onclick: () => onSubmit(input.value) },
        submitLabel,
      ),
    );
  }
  return { element: wrap, input, trail };
}

/** Boolean filter rendered as a switch. */
export function switchField({ id, label, checked = false, onChange }) {
  const checkbox = el('input', { type: 'checkbox', id, role: 'switch', checked: checked ? '' : null });
  checkbox.addEventListener('change', () => onChange(checkbox.checked));
  return el(
    'div',
    { class: 'filter-group switch-field' },
    el('label', { class: 'switch', for: id }, checkbox, el('span', { class: 'switch-track', 'aria-hidden': 'true' })),
    el('label', { class: 'filter-label', for: id, style: { marginBottom: 0 } }, label),
  );
}
