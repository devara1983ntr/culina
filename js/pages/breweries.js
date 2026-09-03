/**
 * CULINA — Breweries explorer (PRD §16): Open Brewery DB with search,
 * type/country filters and server-side pagination (rate-limit aware).
 */
import { el, icon } from '../utils/dom.js';
import { refreshIcons } from '../utils/icons.js';
import { applyMeta } from '../seo.js';
import { openbrewerydb } from '../api/adapters/index.js';
import { entityGrid } from '../components/cards.js';
import { searchField, selectField, viewToggle } from '../components/filters.js';
import { pagination } from '../components/pagination.js';
import { skeletonGrid, emptyState, errorState, renderInto } from '../components/states.js';
import { pageHeader, mountReveal } from './shared.js';
import { safeUrl } from '../utils/format.js';

const TYPES = ['micro', 'brewpub', 'nano', 'regional', 'large', 'cidery', 'taproom', 'bar', 'contract', 'proprietor', 'planning', 'closed', 'beergarden'];
const COUNTRIES = ['United States', 'Germany', 'England', 'Canada', 'Australia', 'Belgium', 'Ireland', 'Netherlands', 'New Zealand', 'Portugal', 'Scotland', 'Singapore', 'South Africa', 'South Korea', 'Sweden', 'France', 'Japan', 'Poland', 'Austria'];

export async function render(ctx) {
  let state = {
    q: ctx.query.q || '',
    type: ctx.query.type || '',
    country: ctx.query.country || '',
    page: Math.max(1, Number(ctx.query.page) || 1),
    view: 'grid',
  };

  applyMeta({
    title: 'Breweries',
    description: 'Search 11,800+ breweries, cideries and craft beer bottle shops worldwide — live from Open Brewery DB.',
    path: '/breweries',
  });

  const resultsHost = el('div');
  const search = searchField({
    id: 'breweries-q',
    placeholder: 'Search breweries by name…',
    value: state.q,
    onSubmit: (value) => {
      state.q = value.trim();
      state.page = 1;
      syncUrl();
      load();
    },
    submitLabel: 'Search',
  });
  search.element.style.flex = '0 1 240px';

  const root = el(
    'div',
    { class: 'page' },
    el(
      'div',
      { class: 'container' },
      pageHeader({
        overline: 'Open Brewery DB · live',
        title: 'Breweries',
        lead: 'Breweries, cideries and craft bottle shops across the world — with addresses, coordinates and websites. Results are cached to respect the provider’s rate limits.',
      }),
      el(
        'div',
        { class: 'filter-bar' },
        search.element,
        selectField({ id: 'brew-type', label: 'Type', options: [{ value: '', label: 'All types' }, ...TYPES.map((t) => ({ value: t, label: t[0].toUpperCase() + t.slice(1) }))], value: state.type, onChange: (v) => { state.type = v; state.page = 1; syncUrl(); load(); } }),
        selectField({ id: 'brew-country', label: 'Country', options: [{ value: '', label: 'All countries' }, ...COUNTRIES.map((c) => ({ value: c, label: c }))], value: state.country, onChange: (v) => { state.country = v; state.page = 1; syncUrl(); load(); } }),
        viewToggle({ value: state.view, onChange: (v) => { state.view = v; load(); } }),
      ),
      resultsHost,
    ),
  );

  function syncUrl() {
    const params = new URLSearchParams();
    if (state.q) params.set('q', state.q);
    if (state.type) params.set('type', state.type);
    if (state.country) params.set('country', state.country);
    if (state.page > 1) params.set('page', String(state.page));
    history.replaceState(history.state, '', params.toString() ? `/breweries?${params}` : '/breweries');
  }

  async function load() {
    renderInto(resultsHost, skeletonGrid(8));
    try {
      const perPage = 24;
      const items = await openbrewerydb.list({
        page: state.page,
        perPage,
        byType: state.type || undefined,
        byCountry: state.country || undefined,
        byName: state.q || undefined,
        signal: ctx.signal,
      });

      if (!items.length) {
        renderInto(
          resultsHost,
          emptyState({
            icon: 'building-2',
            title: state.page > 1 ? 'End of results' : 'No breweries matched',
            message: state.page > 1 ? 'You’ve gone past the last page for these filters.' : 'Try a different name, type or country — Open Brewery DB indexes 11,800+ breweries.',
            actionLabel: state.page > 1 ? 'Back to page 1' : 'Clear filters',
            onAction: () => {
              if (state.page > 1) state.page = 1;
              else state = { ...state, q: '', type: '', country: '' };
              syncUrl();
              load();
            },
          }),
        );
        refreshIcons();
        return;
      }

      const grid = entityGrid(items, { entity: 'brewery' });
      grid.classList.toggle('is-list', state.view === 'list');
      renderInto(
        resultsHost,
        el(
          'div',
          { class: 'results-meta' },
          el('span', { class: 'results-count' }, 'Page ', el('strong', {}, String(state.page)), ' · Open Brewery DB (120 requests per rate window — results cached 10 min)'),
        ),
        grid,
        pagination({
          page: state.page,
          totalPages: items.length < perPage ? state.page : state.page + 1,
          onPage: (p) => {
            state.page = p;
            syncUrl();
            load();
            window.scrollTo({ top: 0, behavior: 'smooth' });
          },
          ariaLabel: 'Brewery pages',
        }),
      );
      refreshIcons();
      mountReveal(ctx, grid);
    } catch (err) {
      if (err?.name === 'AbortError') return;
      const isRateLimit = err?.type === 'RATE_LIMIT';
      renderInto(
        resultsHost,
        errorState({ error: err, onRetry: () => load() }),
        isRateLimit
          ? el('div', { class: 'notice is-info', style: { marginTop: 'var(--space-4)' } }, icon('info'), el('span', {}, 'Open Brewery DB allows 120 requests per window per IP. Cached results keep working — wait a minute and retry for fresh pages.'))
          : null,
      );
      refreshIcons();
    }
  }

  load();
  refreshIcons();
  return root;
}
