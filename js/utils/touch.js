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
