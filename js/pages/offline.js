/**
 * CULINA — In-app offline state (route version; the service worker serves
 * public/offline.html when even the app shell can’t load).
 */
import { el, icon } from '../utils/dom.js';
import { refreshIcons } from '../utils/icons.js';
import { applyMeta } from '../seo.js';
import { BrandIcon } from '../components/brand.js';
import { emptyState } from '../components/states.js';

export async function render(ctx) {
  applyMeta({ robots: 'noindex', title: 'Offline', description: 'You’re offline. Cached CULINA pages remain available.', path: '/offline' });

  const root = el(
    'div',
    { class: 'page' },
    el(
      'div',
      { class: 'container', style: { maxWidth: '640px' } },
      el(
        'div',
        { class: 'offline-hero' },
        el('span', { class: 'offline-brand', 'aria-hidden': 'true' }, BrandIcon({ size: 56 })),
        el('h1', {}, 'You’re offline'),
        el(
          'p',
          { class: 'muted', style: { lineHeight: 1.6 } },
          'CULINA needs a connection for live recipes, drinks and product data. Pages you visited recently may still work from cache — reconnect to keep discovering.',
        ),
        el(
          'div',
          { class: 'cluster', style: { justifyContent: 'center', marginTop: 'var(--space-4)' } },
          el('button', { class: 'btn btn-primary', type: 'button', onclick: () => location.reload() }, icon('rotate-cw'), 'Try again'),
          el('a', { class: 'btn btn-secondary', href: '/favorites' }, icon('heart'), 'Open favorites (offline)'),
        ),
      ),
      navigator.onLine
        ? el('div', { class: 'notice is-success', style: { marginTop: 'var(--space-4)' } }, icon('info'), el('span', {}, 'Your connection appears to be back — reload to fetch live data.'))
        : emptyState({
            icon: 'wifi-off',
            title: 'No connection right now',
            message: 'Everything you saved — favorites, plans and your shopping list — is stored on this device and available offline.',
            actionLabel: 'Go to planner',
            href: '/planner',
          }),
    ),
  );
  refreshIcons();
  return root;
}
