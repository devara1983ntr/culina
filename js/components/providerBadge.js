/**
 * CULINA — Data-source transparency components (PRD §62–§63).
 * Every result can expose which provider powers it, with live status.
 */
import { el, icon } from '../utils/dom.js';
import { refreshIcons } from '../utils/icons.js';
import { getRecord, snapshot } from '../api/health.js';
import { providerLabel, CLASSIFICATION_LABELS, STATUS_LABELS } from '../api/registry.js';
import { formatMs, safeUrl } from '../utils/format.js';

/** Compact badge shown on cards & results. */
export function providerBadge(providerId, { showStatus = true } = {}) {
  const record = getRecord(providerId);
  const name = record?.name || providerLabel(providerId);
  const status = record?.status;
  const statusClass =
    showStatus && (status === 'degraded' || status === 'unavailable') ? `is-${status}` : '';
  return el(
    'span',
    {
      class: `provider-badge ${statusClass}`.trim(),
      title: record ? `Source: ${name} — ${STATUS_LABELS[status] || status}` : `Source: ${name}`,
    },
    showStatus ? el('span', { class: 'badge-dot', 'aria-hidden': 'true' }) : null,
    name,
  );
}

/** Full provider panel — detail pages, about, health. */
export function sourcePanel(providerId, { note } = {}) {
  const record = getRecord(providerId);
  if (!record) return null;

  const docsUrl = safeUrl(record.docsUrl);
  const attributionUrl = safeUrl(record.attributionUrl);

  return el(
    'dl',
    { class: 'source-panel' },
    el('dt', {}, 'Data source'),
    el('dd', {}, el('strong', {}, record.name), docsUrl ? el('a', { class: 'text-link', href: docsUrl, target: '_blank', rel: 'noopener noreferrer' }, ' documentation') : null),
    el('dt', {}, 'Classification'),
    el('dd', {}, CLASSIFICATION_LABELS[record.classification] || record.classification),
    el('dt', {}, 'Authentication'),
    el('dd', {}, record.auth),
    el('dt', {}, 'Status'),
    el(
      'dd',
      {},
      `${STATUS_LABELS[record.status] || record.status}${record.latencyMs != null ? ` · ${formatMs(record.latencyMs)} last response` : ''}`,
    ),
    el('dt', {}, 'Rate limits'),
    el('dd', {}, record.rateLimit || '—'),
    el('dt', {}, 'License & attribution'),
    el('dd', {}, record.license || '—', attributionUrl ? el('a', { class: 'text-link', href: attributionUrl, target: '_blank', rel: 'noopener noreferrer' }, ` ${record.attribution}`) : record.attribution ? ` ${record.attribution}` : ''),
    el('dt', {}, 'Verified'),
    el('dd', {}, `${record.verifiedAt} — ${record.verifiedHow}`),
    note ? el('dt', {}, 'Note') : null,
    note ? el('dd', {}, note) : null,
  );
}

/** Row of all enabled provider badges (home page strip, about page). */
export function providerStrip() {
  const enabled = snapshot().filter((p) => p.enabled);
  return el(
    'div',
    { class: 'provider-strip' },
    ...enabled.map((p) => providerBadge(p.id)),
    el(
      'a',
      { class: 'text-link', href: '/health', style: { fontSize: 'var(--text-sm)' } },
      'API health →',
    ),
  );
}

export function providerStatusIcon(status) {
  const map = {
    operational: { icon: 'circle-check', cls: 'status-operational' },
    degraded: { icon: 'alert-triangle', cls: 'status-degraded' },
    unavailable: { icon: 'circle-x', cls: 'status-unavailable' },
    'config-required': { icon: 'info', cls: 'status-config' },
    'browser-restricted': { icon: 'info', cls: 'status-config' },
    disabled: { icon: 'ban', cls: 'status-disabled' },
  };
  const conf = map[status] || map.disabled;
  return el('span', { class: `health-status ${conf.cls}` }, icon(conf.icon), STATUS_LABELS[status] || status);
}

export function refreshProviderIcons() {
  refreshIcons();
}
