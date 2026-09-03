/**
 * CULINA — Versioned, privacy-safe local persistence.
 * - All data stays on the device (PRD §48).
 * - Keys are namespaced `culina:v1:*` with migration support (PRD §53).
 * - Falls back to an in-memory Map when localStorage is unavailable
 *   (private mode, sandboxed iframes, tests).
 */
import { STORAGE_KEYS } from './constants.js';

const memory = new Map();
let usable = null;

function backend() {
  if (usable !== null) return usable;
  try {
    const probe = '__culina_probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    usable = true;
  } catch {
    usable = false;
  }
  return usable;
}

function ls() {
  return backend() ? window.localStorage : null;
}

export function read(key, fallback = null) {
  try {
    const store = ls();
    const raw = store ? store.getItem(key) : memory.get(key);
    if (raw === null || raw === undefined) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function write(key, value) {
  const raw = JSON.stringify(value);
  const store = ls();
  if (store) {
    try {
      store.setItem(key, raw);
      return true;
    } catch {
      // Quota exceeded or serialization issues — degrade to memory.
    }
  }
  memory.set(key, raw);
  return false;
}

export function remove(key) {
  const store = ls();
  if (store) store.removeItem(key);
  memory.delete(key);
}

/**
 * Migration v0 → v1: earlier prototypes used unversioned keys.
 * Moves any recognizable legacy shape forward; never deletes unknown data.
 */
export function migrate() {
  const legacy = [
    ['culina:favorites', STORAGE_KEYS.favorites],
    ['culina:planner', STORAGE_KEYS.planner],
    ['culina:settings', STORAGE_KEYS.settings],
  ];
  let migrated = 0;
  for (const [from, to] of legacy) {
    const store = ls();
    if (!store) continue;
    const raw = store.getItem(from);
    if (raw !== null && store.getItem(to) === null) {
      store.setItem(to, raw);
      store.removeItem(from);
      migrated++;
    }
  }
  return migrated;
}

/** Test hook: wipe the in-memory fallback. */
export function __resetMemory() {
  memory.clear();
}
