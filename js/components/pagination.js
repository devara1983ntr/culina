/**
 * CULINA — Load-more & numbered pagination.
 */
import { el, icon } from '../utils/dom.js';

export function loadMoreButton({ loading = false, hasMore = true, label = 'Load more', onClick, hint }) {
  const button = el(
    'button',
    { class: 'btn btn-secondary', type: 'button', disabled: hasMore && !loading ? null : '' },
    loading ? el('span', { class: 'spinner', 'aria-hidden': 'true' }) : icon('chevron-down'),
    loading ? 'Loading…' : label,
  );
  button.addEventListener('click', () => {
    if (!loading && hasMore) onClick();
  });
  const wrap = el(
    'div',
    { class: 'load-more-wrap' },
    button,
    hint || (!hasMore ? el('span', { class: 'load-more-hint' }, 'That’s everything') : null),
  );
  return wrap;
}

/** Windowed numbered pagination (1 … 4 5 6 … 12). */
export function pagination({ page, totalPages, onPage, ariaLabel = 'Pagination' }) {
  if (totalPages <= 1) return el('span');
  const windowSize = 2;
  const pages = new Set([1, totalPages, page]);
  for (let i = 1; i <= windowSize; i++) {
    if (page - i >= 1) pages.add(page - i);
    if (page + i <= totalPages) pages.add(page + i);
  }
  const ordered = [...pages].sort((a, b) => a - b);

  const nav = el('nav', { class: 'pagination', 'aria-label': ariaLabel });
  const prev = el(
    'button',
    { type: 'button', disabled: page <= 1 ? '' : null, 'aria-label': 'Previous page' },
    icon('chevron-left'),
  );
  prev.addEventListener('click', () => onPage(page - 1));
  nav.append(prev);

  let last = 0;
  for (const p of ordered) {
    if (p - last > 1) nav.append(el('span', { class: 'gap', 'aria-hidden': 'true' }, '…'));
    const button = el(
      'button',
      {
        type: 'button',
        'aria-current': p === page ? 'page' : null,
        'aria-label': `Page ${p}`,
      },
      String(p),
    );
    button.addEventListener('click', () => onPage(p));
    nav.append(button);
    last = p;
  }

  const next = el(
    'button',
    { type: 'button', disabled: page >= totalPages ? '' : null, 'aria-label': 'Next page' },
    icon('chevron-right'),
  );
  next.addEventListener('click', () => onPage(page + 1));
  nav.append(next);
  return nav;
}
