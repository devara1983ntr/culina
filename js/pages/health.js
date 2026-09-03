/**
 * CULINA — API Health Center (PRD §36–§37).
 * Passive telemetry + on-demand diagnostics. No background polling.
 */
import { el, icon } from '../utils/dom.js';
import { refreshIcons } from '../utils/icons.js';
import { applyMeta } from '../seo.js';
import { snapshot, statusCounts, runDiagnostic, getRecord } from '../api/health.js';
import { adapterFor } from '../api/adapters/index.js';
import { providerStatusIcon } from '../components/providerBadge.js';
import { pageHeader } from './shared.js';
import { formatMs, relativeTime, safeUrl } from '../utils/format.js';
import { CLASSIFICATION_LABELS, STATUS_LABELS } from '../api/registry.js';
import { appState } from '../state.js';

export async function render(ctx) {
  applyMeta({
    title: 'API Health',
    description: 'Live status, latency and classification for every food & drink data provider CULINA integrates — verified, honest, on-demand.',
    path: '/health',
  });

  const tableHost = el('div');
  const summaryHost = el('div', { class: 'health-summary' });

  const root = el(
    'div',
    { class: 'page' },
    el(
      'div',
      { class: 'container' },
      pageHeader({
        overline: 'Diagnostics & transparency',
        title: 'API Health',
        lead: 'Statuses come from real request telemetry and on-demand checks — CULINA never polls providers in the background. Every classification was verified on 2026-09-02.',
      }),
      summaryHost,
      tableHost,
      el(
        'div',
        { class: 'notice is-info', style: { marginTop: 'var(--space-5)' } },
        icon('info'),
        el(
          'span',
          {},
          'Failed providers degrade gracefully: their sections show a clear message while the rest of the app keeps working. Nothing is ever faked to hide an outage.',
        ),
      ),
    ),
  );

  function renderSummary() {
    const counts = statusCounts();
    const cards = [
      { label: 'Operational', value: counts.operational || 0, cls: 'status-operational' },
      { label: 'Degraded', value: counts.degraded || 0, cls: 'status-degraded' },
      { label: 'Config required', value: counts['config-required'] || 0, cls: 'status-config' },
      { label: 'Offline', value: counts.unavailable || 0, cls: 'status-unavailable' },
      { label: 'Disabled', value: counts.disabled || 0, cls: 'status-disabled' },
      { label: 'Providers total', value: snapshot().length, cls: '' },
    ];
    summaryHost.replaceChildren(
      ...cards.map((card) =>
        el(
          'div',
          { class: 'stat-block card', style: { padding: 'var(--space-4)' } },
          el('span', { class: `stat-value ${card.cls}` }, String(card.value)),
          el('span', { class: 'stat-label' }, card.label),
        ),
      ),
    );
  }

  function providerRow(provider) {
    const adapter = adapterFor(provider.id);
    const docsUrl = safeUrl(provider.docsUrl);
    const detailsRow = el('tr', { hidden: '' });
    const toggle = el(
      'button',
      {
        class: 'btn btn-ghost btn-sm',
        type: 'button',
        'aria-expanded': 'false',
        'aria-label': `Details for ${provider.name}`,
      },
      icon('chevron-down'),
    );

    const testButton = adapter
      ? el('button', { class: 'btn btn-secondary btn-sm', type: 'button' }, icon('activity'), 'Test')
      : el('button', { class: 'btn btn-ghost btn-sm', type: 'button', disabled: '' }, '—');

    async function runTest() {
      testButton.disabled = true;
      testButton.replaceChildren(el('span', { class: 'spinner', 'aria-hidden': 'true' }), 'Testing…');
      try {
        await runDiagnostic(provider.id, adapter);
      } finally {
        renderAll();
      }
    }
    testButton.addEventListener('click', runTest);

    const row = el(
      'tr',
      { 'data-provider': provider.id },
      el(
        'td',
        {},
        el('strong', {}, provider.name),
        el('div', { class: 'muted', style: { fontSize: 'var(--text-xs)' } }, provider.categories.join(' · ')),
      ),
      el('td', {}, el('span', { class: 'badge badge-neutral' }, CLASSIFICATION_LABELS[provider.classification] || provider.classification)),
      el('td', { style: { fontSize: 'var(--text-sm)' } }, provider.auth === 'none' ? 'None' : provider.auth),
      el('td', {}, provider.browserCompatible ? el('span', { class: 'badge badge-success' }, 'Browser-ready') : el('span', { class: 'badge badge-warning' }, 'Restricted')),
      el(
        'td',
        {},
        providerStatusIcon(provider.status),
        provider.lastError
          ? el('div', { class: 'muted', style: { fontSize: 'var(--text-xs)', marginTop: '2px' }, title: `${provider.lastError.type}: ${provider.lastError.message}` }, provider.lastError.type.replace(/_/g, ' ').toLowerCase())
          : null,
      ),
      el('td', { class: 'num', style: { fontSize: 'var(--text-sm)' } }, provider.latencyMs != null ? formatMs(provider.latencyMs) : '—'),
      el('td', { style: { fontSize: 'var(--text-sm)' } }, provider.lastCheckedAt ? relativeTime(provider.lastCheckedAt) : 'not yet'),
      el(
        'td',
        { class: 'cluster' },
        testButton,
        toggle,
      ),
    );

    toggle.addEventListener('click', () => {
      const open = !detailsRow.hasAttribute('hidden');
      if (open) {
        detailsRow.setAttribute('hidden', '');
        toggle.setAttribute('aria-expanded', 'false');
      } else {
        detailsRow.removeAttribute('hidden');
        toggle.setAttribute('aria-expanded', 'true');
      }
    });

    detailsRow.append(
      el(
        'td',
        { colspan: '8', style: { background: 'var(--color-surface-2)' } },
        el(
          'div',
          { class: 'stack-3', style: { padding: 'var(--space-2) 0' } },
          el('p', { style: { fontSize: 'var(--text-sm)', maxWidth: '80ch' } }, provider.notes || ''),
          el('p', { class: 'muted', style: { fontSize: 'var(--text-xs)' } },
            `Rate limits: ${provider.rateLimit} · License: ${provider.license}`),
          el('p', { class: 'muted', style: { fontSize: 'var(--text-xs)' } },
            `Verified ${provider.verifiedAt}: ${provider.verifiedHow}`),
          el('p', { class: 'muted', style: { fontSize: 'var(--text-xs)' } },
            provider.lastError ? `Last error: ${provider.lastError.type} — ${provider.lastError.message}` : 'No recorded errors'),
          docsUrl ? el('a', { class: 'text-link', href: docsUrl, target: '_blank', rel: 'noopener noreferrer', style: { fontSize: 'var(--text-sm)' } }, `${provider.name} documentation`) : null,
        ),
      ),
    );

    return [row, detailsRow];
  }

  function renderAll() {
    renderSummary();
    const providers = snapshot();
    tableHost.replaceChildren(
      el(
        'div',
        { class: 'data-table-wrap' },
        el(
          'table',
          { class: 'data-table' },
          el(
            'thead',
            {},
            el(
              'tr',
              {},
              el('th', { scope: 'col' }, 'Provider'),
              el('th', { scope: 'col' }, 'Classification'),
              el('th', { scope: 'col' }, 'Auth'),
              el('th', { scope: 'col' }, 'Browser'),
              el('th', { scope: 'col' }, 'Status'),
              el('th', { scope: 'col' }, 'Latency'),
              el('th', { scope: 'col' }, 'Last check'),
              el('th', { scope: 'col' }, 'Actions'),
            ),
          ),
          el('tbody', {}, ...providers.flatMap(providerRow)),
        ),
      ),
    );
    refreshIcons();
  }

  const unsubscribe = appState.subscribe(() => renderAll());
  ctx.onCleanup(unsubscribe);

  renderAll();
  refreshIcons();
  return root;
}
