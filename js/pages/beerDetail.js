/**
 * CULINA — Beer detail (/beer/:style/:id).
 * SampleAPIs community dataset: name, price, rating, image — and honest
 * absence for everything else (ABV, brewery, tasting notes are NOT provided
 * and are never invented).
 */
import { el, icon } from '../utils/dom.js';
import { refreshIcons } from '../utils/icons.js';
import { applyMeta } from '../seo.js';
import { beers } from '../api/adapters/index.js';
import { favoriteButton, mediaImage, monogramTile, entityGrid } from '../components/cards.js';
import { sourcePanel } from '../components/providerBadge.js';
import { skeletonDetail, emptyState, errorState, renderInto } from '../components/states.js';
import { history } from '../services/history.js';

export async function render(ctx) {
  const { style, id } = ctx.params;
  const root = el('div', { class: 'page' });
  root.append(skeletonDetail());

  let beer = null;
  try {
    const { ales, stouts } = await beers.all({ signal: ctx.signal });
    beer = [...ales, ...stouts].find((b) => b.sourceId === id && b.style === style) || null;
  } catch (err) {
    if (err?.name === 'AbortError') return root;
    renderInto(root, errorState({ error: err, onRetry: () => location.reload() }));
    refreshIcons();
    return root;
  }

  if (!beer) {
    applyMeta({ title: 'Beer not found', path: ctx.path });
    renderInto(
      root,
      emptyState({
        icon: 'beer',
        title: 'Beer not found',
        message: 'No beer with this id in the SampleAPIs community dataset.',
        actionLabel: 'Browse beer',
        href: '/beer',
      }),
    );
    refreshIcons();
    return root;
  }

  history.recordView({
    id: beer.id,
    entity: 'beer',
    title: beer.name,
    subtitle: beer.style === 'stout' ? 'Stout' : 'Ale',
    image: beer.image,
    route: `/beer/${style}/${id}`,
  });

  applyMeta({
    title: `${beer.name} — Beer`,
    description: `${beer.name} — ${beer.style === 'stout' ? 'Stout' : 'Ale'}${beer.rating?.average != null ? `, community rating ${beer.rating.average}` : ''}${beer.price ? `, ${beer.price}` : ''}. Community data from SampleAPIs.`,
    path: `/beer/${style}/${id}`,
    ogImage: beer.image || undefined,
  });

  const relatedHost = el('div');

  root.replaceChildren(
    el(
      'header',
      { class: 'detail-hero', style: { marginTop: 'var(--space-6)' } },
      el(
        'div',
        { class: 'detail-hero-grid' },
        el('div', { class: 'detail-hero-media' }, beer.image ? mediaImage({ image: beer.image, title: beer.name, eager: true }) : el('div', { class: 'monogram-tile is-large' }, monogramTile(beer.name))),
        el(
          'div',
          {},
          el('p', { class: 'overline' }, icon('beer'), 'Beer · community dataset'),
          el('h1', {}, beer.name),
          el(
            'p',
            { class: 'detail-summary' },
            beer.rating?.average != null
              ? `A community-rated ${beer.style === 'stout' ? 'stout' : 'ale'}${beer.price ? ` at ${beer.price}` : ''}. Ratings come from the SampleAPIs community — take them as a signal, not a verdict.`
              : `A ${beer.style === 'stout' ? 'stout' : 'ale'} from the SampleAPIs community dataset.`,
          ),
          el(
            'div',
            { class: 'detail-meta-row' },
            el('span', { class: 'badge badge-accent' }, beer.style === 'stout' ? 'Stout' : 'Ale'),
            beer.rating?.average != null ? el('span', { class: 'badge badge-warning' }, icon('flame'), ` ${beer.rating.average} community rating`) : null,
            beer.rating?.reviews ? el('span', { class: 'badge badge-neutral' }, `${beer.rating.reviews} ratings`) : null,
            beer.price ? el('span', { class: 'badge badge-neutral' }, beer.price) : null,
            el('span', { class: 'provider-badge' }, el('span', { class: 'badge-dot', 'aria-hidden': 'true' }), 'SampleAPIs'),
          ),
          el('div', { class: 'detail-actions' }, favoriteButton('beer', beer)),
        ),
      ),
    ),
    el(
      'div',
      { class: 'detail-sections' },
      el(
        'aside',
        { class: 'detail-aside' },
        el(
          'section',
          { class: 'detail-section', 'aria-labelledby': 'beer-data-h' },
          el('h2', { id: 'beer-data-h' }, icon('info'), 'About this record'),
          el(
            'ul',
            { class: 'plain-list' },
            el('li', {}, icon('check'), el('span', {}, 'Name, style, price and community rating come from the SampleAPIs dataset.')),
            el('li', {}, icon('circle-slash'), el('span', {}, 'ABV, brewery and tasting notes are not provided by this source — so they are not shown, and never invented.')),
          ),
        ),
        sourcePanel('sampleapis-beers'),
      ),
      el(
        'div',
        { class: 'detail-main' },
        el(
          'section',
          { class: 'detail-section', 'aria-labelledby': 'beer-more-h' },
          el('h2', { id: 'beer-more-h' }, icon('sparkles'), `More ${beer.style === 'stout' ? 'stouts' : 'ales'}`),
          relatedHost,
        ),
      ),
    ),
  );

  beers
    .all({ signal: ctx.signal })
    .then(({ ales, stouts }) => {
      if (!relatedHost.isConnected) return;
      const pool = beer.style === 'stout' ? stouts : ales;
      const related = pool.filter((b) => b.sourceId !== beer.sourceId).slice(0, 4);
      renderInto(relatedHost, related.length ? entityGrid(related, { entity: 'beer' }) : el('p', { class: 'muted' }, 'Nothing else in this style right now.'));
      refreshIcons();
    })
    .catch(() => {
      if (relatedHost.isConnected) renderInto(relatedHost, el('p', { class: 'muted' }, 'More beers are temporarily unavailable.'));
    });

  refreshIcons();
  return root;
}
