/**
 * CULINA — Pull-to-refresh (touch enhancement, mobile only).
 *
 * Rules (UI/UX Pro Max gesture guidance):
 * - Engages ONLY at scroll top, with a single touch, outside dialogs and
 *   form controls — vertical scrolling is never hijacked before the pull
 *   direction is established.
 * - Visible indicator with a resistance curve; armed state past threshold;
 * - While pulling, touchmove is prevented so the browser's native
 *   pull-to-refresh cannot double-fire.
 * - Enhancement only: keyboard/desktop users refresh through normal
 *   navigation; nothing is lost when this never triggers.
 *
 * Returns a cleanup function (safe to call multiple times).
 */
export function attachPullToRefresh(onRefresh, { threshold = 68, maxPull = 112 } = {}) {
  if (typeof window === 'undefined') return () => {};
  const coarse = window.matchMedia?.('(pointer: coarse)');
  if (!coarse || !coarse.matches) return () => {};
  if (!('ontouchstart' in window) && !navigator.maxTouchPoints) return () => {};

  const indicator = document.createElement('div');
  indicator.className = 'ptr-indicator';
  indicator.setAttribute('aria-hidden', 'true');
  indicator.innerHTML = '<span class="ptr-ring"></span>';
  document.body.append(indicator);

  let startY = 0;
  let pulling = false;
  let established = false;
  let pull = 0;
  let refreshing = false;

  const setPull = (px) => {
    pull = px;
    indicator.style.transform = `translate(-50%, ${px}px) scale(${0.6 + Math.min(0.4, px / (threshold * 2.5))})`;
    indicator.classList.toggle('is-armed', px >= threshold);
  };

  const reset = () => {
    pulling = false;
    established = false;
    setPull(0);
    indicator.classList.remove('is-refreshing');
  };

  const onTouchStart = (event) => {
    if (refreshing || event.touches.length !== 1) return;
    if (window.scrollY > 0) return;
    const target = event.target;
    if (target instanceof Element && target.closest('dialog[open], input, textarea, select, button, .swipe-item')) return;
    pulling = true;
    established = false;
    startY = event.touches[0].clientY;
  };

  const onTouchMove = (event) => {
    if (!pulling || refreshing) return;
    const dy = event.touches[0].clientY - startY;
    if (!established) {
      // Direction lock: only claim the gesture once it is clearly a downward
      // pull from scroll top; otherwise stay out of the browser's way.
      if (dy < 10) return;
      if (window.scrollY > 0) {
        pulling = false;
        return;
      }
      established = true;
    }
    if (dy <= 0) {
      setPull(0);
      return;
    }
    event.preventDefault?.();
    setPull(Math.min(maxPull, dy * 0.45)); // resistance curve
  };

  const onTouchEnd = async () => {
    if (!pulling || refreshing) return;
    const shouldRefresh = established && pull >= threshold;
    pulling = false;
    established = false;
    if (!shouldRefresh) {
      reset();
      return;
    }
    refreshing = true;
    indicator.classList.add('is-refreshing');
    setPull(threshold * 0.55);
    if (navigator.vibrate) navigator.vibrate(12);
    try {
      await onRefresh();
    } catch (err) {
      console.warn('[ptr] refresh failed', err);
    } finally {
      refreshing = false;
      reset();
    }
  };

  document.addEventListener('touchstart', onTouchStart, { passive: true });
  document.addEventListener('touchmove', onTouchMove, { passive: false });
  document.addEventListener('touchend', onTouchEnd);
  document.addEventListener('touchcancel', () => reset());

  return () => {
    document.removeEventListener('touchstart', onTouchStart);
    document.removeEventListener('touchmove', onTouchMove);
    document.removeEventListener('touchend', onTouchEnd);
    indicator.remove();
  };
}
