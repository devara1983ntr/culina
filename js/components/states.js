/**
 * CULINA — Loading / empty / error / partial-failure states (PRD §44).
 * Every async surface renders one of these — no blank areas, ever.
 */
import { el, icon, clearNode } from '../utils/dom.js';
import { refreshIcons } from '../utils/icons.js';
import { userMessage } from '../api/errors.js';
import { providerLabel } from '../api/registry.js';

/* --- Skeletons --------------------------------------------------------- */

export function skeletonCard() {
  return el(
    'div',
    { class: 'skeleton-card', 'aria-hidden': 'true' },
    el('div', { class: 'skeleton skeleton-media' }),
    el(
      'div',
      { class: 'skeleton-body' },
      el('div', { class: 'skeleton', style: { height: '1.1rem', width: '72%' } }),
      el('div', { class: 'skeleton', style: { height: '0.8rem', width: '46%' } }),
      el('div', { class: 'skeleton', style: { height: '0.8rem', width: '58%' } }),
    ),
  );
}

export function skeletonGrid(count = 8, { wide = false } = {}) {
  return el(
    'div',
    { class: `grid-cards${wide ? ' wide' : ''}`, role: 'status', 'aria-label': 'Loading results' },
    ...Array.from({ length: count }, skeletonCard),
  );
}

export function skeletonRows(count = 4) {
  return el(
    'div',
    { class: 'stack-3', role: 'status', 'aria-label': 'Loading' },
    ...Array.from({ length: count }, (_, i) =>
      el(
        'div',
        { class: 'skeleton', style: { height: '1rem', width: `${88 - i * 12}%` } },
      ),
    ),
  );
}

export function skeletonDetail() {
  return el(
    'div',
    { class: 'detail-hero', role: 'status', 'aria-label': 'Loading details' },
    el(
      'div',
      { class: 'detail-hero-grid' },
      el('div', { class: 'skeleton', style: { aspectRatio: '4 / 3.4', borderRadius: 'var(--radius-lg)' } }),
      el(
        'div',
        { class: 'stack-5', style: { paddingTop: 'var(--space-5)' } },
        el('div', { class: 'skeleton', style: { height: '0.9rem', width: '30%' } }),
        el('div', { class: 'skeleton', style: { height: '2.6rem', width: '82%' } }),
        el('div', { class: 'skeleton', style: { height: '2.6rem', width: '64%' } }),
        el('div', { class: 'skeleton', style: { height: '1rem', width: '50%' } }),
        el('div', { class: 'skeleton', style: { height: '44px', width: '220px', borderRadius: 'var(--radius-sm)' } }),
      ),
    ),
  );
}

export function loadingBlock(label = 'Loading…') {
  return el(
    'div',
    { class: 'state-block is-info', role: 'status' },
    el('span', { class: 'spinner spinner-lg', 'aria-hidden': 'true' }),
    el('p', {}, label),
  );
}

/* --- Empty -------------------------------------------------------------- */

export function emptyState({ icon: iconName = 'search', title, message, actionLabel, onAction, href }) {
  const block = el(
    'div',
    { class: 'state-block' },
    el('span', { class: 'state-icon' }, icon(iconName)),
    el('h2', {}, title),
    message ? el('p', {}, message) : null,
  );
  if (actionLabel && href) {
    block.append(el('a', { class: 'btn btn-primary btn-sm', href }, actionLabel));
  } else if (actionLabel && onAction) {
    block.append(
      el('button', { class: 'btn btn-primary btn-sm', type: 'button', onclick: () => onAction() }, actionLabel),
    );
  }
  refreshIcons();
  return block;
}

/* --- Error --------------------------------------------------------------- */

export function errorState({ error, onRetry, retryLabel = 'Try again' }) {
  const provider = error?.provider ? ` · ${providerLabel(error.provider)}` : '';
  const block = el(
    'div',
    { class: 'state-block is-error', role: 'alert' },
    el('span', { class: 'state-icon' }, icon('alert-triangle')),
    el('h2', {}, 'We hit a snag'),
    el('p', {}, `${userMessage(error)}${provider}`),
  );
  if (onRetry) {
    block.append(
      el('button', { class: 'btn btn-secondary btn-sm', type: 'button', onclick: () => onRetry() }, icon('rotate-cw'), retryLabel),
    );
  }
  refreshIcons();
  return block;
}

/* --- Partial failure notice (PRD §39: graceful degradation) --------------- */

export function partialFailureNotice(failures, { context = '' } = {}) {
  if (!failures || !failures.length) return null;
  const names = failures.map((f) => f.label || providerLabel(f.provider)).join(', ');
  const el_ = el(
    'div',
    { class: 'notice is-warning', role: 'status' },
    icon('alert-triangle'),
    el(
      'div',
      {},
      el('strong', {}, `${names} ${failures.length === 1 ? 'is' : 'are'} temporarily unavailable`),
      el(
        'p',
        { class: 'muted', style: { marginTop: '2px' } },
        `${context ? context + ' ' : ''}Other sources loaded normally — everything shown below is live data.`,
      ),
    ),
  );
  refreshIcons();
  return el_;
}

/* --- Helpers -------------------------------------------------------------- */

export function renderInto(target, ...children) {
  clearNode(target);
  for (const child of children) if (child) target.append(child);
  return target;
}
