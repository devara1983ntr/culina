/**
 * CULINA — Product detail (PRD §15): name, brand, image, ingredients,
 * nutrition, categories, serving info, source, product identifier.
 * Never fabricates missing fields.
 */
import { el, icon } from '../utils/dom.js';
import { refreshIcons } from '../utils/icons.js';
import { applyMeta } from '../seo.js';
import { openfoodfacts } from '../api/adapters/index.js';
import { favoriteButton, mediaImage, monogramTile } from '../components/cards.js';
import { nutritionPanel, nutriscoreBadge, novaBadge } from '../components/nutrition.js';
import { sourcePanel } from '../components/providerBadge.js';
import { skeletonDetail, emptyState, errorState, renderInto } from '../components/states.js';
import { envelopeFor } from '../services/favorites.js';
import { truncate } from '../utils/format.js';
import { history } from '../services/history.js';
import { mountImageLightbox } from '../components/lightbox.js';

export async function render(ctx) {
  const { id } = ctx.params;
  const barcode = decodeURIComponent(id).replace(/\D/g, '');
  const root = el('div', { class: 'page' });
  root.append(skeletonDetail());

  let product;
  try {
    product = await openfoodfacts.product(barcode, { signal: ctx.signal });
  } catch (err) {
    if (err?.name === 'AbortError') return root;
    renderInto(root, errorState({ error: err, onRetry: () => location.reload() }));
    refreshIcons();
    return root;
  }

  if (!product) {
    applyMeta({ title: 'Product not found', path: ctx.path });
    renderInto(
      root,
      emptyState({
        icon: 'package',
        title: 'Product not found',
        message: `Open Food Facts has no product with barcode ${barcode}. You can add it at world.openfoodfacts.org — it’s a crowdsourced database.`,
        actionLabel: 'Search products',
        href: '/products',
      }),
    );
    refreshIcons();
    return root;
  }

  applyMeta({
    title: `${product.title}${product.brand ? ` — ${product.brand}` : ''}`,
    description: `${product.title}${product.brands.length ? ` by ${product.brands.slice(0, 2).join(', ')}` : ''} — ingredients, Nutri-Score and per-100 g nutrition from Open Food Facts.`,
    path: ctx.path,
    ogImage: product.image || undefined,
  });

  const envelope = envelopeFor('product', product, `/product/${product.sourceId}`);

  history.recordView({
    id: product.id,
    entity: 'product',
    title: product.title,
    subtitle: product.brand || null,
    image: product.image,
    route: `/product/${product.sourceId}`,
  });

  const hero = el(
    'header',
    { class: 'detail-hero', style: { marginTop: 'var(--space-6)' } },
    el(
      'div',
      { class: 'detail-hero-grid' },
      el('div', { class: 'detail-hero-media' }, mediaImage({ image: product.image, title: product.title, eager: true })),
      el(
        'div',
        {},
        el('p', { class: 'overline' }, icon('package'), 'Food product'),
        el('h1', {}, product.title),
        el(
          'p',
          { class: 'detail-summary' },
          product.brands.length
            ? `By ${product.brands.slice(0, 3).join(', ')}${product.quantity ? ` · ${product.quantity}` : ''}. Data contributed to Open Food Facts and licensed under ODbL.`
            : `Data contributed to Open Food Facts and licensed under ODbL${product.quantity ? ` · ${product.quantity}` : ''}.`,
        ),
        el(
          'div',
          { class: 'detail-meta-row' },
          nutriscoreBadge(product.nutriscore),
          novaBadge(product.nova),
          product.servingSize ? el('span', { class: 'badge badge-neutral' }, `Serving: ${product.servingSize}`) : null,
          el('span', { class: 'badge badge-neutral numeric', title: 'Product identifier (barcode)' }, `#${barcode}`),
          el('span', { class: 'provider-badge' }, el('span', { class: 'badge-dot', 'aria-hidden': 'true' }), 'Open Food Facts'),
        ),
        el(
          'div',
          { class: 'detail-actions' },
          favoriteButton('product', product),
          el('a', { class: 'btn btn-secondary', href: product.sourceUrl, target: '_blank', rel: 'noopener noreferrer' }, icon('external-link'), 'View on Open Food Facts'),
        ),
      ),
    ),
  );

  const aside = el(
    'aside',
    { class: 'detail-aside' },
    el(
      'section',
      { class: 'detail-section', 'aria-labelledby': 'pnutrition-h' },
      el('h2', { id: 'pnutrition-h' }, icon('flask-conical'), 'Nutrition'),
      nutritionPanel(product.nutrition, {
        basisNote: `${product.servingSize ? `Serving: ${product.servingSize} · ` : ''}per 100 g/ml as reported by Open Food Facts`,
      }),
    ),
    sourcePanel('openfoodfacts', {
      note: 'Nutri-Score and NOVA grades are computed by Open Food Facts from the product’s declared composition and are shown as reported.',
    }),
  );

  const main = el(
    'div',
    { class: 'detail-main' },
    product.ingredientsText
      ? el(
          'section',
          { class: 'detail-section', 'aria-labelledby': 'pingredients-h' },
          el('h2', { id: 'pingredients-h' }, icon('list'), 'Ingredients'),
          el('p', { style: { maxWidth: '62ch', color: 'var(--color-text-secondary)', lineHeight: '1.7' } }, product.ingredientsText),
        )
      : el(
          'section',
          { class: 'detail-section', 'aria-labelledby': 'pingredients-h' },
          el('h2', { id: 'pingredients-h' }, icon('list'), 'Ingredients'),
          el('p', { class: 'muted' }, 'No ingredient list has been contributed for this product yet.'),
        ),
    product.categories.length
      ? el(
          'section',
          { class: 'detail-section', 'aria-labelledby': 'pcats-h' },
          el('h2', { id: 'pcats-h' }, icon('tags'), 'Categories'),
          el('div', { class: 'cluster' }, ...product.categories.map((c) => el('span', { class: 'badge badge-neutral' }, c))),
        )
      : null,
    product.labels.length
      ? el(
          'section',
          { class: 'detail-section', 'aria-labelledby': 'plabels-h' },
          el('h2', { id: 'plabels-h' }, icon('shield-check'), 'Labels & certifications'),
          el('div', { class: 'cluster' }, ...product.labels.map((l) => el('span', { class: 'badge badge-success' }, l))),
        )
      : null,
  );

  root.replaceChildren(
    hero,
    el('div', { class: 'detail-sections' }, aside, main),
  );

  refreshIcons();
  /* Tap a hero photo to enlarge it (lightbox). */
  mountImageLightbox(ctx, root);

  return root;
}
