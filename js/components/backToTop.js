/**
 * CULINA — Back-to-top control.
 * Appears after 600 px of scroll, sits above the mobile bottom nav,
 * smooth-scrolls (instant under prefers-reduced-motion). Singleton.
 */
import { el, icon } from '../utils/dom.js';
import { refreshIcons } from '../utils/icons.js';
import { prefersReducedMotion } from '../utils/motion.js';

export function initBackToTop() {
  if (document.querySelector('.back-to-top')) return;

  const button = el(
    'button',
    { class: 'back-to-top', type: 'button', 'aria-label': 'Back to top', tabindex: '-1' },
    icon('arrow-up'),
  );
  button.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  });
  document.body.append(button);
  refreshIcons();

  let ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const show = window.scrollY > 600;
      button.classList.toggle('is-visible', show);
      button.tabIndex = show ? 0 : -1;
      ticking = false;
    });
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}
