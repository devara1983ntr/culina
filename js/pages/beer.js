/**
 * CULINA — Beer explorer (PRD §16).
 * Powered by SampleAPIs (community dataset). The classic PunkAPI is offline
 * (see registry & health page) — fields it can’t provide stay honestly absent.
 */
import { el, icon } from '../utils/dom.js';
import { refreshIcons } from '../utils/icons.js';
import { applyMeta } from '../seo.js';
import { beers } from '../api/adapters/index.js';
import { entityGrid } from '../components/cards.js';
import { chipRow, selectField } from '../components/filters.js';
import { skeletonGrid, errorState, emptyState, renderInto, partialFailureNotice } from '../components/states.js';
import { pageHeader, mountReveal } from './shared.js';

export async function render(ctx) {
  let style = ctx.query.style === 'stout' ? 'stout' : 'ale';
  let sort = 'default';

  applyMeta({
    title: 'Beer',
    description: 'Browse ales and stouts with community ratings. Powered by the SampleAPIs community dataset — commercial details are shown only when provided.',
    path: '/beer',
  });

  const resultsHost = el('div');
  const root = el(
    'div',
    { class: 'page' },
    el(
      'div',
      { class: 'container' },
      pageHeader({
        overline: 'SampleAPIs · community dataset',
        title: 'Beer',
        lead: 'Ales and stouts with prices and community ratings. The original BrewDog PunkAPI went offline in 2025 — CULINA fell back to this compatible dataset and labels it honestly.',
      }),
      el(
        'div',
        { class: 'filter-bar' },
        chipRow({
          items: [{ id: 'ale', label: 'Ales' }, { id: 'stout', label: 'Stouts' }],
          value: style,
          onSelect: (id) => {
            style = id;
            history.replaceState(history.state, '', `/beer?style=${id}`);
            load();
          },
          ariaLabel: 'Beer styles',
        }),
        selectField({
          id: 'beer-sort',
          label: 'Sort',
          options: [
            { value: 'default', label: 'Source order' },
            { value: 'rating', label: 'Top rated' },
            { value: 'az', label: 'Name A–Z' },
          ],
          value: sort,
          onChange: (v) => {
            sort = v;
            load();
          },
        }),
      ),
      resultsHost,
    ),
  );

  async function load() {
    renderInto(resultsHost, skeletonGrid(8));
    try {
      const { ales, stouts, failures } = await beers.all({ signal: ctx.signal });
      let items = style === 'stout' ? stouts : ales;
      if (sort === 'rating') items = [...items].sort((a, b) => (b.rating?.average ?? -1) - (a.rating?.average ?? -1));
      if (sort === 'az') items = [...items].sort((a, b) => a.title.localeCompare(b.title));

      const notice = failures.length
        ? partialFailureNotice(failures.map((f) => ({ provider: 'sampleapis-beers', label: 'SampleAPIs Beers', message: f?.message })))
        : null;

      if (!items.length) {
        renderInto(
          resultsHost,
          emptyState({
            icon: 'beer',
            title: 'This list came back empty',
            message: 'The community dataset may be updating. Try the other style or check API Health.',
            actionLabel: 'API health',
            href: '/health',
          }),
        );
        refreshIcons();
        return;
      }

      renderInto(
        resultsHost,
        el(
          'div',
          { class: 'results-meta' },
          el('span', { class: 'results-count' }, el('strong', {}, String(items.length)), ` beer${items.length === 1 ? '' : 's'} · ${style === 'stout' ? 'Stouts' : 'Ales'} · SampleAPIs (community dataset)`),
        ),
        entityGrid(items, { entity: 'beer' }),
        el(
          'div',
          { class: 'notice is-info', style: { marginTop: 'var(--space-5)' } },
          icon('info'),
          el(
            'span',
            {},
            'This dataset provides name, price and community rating only. ABV, brewery and tasting notes are not supplied — so they are not shown, and never invented.',
          ),
        ),
      );
      if (notice) resultsHost.prepend(notice);
      refreshIcons();
      mountReveal(ctx, resultsHost.querySelector('.grid-cards'));
    } catch (err) {
      if (err?.name === 'AbortError') return;
      renderInto(resultsHost, errorState({ error: err, onRetry: () => load() }));
      refreshIcons();
    }
  }

  load();
  refreshIcons();
  return root;
}
