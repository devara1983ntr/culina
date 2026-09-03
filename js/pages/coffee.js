/**
 * CULINA — Coffee explorer (PRD §16): hot & iced guides from SampleAPIs.
 */
import { el, icon } from '../utils/dom.js';
import { refreshIcons } from '../utils/icons.js';
import { applyMeta } from '../seo.js';
import { coffee } from '../api/adapters/index.js';
import { entityGrid } from '../components/cards.js';
import { chipRow } from '../components/filters.js';
import { skeletonGrid, errorState, emptyState, renderInto, partialFailureNotice } from '../components/states.js';
import { pageHeader, mountReveal } from './shared.js';

export async function render(ctx) {
  let variant = ctx.query.tab === 'iced' ? 'iced' : 'hot';

  applyMeta({
    title: 'Coffee',
    description: 'Hot and iced coffee guides — from black coffee and espresso drinks to affogato and cold brew, via the SampleAPIs community dataset.',
    path: `/coffee?tab=${variant}`,
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
        title: 'Coffee',
        lead: 'Brewing guides for hot and iced coffee — each card carries the full ingredient list and the story behind the drink.',
      }),
      el(
        'div',
        { class: 'filter-bar' },
        chipRow({
          items: [{ id: 'hot', label: 'Hot' }, { id: 'iced', label: 'Iced' }],
          value: variant,
          onSelect: (id) => {
            variant = id;
            history.replaceState(history.state, '', `/coffee?tab=${id}`);
            applyMeta({ title: 'Coffee', path: `/coffee?tab=${id}` });
            load();
          },
          ariaLabel: 'Coffee type',
        }),
      ),
      resultsHost,
    ),
  );

  async function load() {
    renderInto(resultsHost, skeletonGrid(6));
    try {
      const items = variant === 'iced' ? await coffee.iced({ signal: ctx.signal }) : await coffee.hot({ signal: ctx.signal });
      if (!items.length) {
        renderInto(
          resultsHost,
          emptyState({
            icon: 'coffee',
            title: 'No guides available',
            message: 'The coffee dataset didn’t return any drinks — check API Health for the current status.',
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
          el('span', { class: 'results-count' }, el('strong', {}, String(items.length)), ` guide${items.length === 1 ? '' : 's'} · ${variant === 'iced' ? 'Iced' : 'Hot'} · SampleAPIs (community dataset)`),
        ),
        entityGrid(items, { entity: 'coffee' }),
      );
      refreshIcons();
      mountReveal(ctx, resultsHost.querySelector('.grid-cards'));
    } catch (err) {
      if (err?.name === 'AbortError') return;
      renderInto(
        resultsHost,
        errorState({ error: err, onRetry: () => load() }),
        partialFailureNotice([{ provider: 'sampleapis-coffee', label: 'SampleAPIs Coffee', message: err?.message }]),
      );
      refreshIcons();
    }
  }

  load();
  refreshIcons();
  return root;
}
