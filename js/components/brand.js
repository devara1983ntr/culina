/**
 * CULINA — Brand components (single source of truth, PRD §1).
 *
 * The approved mark: an open ring (the plate) in ember with a cream garnish
 * dot seated in the opening — espresso-inspired, flat, no gradients.
 * Geometry is FIXED (viewBox 0 0 32 32, arc r=12 stroke 3, dot r=2.4 at
 * (28,16)) and must not be restated anywhere else in the app.
 *
 *   BrandMark      — the bare mark (decorative, aria-hidden by default)
 *   BrandIcon      — mark on the espresso rounded square (favicon-style tile)
 *   BrandWordmark  — the CULINA wordmark text
 *   BrandLogo      — mark + wordmark (optionally as a home link)
 */
import { el } from '../utils/dom.js';
import { APP } from '../constants.js';

/** The one true mark. Returns an SVG element. */
export function BrandMark({ size = 24, className = 'brand-mark', title = null } = {}) {
  const svg = el('svg', {
    class: className,
    viewBox: '0 0 32 32',
    fill: 'none',
    width: String(size),
    height: String(size),
    'aria-hidden': title ? null : 'true',
    role: title ? 'img' : null,
    focusable: 'false',
  });
  if (title) {
    const label = el('title', {}, title);
    svg.append(label);
  }
  svg.append(
    el('path', {
      d: 'M22.9 6.2 A12 12 0 1 0 22.9 25.8',
      stroke: 'currentColor',
      'stroke-width': '3',
      'stroke-linecap': 'round',
    }),
    el('circle', { cx: '28', cy: '16', r: '2.4', fill: 'currentColor' }),
  );
  return svg;
}

/** Mark on the espresso rounded square (favicon / PWA style). */
export function BrandIcon({ size = 32, radius = 7, className = 'brand-icon', title = `${APP.name} logo` } = {}) {
  const svg = el('svg', {
    class: className,
    viewBox: '0 0 32 32',
    width: String(size),
    height: String(size),
    role: 'img',
    'aria-label': title,
    focusable: 'false',
  });
  svg.append(el('rect', { x: '0', y: '0', width: '32', height: '32', rx: String(radius), fill: '#181109' }));
  const inner = BrandMark({ size: 0, className: 'brand-icon-mark' });
  inner.removeAttribute('width');
  inner.removeAttribute('height');
  inner.setAttribute('transform', 'translate(2.6 2.6) scale(0.84)');
  inner.setAttribute('color', '#F0743C');
  // The garnish dot stays cream on the tile.
  inner.querySelector('circle')?.setAttribute('fill', '#F6EFE6');
  svg.append(inner);
  return svg;
}

/** The wordmark — always Libre Bodoni via the .brand-word class. */
export function BrandWordmark({ className = 'brand-word', text = APP.name } = {}) {
  return el('span', { class: className }, text);
}

/**
 * Full lockup: mark + wordmark. Pass `href` to render as a home link
 * (the header/footer default), or omit for a plain block.
 */
export function BrandLogo({ href = '/', compact = false, ariaLabel = `${APP.name} — home`, markSize = 26 } = {}) {
  const inner = el(
    'span',
    { class: 'brand-lockup' },
    BrandMark({ size: markSize, className: 'brand-mark' }),
    BrandWordmark(),
  );
  if (compact) inner.classList.add('is-compact');
  if (!href) return inner;
  return el('a', { class: 'brand', href, 'aria-label': ariaLabel }, inner);
}
