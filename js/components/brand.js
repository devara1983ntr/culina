/**
 * CULINA — Brand components (single source of truth).
 *
 * The approved mark (docs/brand/culina-brand-board.png): the Panel B
 * monogram — a bold C whose top terminal swells chef-hat-like, a fork nested
 * in its aperture, green herb sprigs — traced from the board artwork (IoU
 * 0.97, scripts/brand/trace_monogram.py) and composed onto the cream tile by
 * scripts/generate-brand-assets.py into assets/brand/culina-mark-tile.svg
 * (mirrored to public/brand/ for direct serving),
 * which this module inlines at build time (vite ?raw) — it is never restated
 * in code. The SVG string is our own static asset; it is parsed with
 * DOMParser (XML) and attached via importNode — no HTML injection path.
 *
 *   BrandMark      — the tiled mark (decorative, aria-hidden by default)
 *   BrandIcon      — the tiled mark under the favicon-style class
 *   BrandWordmark  — the CULINA wordmark text (display font via .brand-word)
 *   BrandLogo      — mark + wordmark lockup (optionally as a home link)
 */
import { el } from '../utils/dom.js';
import { APP } from '../constants.js';
import markTileRaw from './mark-tile.js';

/* Parse the canonical tile lazily (browser only) and clone per instance. */
let template = null;
let instanceSeq = 0;

function getTemplate() {
  if (template) return template;
  if (typeof DOMParser === 'undefined') {
    throw new Error('[brand] the mark can only be rendered in a browser environment');
  }
  const parsed = new DOMParser().parseFromString(markTileRaw, 'image/svg+xml');
  const root = parsed.documentElement;
  if (!root || root.nodeName.toLowerCase() !== 'svg') {
    throw new Error('[brand] mark-tile.js does not contain a valid SVG document');
  }
  template = root;
  return template;
}

function cloneMark({ size = 24, className = 'brand-mark', title = null } = {}) {
  const svg = document.importNode(getTemplate(), true);
  instanceSeq += 1;
  // Gradient ids must be unique per instance (header + footer render in the
  // same document) — rewrite id="cg"/"fg" and their url(#…) references.
  const uid = `b${instanceSeq}`;
  for (const node of svg.querySelectorAll('[id]')) {
    const oldId = node.id;
    const newId = `${oldId}-${uid}`;
    node.id = newId;
    for (const ref of svg.querySelectorAll(`[fill="url(#${oldId})"], [stroke="url(#${oldId})"]`)) {
      const attr = (ref.getAttribute('fill') || '').startsWith('url(') ? 'fill' : 'stroke';
      ref.setAttribute(attr, `url(#${newId})`);
    }
  }
  svg.setAttribute('class', className);
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.removeAttribute('aria-label');
  if (title) {
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', title);
  } else {
    svg.setAttribute('aria-hidden', 'true');
    svg.removeAttribute('role');
  }
  svg.setAttribute('focusable', 'false');
  return svg;
}

/** The tiled brand mark. */
export function BrandMark({ size = 24, className = 'brand-mark', title = null } = {}) {
  return cloneMark({ size, className, title });
}

/** The tiled mark under the favicon-style class (larger standalone uses). */
export function BrandIcon({ size = 56, className = 'brand-icon', title = `${APP.name} logo` } = {}) {
  return cloneMark({ size, className, title });
}

/** The wordmark — display serif via the .brand-word class. */
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
    cloneMark({ size: markSize, className: 'brand-mark' }),
    BrandWordmark(),
  );
  if (compact) inner.classList.add('is-compact');
  if (!href) return inner;
  return el('a', { class: 'brand', href, 'aria-label': ariaLabel }, inner);
}
