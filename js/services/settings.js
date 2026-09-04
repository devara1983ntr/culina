/**
 * CULINA — Settings service (PRD: appearance, accessibility, data controls).
 * Single source of truth for user preferences, persisted under
 * `culina:v1:settings` with safe defaults and graceful corruption handling.
 *
 * Theme model: 'light' | 'dark' | 'system'.
 *  - 'system' follows `prefers-color-scheme` live (matchMedia listener).
 *  - The applied value is always reflected on <html data-theme> so the
 *    rest of the app (and the boot snippet in index.html) stays simple.
 */
import { read, write } from '../storage.js';
import { STORAGE_KEYS } from '../constants.js';
import { appState } from '../state.js';

const DEFAULTS = {
  theme: 'system',
  historyEnabled: true,
  largerText: false,
};

function sanitize(raw) {
  const data = raw && typeof raw === 'object' ? raw : {};
  const out = { ...DEFAULTS };
  if (data.theme === 'light' || data.theme === 'dark' || data.theme === 'system') out.theme = data.theme;
  if (typeof data.historyEnabled === 'boolean') out.historyEnabled = data.historyEnabled;
  if (typeof data.largerText === 'boolean') out.largerText = data.largerText;
  return out;
}

function persist(settings) {
  write(STORAGE_KEYS.settings, settings);
}

let media = null;

function systemTheme() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function apply(settings) {
  if (typeof document === 'undefined') return;
  const applied = settings.theme === 'system' ? systemTheme() : settings.theme;
  document.documentElement.dataset.theme = applied;
  document.documentElement.dataset.textSize = settings.largerText ? 'large' : 'standard';
  // Both media-qualified theme-color metas are set to the applied color so
  // manual overrides win regardless of which one the browser picks.
  const color = applied === 'dark' ? '#0b0f19' : '#fff7e6';
  document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => meta.setAttribute('content', color));
  appState.set({ theme: applied, settingsVersion: (appState.get().settingsVersion || 0) + 1 });
}

/** React to OS theme changes while in 'system' mode. */
function watchSystem() {
  if (media || typeof window === 'undefined' || !window.matchMedia) return;
  media = window.matchMedia('(prefers-color-scheme: dark)');
  const onChange = () => {
    const current = settingsService.get();
    if (current.theme === 'system') apply(current);
  };
  if (media.addEventListener) media.addEventListener('change', onChange);
  else if (media.addListener) media.addListener(onChange); // old Safari
}

export const settingsService = {
  get() {
    return sanitize(read(STORAGE_KEYS.settings, null));
  },

  set(patch) {
    const next = sanitize({ ...this.get(), ...patch });
    persist(next);
    apply(next);
    return next;
  },

  /** Cycle light → dark → system (used by the compact header toggle). */
  cycleTheme() {
    const order = ['light', 'dark', 'system'];
    const current = this.get().theme;
    const next = order[(order.indexOf(current) + 1) % order.length];
    this.set({ theme: next });
    return next;
  },

  /** Applied (resolved) theme — never 'system'. */
  appliedTheme() {
    const s = this.get();
    return s.theme === 'system' ? systemTheme() : s.theme;
  },

  reset() {
    persist({ ...DEFAULTS });
    apply({ ...DEFAULTS });
  },

  /** Boot hook — call once from app boot. */
  init() {
    apply(this.get());
    watchSystem();
  },
};

export default settingsService;
