/**
 * CULINA — Food products explorer (PRD §15).
 * Open Food Facts text search + reliable barcode lookup.
 */
import { el, icon } from '../utils/dom.js';
import { refreshIcons } from '../utils/icons.js';
import { applyMeta } from '../seo.js';
import { navigate } from '../router.js';
import { openfoodfacts } from '../api/adapters/index.js';
import { entityGrid } from '../components/cards.js';
import { searchField } from '../components/filters.js';
import { pagination } from '../components/pagination.js';
import { skeletonGrid, emptyState, errorState, renderInto } from '../components/states.js';
import { pageHeader, mountReveal } from './shared.js';

export async function render(ctx) {
  let query = String(ctx.query.q || '').trim();
  let page = Math.max(1, Number(ctx.query.page) || 1);

  applyMeta({
    title: 'Food Products',
    description: query
      ? `Food products matching “${query}” — ingredients, Nutri-Score and per-100 g nutrition from Open Food Facts.`
      : 'Search 3M+ packaged food products with ingredients, Nutri-Score and verified nutrition from Open Food Facts.',
    path: query ? `/products?q=${encodeURIComponent(query)}` : '/products',
  });

  const resultsHost = el('div');

  const search = searchField({
    id: 'products-q',
    placeholder: 'Search products by name or brand…',
    value: query,
    onSubmit: (value) => {
      query = value.trim();
      page = 1;
      syncUrl();
      load();
    },
    submitLabel: 'Search',
  });

  const barcode = el('input', {
    type: 'text',
    class: 'input',
    id: 'products-barcode',
    placeholder: '…or paste a barcode (e.g. 3017620422003)',
    inputmode: 'numeric',
    style: { maxWidth: '320px' },
  });
  barcode.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && barcode.value.trim()) {
      navigate(`/product/${barcode.value.trim().replace(/\D/g, '')}`);
    }
  });

  const root = el(
    'div',
    { class: 'page' },
    el(
      'div',
      { class: 'container' },
      pageHeader({
        overline: 'Open Food Facts · ODbL',
        title: 'Food Products',
        lead: 'Packaged goods with ingredients, Nutri-Score, NOVA groups and per-100 g nutrition — exactly as reported, never estimated.',
      }),
      el(
        'div',
        { class: 'filter-bar', style: { flexDirection: 'column', alignItems: 'stretch', gap: 'var(--space-3)' } },
        el('div', { class: 'cluster', style: { flexWrap: 'wrap' } }, search.element, barcode),
      ),
      resultsHost,
    ),
  );

  function syncUrl() {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (page > 1) params.set('page', String(page));
    history.replaceState(history.state, '', params.toString() ? `/products?${params}` : '/products');
  }

  async function load() {
    if (!query) {
      renderInto(
        resultsHost,
        emptyState({
          icon: 'package',
          title: 'Search the open food database',
          message: 'Try “nutella”, “oat milk”, “dark chocolate” — or paste a barcode above to jump straight to a product.',
          actionLabel: 'Try “nutella”',
          onAction: () => {
            query = 'nutella';
            search.input.value = query;
            syncUrl();
            load();
          },
        }),
      );
      refreshIcons();
      return;
    }

    renderInto(resultsHost, skeletonGrid(8));
    try {
      const { products, count } = await openfoodfacts.search(query, { page, pageSize: 24, signal: ctx.signal });
      if (!products.length) {
        renderInto(
          resultsHost,
          emptyState({
            icon: 'search',
            title: `No products matched “${query}”`,
            message: 'Try a shorter term or a brand name — the database indexes product names in their original language.',
            actionLabel: 'Clear search',
            onAction: () => {
              query = '';
              search.input.value = '';
              syncUrl();
              load();
            },
          }),
        );
        refreshIcons();
        return;
      }
      const grid = entityGrid(products, { entity: 'product' });
      renderInto(
        resultsHost,
        el(
          'div',
          { class: 'results-meta' },
          el('span', { class: 'results-count' }, count ? `${count.toLocaleString()} matches` : 'Results', ' · Open Food Facts (ODbL)'),
        ),
        grid,
        pagination({
          page,
          totalPages: Math.max(1, Math.ceil((count || products.length) / 24)),
          onPage: (p) => {
            page = p;
            syncUrl();
            load();
            resultsHost.scrollIntoView({ behavior: 'smooth', block: 'start' });
          },
          ariaLabel: 'Product pages',
        }),
      );
      refreshIcons();
      mountReveal(ctx, grid);
    } catch (err) {
      if (err?.name === 'AbortError') return;
      renderInto(
        resultsHost,
        errorState({
          error: err,
          onRetry: () => load(),
          retryLabel: 'Retry search',
        }),
        err?.status === 503 || err?.type === 'HTTP_ERROR'
          ? el(
              'div',
              { class: 'notice is-info', style: { marginTop: 'var(--space-4)' } },
              icon('info'),
              el(
                'span',
                {},
                'Open Food Facts sometimes enters maintenance mode (HTTP 503) under heavy load. Retrying usually works — and barcode lookup is served by a separate, more stable endpoint.',
              ),
            )
          : null,
      );
      refreshIcons();
    }
  }

  load();
  refreshIcons();
  return root;
}
