/**
 * CULINA — Nutrition explorer (PRD §26–§27, §71).
 * Honest framing: fruit nutrition (Fruityvice) + product nutrition
 * (Open Food Facts). Key-gated providers are shown as “configuration
 * required”, never faked.
 */
import { el, icon } from '../utils/dom.js';
import { refreshIcons } from '../utils/icons.js';
import { applyMeta } from '../seo.js';
import { fruityvice, openfoodfacts } from '../api/adapters/index.js';
import { entityGrid } from '../components/cards.js';
import { nutritionPanel } from '../components/nutrition.js';
import { searchField } from '../components/filters.js';
import { skeletonGrid, skeletonRows, emptyState, errorState, renderInto } from '../components/states.js';
import { pageHeader, section, sectionHead, mountReveal } from './shared.js';
import { snapshot } from '../api/health.js';
import { providerStatusIcon } from '../components/providerBadge.js';
import { STATUS_LABELS } from '../api/registry.js';

export async function render(ctx) {
  applyMeta({
    title: 'Nutrition',
    description: 'Verified nutrition: per-100 g fruit profiles from Fruityvice and packaged product nutrition with Nutri-Score from Open Food Facts.',
    path: '/nutrition',
  });

  const root = el('div', { class: 'page' });
  root.append(
    el(
      'div',
      { class: 'container' },
      pageHeader({
        overline: 'Nutrition intelligence',
        title: 'Understand what’s on your plate',
        lead: 'CULINA only shows nutrition that a verified source actually provides — per-100 g fruit data from Fruityvice, and lab-derived product values from Open Food Facts. Unknown values stay unknown.',
      }),
    ),
  );

  /* -------------------------------------------------- Fruit explorer */
  const fruitPanelHost = el('div', { class: 'stack-5' });
  const fruitGridHost = el('div');

  async function loadFruits() {
    renderInto(fruitGridHost, skeletonGrid(6));
    try {
      const fruits = await fruityvice.listFruits({ signal: ctx.signal });
      renderInto(
        fruitGridHost,
        el(
          'div',
          {},
          (() => {
            const field = searchField({
              id: 'nutrition-fruit-q',
              placeholder: 'Filter fruits…',
              onSubmit: (value) => selectFruit(fruits.filter((f) => f.name.toLowerCase().includes(value.trim().toLowerCase()))[0]),
              submitLabel: 'Go',
            });
            return field.element;
          })(),
          el('div', { style: { height: 'var(--space-4)' } }),
          entityGrid(fruits.slice(0, 12), { entity: 'fruit', showFavorite: true }),
        ),
      );
      refreshIcons();
      mountReveal(ctx, fruitGridHost.querySelector('.grid-cards'));
      // Preselect a fruit to demonstrate the panel
      selectFruit(fruits.find((f) => f.name === 'Strawberry') || fruits[0]);
    } catch (err) {
      if (err?.name === 'AbortError') return;
      renderInto(fruitPanelHost, errorState({ error: err, onRetry: () => loadFruits() }));
    }
  }

  function selectFruit(fruit) {
    if (!fruit) return;
    renderInto(
      fruitPanelHost,
      el(
        'div',
        { class: 'split', style: { alignItems: 'start' } },
        el(
          'div',
          {},
          el('p', { class: 'overline' }, icon('citrus'), 'Selected fruit'),
          el('h3', { style: { margin: 'var(--space-2) 0' } }, fruit.name),
          el('p', { class: 'muted', style: { fontSize: 'var(--text-sm)' } }, [fruit.family && `Family: ${fruit.family}`, fruit.genus && `Genus: ${fruit.genus}`].filter(Boolean).join(' · ')),
          el('a', { class: 'btn btn-soft btn-sm', href: `/ingredient/fruityvice/${fruit.sourceId}`, style: { marginTop: 'var(--space-3)' } }, 'Full profile', icon('arrow-right')),
        ),
        el('div', {}, nutritionPanel(fruit.nutrition)),
      ),
    );
    refreshIcons();
  }

  root.append(
    section({
      head: sectionHead('Fruit nutrition', { sub: 'Per-100 g values from Fruityvice (reached through the CULINA gateway)' }),
      children: [fruitPanelHost, fruitGridHost],
    }),
  );

  /* -------------------------------------------------- Product nutrition */
  const productHost = el('div');
  root.append(
    section({
      head: sectionHead('Product nutrition', { sub: '3M+ packaged products with Nutri-Score, NOVA and per-100 g values from Open Food Facts' }),
      children: [productHost],
    }),
  );

  async function loadProductDemo() {
    const field = searchField({
      id: 'nutrition-product-q',
      placeholder: 'Search a product (e.g. nutella, oats, yogurt)…',
      onSubmit: (value) => searchProducts(value.trim()),
      submitLabel: 'Search',
    });
    renderInto(
      productHost,
      field.element,
      el('div', { style: { height: 'var(--space-5)' } }),
      emptyState({
        icon: 'package',
        title: 'Search for a packaged product',
        message: 'Open Food Facts carries ingredients, Nutri-Score, NOVA group and full nutriments — opening a product shows the complete verified panel.',
        actionLabel: 'Try “nutella”',
        onAction: () => searchProducts('nutella'),
      }),
    );
    refreshIcons();
  }

  async function searchProducts(query) {
    if (!query) return;
    renderInto(productHost, skeletonGrid(4));
    try {
      const { products } = await openfoodfacts.search(query, { pageSize: 8, signal: ctx.signal });
      if (!products.length) {
        renderInto(
          productHost,
          emptyState({ icon: 'search', title: `No products matched “${query}”`, message: 'Try a simpler term or a brand name.' }),
        );
        refreshIcons();
        return;
      }
      renderInto(productHost, entityGrid(products, { entity: 'product' }));
      refreshIcons();
      mountReveal(ctx, productHost.querySelector('.grid-cards'));
    } catch (err) {
      if (err?.name === 'AbortError') return;
      renderInto(
        productHost,
        errorState({
          error: err,
          onRetry: () => searchProducts(query),
          retryLabel: 'Retry search',
        }),
        err?.type === 'HTTP_ERROR' && err.status === 503
          ? el('div', { class: 'notice is-info', style: { marginTop: 'var(--space-3)' } }, icon('info'), el('span', {}, 'Open Food Facts intermittently throttles its search endpoint under load (HTTP 503). Barcode lookup on the product page usually keeps working.'))
          : null,
      );
      refreshIcons();
    }
  }

  /* -------------------------------------------- Credential-gated providers */
  const gated = snapshot().filter((p) => p.classification === 'API_KEY_REQUIRED' || p.classification === 'OAUTH_REQUIRED');
  root.append(
    section({
      head: sectionHead('Premium nutrition sources', { sub: 'Verified but credential-gated — shown honestly instead of faked' }),
      children: [
        el(
          'div',
          { class: 'grid-cards wide' },
          ...gated.slice(0, 6).map((p) =>
            el(
              'div',
              { class: 'card' },
              el(
                'div',
                { class: 'card-body' },
                el('h3', { class: 'card-title', style: { WebkitLineClamp: 'unset' } }, p.name),
                el('p', { class: 'muted', style: { fontSize: 'var(--text-sm)' } }, p.notes || ''),
                el('div', { class: 'card-footer-row' }, providerStatusIcon(p.status)),
                el(
                  'p',
                  { class: 'muted', style: { fontSize: 'var(--text-xs)', marginTop: 'var(--space-2)' } },
                  'Would require CULINA’s gateway to hold credentials server-side (PRD §72) — never in the browser bundle.',
                ),
              ),
            ),
          ),
        ),
      ],
    }),
  );

  loadFruits();
  loadProductDemo();
  refreshIcons();
  return root;
}
