/**
 * CULINA — Privacy statement (PRD §privacy: local-first, no tracking).
 */
import { applyMeta } from '../seo.js';
import { docPage } from './shared.js';

export async function render(ctx) {
  applyMeta({
    title: 'Privacy',
    description: 'CULINA’s privacy model: everything you save stays on your device. No accounts, no analytics, no tracking.',
    path: '/privacy',
  });

  return docPage({
    overline: 'Your data, your device',
    title: 'Privacy',
    lead: 'CULINA is local-first by design. This page explains exactly what is stored, where, and how to remove it.',
    updated: '5 September 2026',
    sections: [
      {
        title: 'What we store, and where',
        body: [
          'Favorites, your meal plan, shopping-list state, search history, view history and preferences are stored in your browser’s localStorage under namespaced keys (culina:v1:*). They never leave your device and are never transmitted to CULINA or anyone else.',
          'Requests for recipes, drinks and product data go directly from your browser to the open data providers that power each result, plus one allowlisted gateway hop for a single CORS-restricted source. Those providers see your IP address and request as with any website visit, governed by their own policies.',
        ],
      },
      {
        title: 'What we never do',
        list: [
          'No accounts or sign-ups',
          'No analytics or telemetry about you',
          'No tracking cookies or advertising identifiers',
          'No selling or sharing of any personal data — there is none to share',
          'No reading of anything outside CULINA’s own storage keys',
        ],
      },
      {
        title: 'Controlling and deleting your data',
        body: [
          'Because everything is local, you hold the controls. In Settings you can disable search and view history, export everything as a JSON file, or reset all application data. Clearing your browser’s site data for CULINA has the same effect.',
          'History recording is optional and off-capped: CULINA keeps at most your last 12 searches and 24 viewed items.',
        ],
      },
      {
        title: 'Service worker and caching',
        body: [
          'The CULINA service worker caches the application shell and — briefly (10 minutes at most) — successful provider responses so recently viewed pages work offline. Cached data stays on your device and is never shared. You can clear it any time via your browser’s site settings.',
        ],
      },
      {
        title: 'Contact',
        body: [
          'CULINA is a demonstration product built on open data. Questions about this statement can be directed to the project maintainers via the repository listed in About.',
        ],
      },
    ],
  });
}
