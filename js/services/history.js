/**
 * CULINA — Local history service (PRD §history: privacy-first).
 * Records recent searches and viewed entities — locally only, capped,
 * disableable from Settings, and never sent anywhere.
 *
 * Storage: `culina:v1:history` → { searches: [...], views: [...] }
 */
import { read, write } from '../storage.js';
import { STORAGE_KEYS } from '../constants.js';
import { settingsService } from './settings.js';
import { cleanText } from '../utils/validate.js';

const MAX_SEARCHES = 12;
const MAX_VIEWS = 24;

function empty() {
  return { searches: [], views: [] };
}

function sanitize(raw) {
  const data = raw && typeof raw === 'object' ? raw : {};
  const out = empty();
  if (Array.isArray(data.searches)) {
    out.searches = data.searches
      .filter((s) => s && typeof s.q === 'string' && s.q.trim())
      .slice(0, MAX_SEARCHES);
  }
  if (Array.isArray(data.views)) {
    out.views = data.views
      .filter((v) => v && typeof v.id === 'string' && typeof v.title === 'string')
      .slice(0, MAX_VIEWS);
  }
  return out;
}

function persist(data) {
  write(STORAGE_KEYS.history, data);
}

let migrated = false;

/** One-time import of pre-history-service recent searches (same shape). */
function migrateLegacy() {
  if (migrated) return;
  migrated = true;
  try {
    const legacy = read(STORAGE_KEYS.recentSearches, null);
    if (Array.isArray(legacy) && legacy.length) {
      const data = sanitize(read(STORAGE_KEYS.history, null));
      const known = new Set(data.searches.map((s) => s.q.toLowerCase()));
      for (const entry of legacy) {
        if (entry?.q && !known.has(String(entry.q).toLowerCase())) {
          data.searches.push({ q: String(entry.q), at: Number(entry.at) || Date.now() });
        }
      }
      data.searches.sort((a, b) => b.at - a.at);
      persist({ ...data, searches: data.searches.slice(0, MAX_SEARCHES) });
    }
  } catch {
    /* corrupted legacy data is simply ignored */
  }
}

export const history = {
  all() {
    migrateLegacy();
    return sanitize(read(STORAGE_KEYS.history, null));
  },

  searches() {
    return this.all().searches;
  },

  views() {
    return this.all().views;
  },

  isEnabled() {
    return settingsService.get().historyEnabled;
  },

  /** Record a search query (deduped, most recent first). */
  recordSearch(query) {
    if (!this.isEnabled()) return false;
    const q = cleanText(query, { max: 100 });
    if (!q) return false;
    const data = this.all();
    data.searches = [{ q, at: Date.now() }, ...data.searches.filter((s) => s.q.toLowerCase() !== q.toLowerCase())].slice(0, MAX_SEARCHES);
    persist(data);
    return true;
  },

  /**
   * Record a viewed entity. Envelope shape mirrors favorites so pages can
   * render history entries without re-fetching.
   */
  recordView({ id, entity, title, subtitle = null, image = null, route }) {
    if (!this.isEnabled() || !id || !title || !route) return false;
    const data = this.all();
    const entry = { id, entity, title, subtitle, image, route, at: Date.now() };
    data.views = [entry, ...data.views.filter((v) => v.id !== id)].slice(0, MAX_VIEWS);
    persist(data);
    return true;
  },

  removeView(id) {
    const data = this.all();
    const before = data.views.length;
    data.views = data.views.filter((v) => v.id !== id);
    if (data.views.length !== before) persist(data);
  },

  removeSearch(q) {
    const data = this.all();
    const before = data.searches.length;
    data.searches = data.searches.filter((s) => s.q !== q);
    if (data.searches.length !== before) persist(data);
  },

  clear({ what = 'all' } = {}) {
    const data = this.all();
    if (what === 'searches') data.searches = [];
    else if (what === 'views') data.views = [];
    else return persist(empty());
    persist(data);
  },

  counts() {
    const data = this.all();
    return { searches: data.searches.length, views: data.views.length };
  },
};

export default history;
