/**
 * CULINA — Touch interaction helpers (PRD §7).
 * Every gesture is an enhancement only: each swipeable element must carry a
 * visible button that performs the same action (a11y rule).
 */
import { el } from './dom.js';

/**
 * Make an element swipe-to-dismiss horizontally.
 * - Reveals a destructive background while dragging.
 * - Past `threshold` px (default 96) calls `onDismiss` on release.
 * - No-ops on non-touch pointers; respects reduced motion by keeping the
 *   reveal minimal (the action itself still works — motion is decorative).
 *
 * Returns a cleanup function.
 */
export function makeSwipeable(item, onDismiss, { threshold = 96, label = 'Remove' } = {}) {
  if (!('ontouchstart' in window) && !navigator.maxTouchPoints) return () => {};

  const wrap = el('div', { class: 'swipe-item' });
  const backdrop = el(
    'div',
    { class: 'swipe-backdrop', 'aria-hidden': 'true' },
    el('span', { class: 'swipe-backdrop-inner' }, label === 'Remove' ? '✕' : label),
  );

  const parent = item.parentNode;
  if (!parent) return () => {};
  parent.insertBefore(wrap, item);
  wrap.append(backdrop, item);

  let startX = 0;
  let startY = 0;
  let deltaX = 0;
  let dragging = false;
  let horizontal = null; // null until the gesture direction is decided

  const setX = (px) => {
    deltaX = px;
    item.style.transform = px ? `translateX(${px}px)` : '';
    item.style.transition = px ? 'none' : '';
    wrap.classList.toggle('is-swiping', Math.abs(px) > 4);
    wrap.classList.toggle('is-armed', px <= -threshold);
  };

  const onTouchStart = (event) => {
    if (event.touches.length !== 1) return;
    dragging = true;
    horizontal = null;
    startX = event.touches[0].clientX;
    startY = event.touches[0].clientY;
  };

  const onTouchMove = (event) => {
    if (!dragging) return;
    const dx = event.touches[0].clientX - startX;
    const dy = event.touches[0].clientY - startY;
    if (horizontal === null) {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      horizontal = Math.abs(dx) > Math.abs(dy);
      if (horizontal) event.preventDefault?.();
    }
    if (!horizontal) return;
    // Leftward only; rubber-band to the right.
    setX(Math.min(0, dx));
  };

  const onTouchEnd = () => {
    if (!dragging) return;
    dragging = false;
    if (deltaX <= -threshold) {
      item.style.transition = 'transform 180ms ease';
      item.style.transform = 'translateX(-110%)';
      setTimeout(() => onDismiss(), 140);
    } else {
      setX(0);
    }
  };

  item.addEventListener('touchstart', onTouchStart, { passive: true });
  item.addEventListener('touchmove', onTouchMove, { passive: false });
  item.addEventListener('touchend', onTouchEnd);
  item.addEventListener('touchcancel', onTouchEnd);

  return () => {
    item.removeEventListener('touchstart', onTouchStart);
    item.removeEventListener('touchmove', onTouchMove);
    item.removeEventListener('touchend', onTouchEnd);
    item.removeEventListener('touchcancel', onTouchEnd);
    if (wrap.parentNode) {
      wrap.replaceWith(item);
      item.style.transform = '';
      item.style.transition = '';
    }
  };
}

/**
 * Horizontal swipe-to-switch-tabs on a content host.
 * - Direction-locked: vertical scrolling is never hijacked (no
 *   preventDefault — the browser keeps native scroll behaviour).
 * - A swipe starting inside a `.swipe-item` (row-level swipe gestures) or a
 *   dialog is ignored so the two gesture layers never fight.
 * - Past `threshold` px of horizontal travel with dominant-x movement,
 *   onSelect receives the previous/next id (clamped at the ends).
 *
 * Returns a cleanup function.
 */
export function attachTabSwipe(container, { ids, getActive, onSelect, threshold = 70 } = {}) {
  if (!container) return () => {};
  if (!('ontouchstart' in window) && !navigator.maxTouchPoints) return () => {};
  if (!Array.isArray(ids) || ids.length < 2) return () => {};

  let startX = 0;
  let startY = 0;
  let tracking = false;

  const onTouchStart = (event) => {
    if (event.touches.length !== 1) return;
    const target = event.target;
    if (target instanceof Element && target.closest('dialog[open], .swipe-item, .ptr-indicator')) return;
    tracking = true;
    startX = event.touches[0].clientX;
    startY = event.touches[0].clientY;
  };

  const onTouchEnd = (event) => {
    if (!tracking) return;
    tracking = false;
    const touch = event.changedTouches?.[0];
    if (!touch) return;
    const dx = touch.clientX - startX;
    const dy = touch.clientY - startY;
    if (Math.abs(dx) < threshold || Math.abs(dx) < Math.abs(dy) * 1.4) return;
    const index = ids.indexOf(getActive());
    if (index < 0) return;
    const next = dx < 0 ? index + 1 : index - 1; // swipe left → next tab
    if (next < 0 || next >= ids.length) return;
    if (navigator.vibrate) navigator.vibrate(8);
    onSelect(ids[next]);
  };

  container.addEventListener('touchstart', onTouchStart, { passive: true });
  container.addEventListener('touchend', onTouchEnd, { passive: true });
  container.addEventListener('touchcancel', () => { tracking = false; }, { passive: true });

  return () => {
    container.removeEventListener('touchstart', onTouchStart);
    container.removeEventListener('touchend', onTouchEnd);
  };
}
