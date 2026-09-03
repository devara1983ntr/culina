/**
 * CULINA — Lightweight application state (PRD §51).
 * A predictable subscribe/set store; no state-management library.
 * Most pages render on demand; the store carries only cross-cutting signals.
 */

export function createStore(initial) {
  let state = { ...initial };
  const subscribers = new Set();

  return {
    get: () => state,
    set(patch) {
      const next = typeof patch === 'function' ? patch(state) : patch;
      state = { ...state, ...next };
      subscribers.forEach((fn) => {
        try {
          fn(state);
        } catch (err) {
          console.error('[store] subscriber failed', err);
        }
      });
    },
    subscribe(fn) {
      subscribers.add(fn);
      return () => subscribers.delete(fn);
    },
  };
}

export const appState = createStore({
  theme: (typeof document !== 'undefined' && document.documentElement.dataset.theme) || 'light',
  route: { page: 'home', path: '/' },
  favoritesVersion: 0,
  plannerVersion: 0,
  healthVersion: 0,
  online: typeof navigator === 'undefined' ? true : navigator.onLine,
});
