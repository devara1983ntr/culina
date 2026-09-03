/**
 * CULINA — Application-level response cache (PRD §42).
 * - In-memory Map with TTL + bounded size (oldest evicted first).
 * - Optional sessionStorage mirror so a refresh reuses safe GET responses.
 * - Never stores credentials (none exist in this app) or non-GET results.
 */

const MAX_ENTRIES = 160;
const MAX_MIRROR_CHARS = 220_000; // don't blow the sessionStorage quota
const SESSION_PREFIX = 'culina:v1:cache:';

const mem = new Map(); // key → { value, expires }

let sessionUsable;
function sessionOK() {
  if (sessionUsable !== undefined) return sessionUsable;
  try {
    window.sessionStorage.setItem('__culina_probe__', '1');
    window.sessionStorage.removeItem('__culina_probe__');
    sessionUsable = true;
  } catch {
    sessionUsable = false;
  }
  return sessionUsable;
}

const stats = { hits: 0, misses: 0 };

function evictIfNeeded() {
  while (mem.size > MAX_ENTRIES) {
    const oldest = mem.keys().next().value;
    mem.delete(oldest);
    if (sessionOK()) {
      try {
        window.sessionStorage.removeItem(SESSION_PREFIX + oldest);
      } catch {
        /* ignore */
      }
    }
  }
}

export const cache = {
  get(key) {
    const entry = mem.get(key);
    if (entry) {
      if (entry.expires > Date.now()) {
        stats.hits++;
        return entry.value;
      }
      mem.delete(key);
    } else if (sessionOK()) {
      try {
        const raw = window.sessionStorage.getItem(SESSION_PREFIX + key);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed.expires > Date.now()) {
            stats.hits++;
            mem.set(key, parsed); // promote to memory
            return parsed.value;
          }
          window.sessionStorage.removeItem(SESSION_PREFIX + key);
        }
      } catch {
        /* corrupt entry — treat as miss */
      }
    }
    stats.misses++;
    return undefined;
  },

  set(key, value, ttlMs = 5 * 60_000) {
    const entry = { value, expires: Date.now() + ttlMs };
    mem.set(key, entry);
    evictIfNeeded();
    if (sessionOK()) {
      try {
        const raw = JSON.stringify(entry);
        if (raw.length <= MAX_MIRROR_CHARS) window.sessionStorage.setItem(SESSION_PREFIX + key, raw);
      } catch {
        /* quota — memory cache still works */
      }
    }
  },

  delete(key) {
    mem.delete(key);
    if (sessionOK()) {
      try {
        window.sessionStorage.removeItem(SESSION_PREFIX + key);
      } catch {
        /* ignore */
      }
    }
  },

  clear() {
    mem.clear();
    if (sessionOK()) {
      try {
        Object.keys(window.sessionStorage)
          .filter((k) => k.startsWith(SESSION_PREFIX))
          .forEach((k) => window.sessionStorage.removeItem(k));
      } catch {
        /* ignore */
      }
    }
  },

  stats() {
    const total = stats.hits + stats.misses;
    return { ...stats, hitRate: total === 0 ? null : stats.hits / total, size: mem.size };
  },
};
