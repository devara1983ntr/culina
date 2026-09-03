/**
 * CULINA — Footer: product info, data-source attribution, provider info,
 * legal/disclaimer, project information (PRD §10).
 */
import { el } from '../utils/dom.js';
import { APP } from '../constants.js';
import { BrandLogo } from './brand.js';
import { snapshot } from '../api/health.js';
import { safeUrl } from '../utils/format.js';

export function renderFooter() {
  const footer = document.getElementById('site-footer');
  if (!footer) return;

  const enabled = snapshot().filter((p) => p.enabled);

  footer.replaceChildren(
    el(
      'div',
      { class: 'footer-inner' },
      el(
        'div',
        { class: 'footer-brand' },
        BrandLogo({ href: '/', markSize: 22 }),
        el('p', {}, APP.supportingCopy + '. One search across verified food data sources — everything you save stays on your device.'),
      ),
      el(
        'div',
        { class: 'footer-col' },
        el('h2', {}, 'Explore'),
        el(
          'ul',
          {},
          ...[
            ['Discover', '/discover'],
            ['Recipes', '/recipes'],
            ['Ingredients', '/ingredients'],
            ['Drinks', '/drinks'],
            ['Meal planner', '/planner'],
            ['Kitchen match', '/kitchen'],
          ].map(([label, href]) => el('li', {}, el('a', { href }, label))),
        ),
      ),
      el(
        'div',
        { class: 'footer-col' },
        el('h2', {}, 'Product'),
        el(
          'ul',
          {},
          ...[
            ['Favorites', '/favorites'],
            ['Nutrition', '/nutrition'],
            ['Food products', '/products'],
            ['API health', '/health'],
            ['About & privacy', '/about'],
          ].map(([label, href]) => el('li', {}, el('a', { href }, label))),
        ),
      ),
      el(
        'div',
        { class: 'footer-col' },
        el('h2', {}, 'Data sources'),
        el(
          'ul',
          {},
          ...enabled.map((p) =>
            el(
              'li',
              {},
              el(
                'a',
                safeUrl(p.docsUrl) ? { href: safeUrl(p.docsUrl), target: '_blank', rel: 'noopener noreferrer' } : { href: '/health' },
                p.name,
              ),
            ),
          ),
          el('li', {}, el('a', { href: '/about' }, 'Attribution & licensing')),
        ),
      ),
    ),
    el(
      'div',
      { class: 'footer-bottom' },
      el(
        'div',
        { class: 'footer-bottom-inner' },
        el('span', {}, `© ${new Date().getFullYear()} CULINA · v${APP.version}`),
        el('span', {}, 'Aggregates third-party open data. Nutrition & product information is provided “as is” and is not dietary advice.'),
        el('span', {}, 'Local-first: favorites, plans & settings never leave your browser.'),
      ),
    ),
  );
}
