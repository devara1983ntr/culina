/**
 * Test helper — MUST be the first import in any test file that touches
 * storage-backed services. js/api/health.js restores telemetry during module
 * evaluation (before the test file's body runs), which would otherwise cache
 * the in-memory storage backend forever. Importing this module first makes
 * window.localStorage available to the whole module graph.
 */
export function makeLocalStorage() {
  const store = new Map();
  return {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
    _dump: () => Object.fromEntries(store),
  };
}

globalThis.window = { localStorage: makeLocalStorage() };
