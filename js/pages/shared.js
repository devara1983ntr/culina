/**
 * CULINA — shared page helpers.
 */
import { el, icon } from '../utils/dom.js';
import { refreshIcons } from '../utils/icons.js';
import { revealGrid } from '../utils/motion.js';

/** Standard page header: overline + display title + lead + action row. */
export function pageHeader({ overline, title, lead, actions }) {
  return el(
    'header',
    { class: 'page-header' },
    overline ? el('p', { class: 'overline' }, icon('sparkles'), overline) : null,
    el('h1', {}, title),
    lead ? el('p', { class: 'lead' }, lead) : null,
    actions ? el('div', { class: 'cluster', style: { marginTop: 'var(--space-2)' } }, actions) : null,
  );
}

/** Standard section wrapper with head. */
export function section({ id, head, children, class: className = 'section' }) {
  const sectionEl = el('section', { class: className, id });
  const container = el('div', { class: 'container' });
  if (head) container.append(head);
  for (const child of children) if (child) container.append(child);
  sectionEl.append(container);
  return sectionEl;
}

export function sectionHead(title, { ctaLabel, ctaHref, ctaIcon, sub } = {}) {
  return el(
    'div',
    { class: 'section-head' },
    el(
      'div',
      {},
      el('h2', {}, title),
      sub ? el('p', { class: 'muted', style: { fontSize: 'var(--text-sm)', marginTop: 'var(--space-1)' } }, sub) : null,
    ),
    ctaLabel && ctaHref
      ? el('a', { class: 'section-cta', href: ctaHref }, ctaLabel, ctaIcon ? icon(ctaIcon) : icon('arrow-right'))
      : null,
  );
}

export function refresh() {
  refreshIcons();
}

/**
 * Wire card-reveal motion after the view is in the DOM.
 * Observers registered on detached nodes are unreliable, so defer one frame.
 */
export function mountReveal(ctx, ...grids) {
  requestAnimationFrame(() => {
    for (const grid of grids) {
      if (grid) ctx.onCleanup(revealGrid(grid));
    }
  });
}

/**
 * Legal / policy / statement pages (privacy, terms, accessibility).
 * `sections`: [{ title?, body: string[] , list?: string[] }]
 */
export function docPage({ overline, title, lead, updated, sections }) {
  const root = el('div', { class: 'page' });
  const container = el(
    'div',
    { class: 'container doc-page' },
    pageHeader({ overline, title, lead, actions: updated ? el('span', { class: 'muted', style: { fontSize: 'var(--text-sm)' } }, `Last updated ${updated}`) : null }),
  );
  for (const section of sections) {
    const block = el('section', { class: 'doc-section' });
    if (section.title) block.append(el('h2', {}, section.title));
    for (const para of section.body || []) block.append(el('p', {}, para));
    if (section.list) {
      block.append(
        el(
          'ul',
          { class: 'plain-list' },
          ...section.list.map((item) => el('li', {}, icon('check'), el('span', {}, item))),
        ),
      );
    }
    container.append(block);
  }
  refreshIcons();
  root.append(container);
  return root;
}
