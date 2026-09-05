/**
 * CULINA — Brewery detail (/brewery/:name).
 * Deep links carry the brewery name because Open Brewery DB ignores id-based
 * lookups (verified 2026-09-03); the page resolves by exact name.
 */
import { el, icon } from '../utils/dom.js';
import { refreshIcons } from '../utils/icons.js';
import { applyMeta } from '../seo.js';
import { openbrewerydb } from '../api/adapters/index.js';
import { favoriteButton, entityGrid } from '../components/cards.js';
import { sourcePanel } from '../components/providerBadge.js';
import { skeletonDetail, emptyState, errorState, renderInto } from '../components/states.js';
import { safeUrl } from '../utils/format.js';
import { history } from '../services/history.js';
import { mountImageLightbox } from '../components/lightbox.js';

const TYPE_LABELS = {
  micro: 'Microbrewery',
  brewpub: 'Brewpub',
  nano: 'Nanobrewery',
  regional: 'Regional brewery',
  large: 'Large brewery',
  cidery: 'Cidery',
  taproom: 'Taproom',
  bar: 'Bar',
  contract: 'Contract brewery',
  proprietor: 'Proprietor',
  planning: 'In planning',
  closed: 'Closed',
  beergarden: 'Beer garden',
};

function telHref(phone) {
  const digits = String(phone || '').replace(/[^\d+]/g, '');
  return digits ? `tel:${digits}` : null;
}

export async function render(ctx) {
  const name = decodeURIComponent(ctx.params.name || '');
  const root = el('div', { class: 'page' });
  root.append(skeletonDetail());

  let brewery = null;
  try {
    brewery = await openbrewerydb.lookupByName(name, { signal: ctx.signal });
  } catch (err) {
    if (err?.name === 'AbortError') return root;
    renderInto(root, errorState({ error: err, onRetry: () => location.reload() }));
    refreshIcons();
    return root;
  }

  if (!brewery) {
    applyMeta({ title: 'Brewery not found', path: ctx.path });
    renderInto(
      root,
      emptyState({
        icon: 'building-2',
        title: 'Brewery not found',
        message: `Open Brewery DB has no exact match for “${name}”. Names change — try searching from the breweries page.`,
        actionLabel: 'Search breweries',
        href: '/breweries',
      }),
    );
    refreshIcons();
    return root;
  }

  history.recordView({
    id: brewery.id,
    entity: 'brewery',
    title: brewery.name,
    subtitle: [brewery.city, brewery.country].filter(Boolean).join(', ') || null,
    image: null,
    route: `/brewery/${encodeURIComponent(brewery.name)}`,
  });

  applyMeta({
    title: `${brewery.name} — Brewery`,
    description: `${brewery.name}${brewery.breweryType ? ` (${TYPE_LABELS[brewery.breweryType] || brewery.breweryType})` : ''}${brewery.city ? ` in ${brewery.city}` : ''}${brewery.country ? `, ${brewery.country}` : ''}. Details from Open Brewery DB.`,
    path: `/brewery/${encodeURIComponent(brewery.name)}`,
  });

  const relatedHost = el('div');
  const website = safeUrl(brewery.website);
  const phoneHref = telHref(brewery.phone);

  root.replaceChildren(
    el(
      'header',
      { class: 'detail-hero', style: { marginTop: 'var(--space-6)' } },
      el(
        'div',
        { class: 'detail-hero-grid' },
        el(
          'div',
          { class: 'detail-hero-media brewery-hero' },
          el('span', { class: 'icon-tile is-large', 'aria-hidden': 'true' }, icon('building-2')),
          el('span', { class: 'brewery-hero-name' }, brewery.name.slice(0, 1)),
        ),
        el(
          'div',
          {},
          el('p', { class: 'overline' }, icon('building-2'), 'Brewery · Open Brewery DB'),
          el('h1', {}, brewery.name),
          el(
            'p',
            { class: 'detail-summary' },
            brewery.address
              ? `${TYPE_LABELS[brewery.breweryType] || brewery.breweryType || 'Brewery'} — ${brewery.address}.`
              : `${TYPE_LABELS[brewery.breweryType] || brewery.breweryType || 'Brewery'}${brewery.country ? ` in ${brewery.country}` : ''}.`,
          ),
          el(
            'div',
            { class: 'detail-meta-row' },
            brewery.breweryType ? el('span', { class: 'badge badge-accent' }, TYPE_LABELS[brewery.breweryType] || brewery.breweryType) : null,
            brewery.city ? el('span', { class: 'badge badge-neutral' }, icon('map-pin'), ` ${brewery.city}`) : null,
            brewery.state ? el('span', { class: 'badge badge-neutral' }, brewery.state) : null,
            el('span', { class: 'provider-badge' }, el('span', { class: 'badge-dot', 'aria-hidden': 'true' }), 'Open Brewery DB'),
          ),
          el(
            'div',
            { class: 'detail-actions' },
            favoriteButton('brewery', brewery),
            brewery.mapUrl ? el('a', { class: 'btn btn-secondary', href: brewery.mapUrl, target: '_blank', rel: 'noopener noreferrer' }, icon('map-pin'), 'Map') : null,
            website ? el('a', { class: 'btn btn-secondary', href: website, target: '_blank', rel: 'noopener noreferrer' }, icon('arrow-up-right'), 'Website') : null,
            phoneHref ? el('a', { class: 'btn btn-ghost', href: phoneHref }, icon('phone'), brewery.phone) : null,
          ),
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
          { class: 'detail-section', 'aria-labelledby': 'brw-details-h' },
          el('h2', { id: 'brw-details-h' }, icon('info'), 'Details'),
          el(
            'dl',
            { class: 'detail-facts' },
            el('dt', {}, 'Address'),
            el('dd', {}, brewery.address || 'Not in the database'),
            el('dt', {}, 'Phone'),
            el('dd', {}, phoneHref ? el('a', { class: 'text-link', href: phoneHref }, brewery.phone) : 'Not in the database'),
            el('dt', {}, 'Website'),
            el('dd', {}, website ? el('a', { class: 'text-link', href: website, target: '_blank', rel: 'noopener noreferrer' }, brewery.website) : 'Not in the database'),
            el('dt', {}, 'Coordinates'),
            el('dd', {}, brewery.latitude != null && brewery.longitude != null ? `${brewery.latitude}, ${brewery.longitude}` : 'Not in the database'),
          ),
        ),
        sourcePanel('openbrewerydb'),
      ),
      el(
        'div',
        { class: 'detail-main' },
        el(
          'section',
          { class: 'detail-section', 'aria-labelledby': 'brw-near-h' },
          el('h2', { id: 'brw-near-h' }, icon('sparkles'), brewery.city ? `More in ${brewery.city}` : 'More breweries'),
          relatedHost,
        ),
      ),
    ),
  );

  openbrewerydb
    .byCity(brewery.city, { excludeName: brewery.name, signal: ctx.signal })
    .then((related) => {
      if (!relatedHost.isConnected) return;
      renderInto(relatedHost, related.length ? entityGrid(related, { entity: 'brewery' }) : el('p', { class: 'muted' }, brewery.city ? `No other breweries listed in ${brewery.city} yet.` : 'No related breweries right now.'));
      refreshIcons();
    })
    .catch(() => {
      if (relatedHost.isConnected) renderInto(relatedHost, el('p', { class: 'muted' }, 'Nearby breweries are temporarily unavailable.'));
    });

  refreshIcons();
  /* Tap a hero photo to enlarge it (lightbox). */
  mountImageLightbox(ctx, root);

  return root;
}
