/**
 * CULINA — About: product story, architecture, data sources & attribution,
 * privacy, accessibility, tech stack, legal (PRD §73).
 */
import { el, icon } from '../utils/dom.js';
import { refreshIcons } from '../utils/icons.js';
import { applyMeta } from '../seo.js';
import { snapshot } from '../api/health.js';
import { APP } from '../constants.js';
import { safeUrl } from '../utils/format.js';

const ARCHITECTURE = `  ┌─────────────────────────────────────────────────────┐
  │                      CULINA UI                       │
  │      pages · components · (no provider knowledge)    │
  └───────────────────────┬─────────────────────────────┘
                          │ unified domain models
  ┌───────────────────────┴─────────────────────────────┐
  │              Application state & services            │
  │   search · favorites · planner · shopping · health   │
  └───────────────────────┬─────────────────────────────┘
                          │ normalized requests
  ┌───────────────────────┴─────────────────────────────┐
  │   API client — timeout · retry · dedupe · cache      │
  │   telemetry · error normalization (ApiError)         │
  └───────────────────────┬─────────────────────────────┘
          adapters (one per provider)  │  registry (metadata)
   mealdb · cocktaildb · fruityvice ·  │  classification · auth
   openfoodfacts · obd · sampleapis    │  status · attribution
                                      ▼
        browser-ready providers ──► direct HTTPS (CORS)
        restricted providers ────► same-origin gateway
                                     /api/fruityvice →
                                     www.fruityvice.com`;

export async function render(ctx) {
  applyMeta({
    title: 'About',
    description: 'How CULINA works: a multi-provider food intelligence platform built on vanilla web standards with verified open data sources.',
    path: '/about',
  });

  const providers = snapshot();
  const enabled = providers.filter((p) => p.enabled);
  const restricted = providers.filter((p) => !p.enabled);

  const root = el(
    'div',
    { class: 'page' },
    el(
      'div',
      { class: 'about-section' },
      el('p', { class: 'overline' }, icon('sparkles'), 'The product'),
      el('h1', {}, 'One coherent food experience'),
      el('p', { class: 'brand-tagline', 'aria-label': `${APP.name} tagline` }, APP.brandTagline),
      el(
        'p',
        { class: 'lead' },
        'CULINA is a food intelligence and discovery platform. It unifies recipes, ingredients, fruits, nutrition, packaged products, cocktails, beer, breweries and coffee from multiple independent data sources — and presents them as a single, considered product. You should never need to understand the underlying API architecture to cook dinner.',
      ),
    ),

    el(
      'div',
      { class: 'about-section' },
      el('h2', {}, 'How it works'),
      el('p', {}, 'Every provider response passes through an adapter and a normalizer before it reaches the interface. UI components only ever see unified domain models — never provider-specific field names. Adding a new source means writing one registry entry, one adapter and one normalizer; nothing else changes.'),
      el('pre', { class: 'arch-diagram', 'aria-label': 'Architecture diagram: UI, state and services, API client, adapters and registry, providers reached directly or through the gateway' }, ARCHITECTURE),
    ),

    el(
      'div',
      { class: 'about-section' },
      el('h2', {}, 'Data sources & attribution'),
      el('p', {}, `CULINA aggregates ${enabled.length} live providers. Each result carries a source badge, and detail pages include a full source panel with license and rate-limit information. Data and imagery remain the property of their providers.`),
      el(
        'ul',
        { class: 'plain-list', style: { marginTop: 'var(--space-4)' } },
        ...enabled.map((p) => {
          const url = safeUrl(p.attributionUrl || p.docsUrl);
          return el(
            'li',
            {},
            icon('circle-check'),
            el(
              'span',
              {},
              el('strong', {}, p.name),
              ` — ${p.attribution}. ${p.license}.`,
              url ? el('a', { class: 'text-link', href: url, target: '_blank', rel: 'noopener noreferrer', style: { marginLeft: '4px' } }, 'Visit') : null,
            ),
          );
        }),
      ),
    ),

    el(
      'div',
      { class: 'about-section' },
      el('h2', {}, 'Sources we verified but don’t use'),
      el('p', {}, 'Transparency matters more than feature count. These providers were inspected on 2026-09-02 and are intentionally not enabled:'),
      el(
        'ul',
        { class: 'plain-list', style: { marginTop: 'var(--space-4)' } },
        ...restricted.map((p) =>
          el(
            'li',
            {},
            icon(p.classification === 'UNAVAILABLE' ? 'circle-x' : 'ban'),
            el(
              'span',
              {},
              el('strong', {}, p.name),
              ` — ${p.classification.replace(/_/g, ' ').toLowerCase()}. ${p.notes || ''}`,
            ),
          ),
        ),
      ),
    ),

    el(
      'div',
      { class: 'about-section' },
      el('h2', {}, 'Privacy — local-first by design'),
      el('ul', { class: 'plain-list' },
        el('li', {}, icon('shield-check'), el('span', {}, 'Favorites, meal plans, theme and recent searches never leave your browser (localStorage).')),
        el('li', {}, icon('shield-check'), el('span', {}, 'No accounts, no analytics, no tracking, no cookies for tracking purposes.')),
        el('li', {}, icon('shield-check'), el('span', {}, 'Requests go directly from your browser to the provider (plus one allowlisted gateway hop for a CORS-restricted source).')),
        el('li', {}, icon('shield-check'), el('span', {}, 'Clearing site data resets everything — that’s the whole privacy model.')),
      ),
    ),

    el(
      'div',
      { class: 'about-section' },
      el('h2', {}, 'Accessibility'),
      el('p', {}, 'CULINA targets WCAG 2.2 AA: semantic landmarks, visible focus, keyboard navigation everywhere (including tabs, dialogs and the search palette), aria-live status messages, sufficient contrast in both themes, reduced-motion support, and accessible text equivalents for all data visualizations.'),
    ),

    el(
      'div',
      { class: 'about-section' },
      el('h2', {}, 'Built with'),
      el('ul', { class: 'plain-list' },
        el('li', {}, icon('check'), el('span', {}, 'Vanilla HTML5, CSS3 & modern ECMAScript — no React/Vue/Angular by design.')),
        el('li', {}, icon('check'), el('span', {}, 'Vite for building and code-splitting; each route is its own chunk.')),
        el('li', {}, icon('check'), el('span', {}, 'Motion (Framer Motion’s vanilla engine) for restrained, reduced-motion-aware animation.')),
        el('li', {}, icon('check'), el('span', {}, 'Lucide for iconography; SortableJS for planner drag & drop (with button alternatives).')),
        el('li', {}, icon('check'), el('span', {}, 'Playfair Display & Inter, self-hosted via Fontsource (OFL licensed).')),
        el('li', {}, icon('check'), el('span', {}, 'Design system generated with the UI/UX Pro Max skill — see design-system/culina/MASTER.md.')),
      ),
    ),

    el(
      'div',
      { class: 'about-section' },
      el('h2', {}, 'Legal & disclaimer'),
      el('p', {}, 'CULINA aggregates third-party open data for discovery purposes. Recipe, nutrition and product information is provided “as is” by its sources and may be incomplete or out of date. Nothing here is dietary, medical or allergen advice — always check labels and use your judgment. Open Food Facts data is licensed under the Open Database License (ODbL) v1.0.'),
      el('p', { class: 'muted', style: { marginTop: 'var(--space-3)', fontSize: 'var(--text-sm)' } }, `CULINA v${APP.version} — ${APP.tagline}`),
      el('p', { class: 'muted', style: { marginTop: 'var(--space-2)', fontSize: 'var(--text-sm)' } }, `${APP.developerCredit}.`),
    ),
  );

  refreshIcons();
  return root;
}
