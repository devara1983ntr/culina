/**
 * CULINA — API health telemetry (PRD §36–§39).
 * Passive: the HTTP client records request outcomes; nothing polls providers.
 * Active: an explicit diagnostic (the “Test” button) exercises one cheap,
 * documented endpoint per provider on demand.
 * A compact snapshot persists locally so status survives refreshes.
 */
import { read, write } from '../storage.js';
import { getProvider, providers } from './registry.js';
import { appState } from '../state.js';

const PERSIST_KEY = 'culina:v1:health';

/** id → { status, latencyMs, lastCheckedAt, lastOkAt, lastError, checks } */
const records = new Map();

function seed() {
  const persisted = read(PERSIST_KEY, {});
  for (const provider of providers) {
    const prior = persisted[provider.id] || {};
    records.set(provider.id, {
      status: prior.status || provider.initialStatus,
      latencyMs: prior.latencyMs ?? null,
      lastCheckedAt: prior.lastCheckedAt || null,
      lastOkAt: prior.lastOkAt || null,
      lastError: prior.lastError || null,
      checks: prior.checks || 0,
    });
  }
}
seed();

function persist() {
  const snapshot = Object.fromEntries(records.entries());
  write(PERSIST_KEY, snapshot);
}

function bump() {
  appState.set((s) => ({ healthVersion: s.healthVersion + 1 }));
}

function statusForError(err) {
  if (!err) return 'operational';
  if (err.type === 'PROVIDER_UNAVAILABLE' || err.type === 'AUTH_ERROR') return 'config-required';
  return 'degraded';
}

/** Called by the API client after every completed request. */
export function recordRequest(providerId, { ok, ms = null, status = null, error = null }) {
  const provider = getProvider(providerId);
  if (!provider) return;
  const record = records.get(providerId);
  if (!record) return;

  record.checks++;
  record.lastCheckedAt = new Date().toISOString();
  record.latencyMs = ms ?? record.latencyMs;

  if (ok) {
    record.status = 'operational';
    record.lastOkAt = record.lastCheckedAt;
    record.lastError = null;
  } else {
    // Never overwrite a hard configuration/unavailable state with a soft error.
    const next = statusForError(error);
    if (!(record.status === 'config-required' && next === 'degraded')) {
      record.status = next;
    }
    record.lastError = {
      type: error?.type || 'UNKNOWN_ERROR',
      message: error?.message || 'Request failed',
      status: error?.status ?? status,
    };
  }
  persist();
  bump();
}

export function getRecord(providerId) {
  const provider = getProvider(providerId);
  if (!provider) return null;
  return { ...provider, ...(records.get(providerId) || {}) };
}

export function snapshot() {
  return providers.map((p) => ({ ...p, ...(records.get(p.id) || {}) }));
}

export function statusCounts() {
  const counts = {};
  for (const p of providers) {
    const status = records.get(p.id)?.status || p.initialStatus;
    counts[status] = (counts[status] || 0) + 1;
  }
  return counts;
}

/**
 * Run an on-demand diagnostic. `adapterImpl` is the adapter module
 * ({ diagnostic: async () => … }) — wiring happens at the call site to keep
 * this module free of adapter imports (no circular dependencies).
 */
export async function runDiagnostic(providerId, adapterImpl) {
  const provider = getProvider(providerId);
  if (!provider) throw new Error(`Unknown provider ${providerId}`);
  if (!adapterImpl || typeof adapterImpl.diagnostic !== 'function') {
    recordRequest(providerId, {
      ok: false,
      error: { type: 'PROVIDER_UNAVAILABLE', message: 'No adapter wired for this provider' },
    });
    return getRecord(providerId);
  }
  const started = performance.now();
  try {
    await adapterImpl.diagnostic();
    recordRequest(providerId, { ok: true, ms: Math.round(performance.now() - started) });
  } catch (err) {
    recordRequest(providerId, {
      ok: false,
      ms: Math.round(performance.now() - started),
      status: err?.status ?? null,
      error: err,
    });
  }
  return getRecord(providerId);
}
