/**
 * CULINA — Motion layer
 * Thin, intentioned wrapper around the `motion` library (Framer Motion's
 * vanilla-JS engine). Every animation in the product goes through here so that
 * timing, easing and the prefers-reduced-motion contract stay centralized
 * (PRD §8, §59; UI/UX Pro Max skill: exit faster than enter, shared tokens).
 */
import { animate, inView, stagger } from 'motion';

const reducedQuery =
  typeof window !== 'undefined' && window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)')
    : null;

export const prefersReducedMotion = () => Boolean(reducedQuery && reducedQuery.matches);

const EASE_OUT = [0.22, 1, 0.36, 1];

/** Route/page entrance — soft rise, never bouncy. */
export function pageEnter(node) {
  if (!node || prefersReducedMotion()) return;
  animate(node, { opacity: [0, 1], y: [10, 0] }, { duration: 0.32, ease: EASE_OUT });
}

/**
 * Card-grid reveal. Elements carrying `.reveal` fade up as they enter the
 * viewport. Returns a cleanup that disconnects the observers.
 */
export function revealGrid(container, selector = '.reveal') {
  if (!container) return () => {};
  const cards = [...container.querySelectorAll(selector)];
  if (!cards.length) return () => {};

  if (prefersReducedMotion()) {
    cards.forEach((c) => c.style.removeProperty('opacity'));
    return () => {};
  }

  const stops = cards.map((card, i) =>
    inView(
      card,
      () => {
        animate(
          card,
          { opacity: [0, 1], y: [16, 0] },
          { duration: 0.42, delay: Math.min(i * 0.04, 0.28), ease: EASE_OUT },
        );
      },
      { amount: 0.12 },
    ),
  );

  return () => stops.forEach((stop) => stop());
}

/** Favorite pop — the one playful moment in the product. */
export function pop(node) {
  if (!node || prefersReducedMotion()) return;
  animate(node, { scale: [1, 1.4, 0.92, 1] }, { duration: 0.46, ease: 'easeOut' });
}

/** Confirmation pulse for check-markable rows. */
export function pulse(node) {
  if (!node || prefersReducedMotion()) return;
  animate(node, { opacity: [1, 0.45, 1] }, { duration: 0.3, ease: 'easeOut' });
}

/** Modal / overlay entrance. */
export function dialogEnter(node) {
  if (!node || prefersReducedMotion()) return;
  animate(node, { opacity: [0, 1], scale: [0.965, 1], y: [10, 0] }, { duration: 0.26, ease: EASE_OUT });
}

/** Drawer (mobile nav) entrance from the right. */
export function drawerEnter(node) {
  if (!node || prefersReducedMotion()) return;
  animate(node, { x: ['100%', '0%'] }, { duration: 0.32, ease: EASE_OUT });
}

/** Toast entrance. */
export function toastEnter(node) {
  if (!node || prefersReducedMotion()) return;
  animate(node, { opacity: [0, 1], y: [14, 0] }, { duration: 0.3, ease: EASE_OUT });
}

/** Staggered entrance for grouped children (e.g. detail page sections). */
export function staggerIn(nodes, { each = 0.06, distance = 14 } = {}) {
  const list = [...nodes].filter(Boolean);
  if (!list.length || prefersReducedMotion()) return;
  animate(
    list,
    { opacity: [0, 1], y: [distance, 0] },
    { duration: 0.4, delay: stagger(each), ease: EASE_OUT },
  );
}
