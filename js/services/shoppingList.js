/**
 * CULINA — Shopping list state service.
 * Layers persistent UI state over the pure merging in services/shopping.js:
 *   - checked-off items (localStorage, survive reloads)
 *   - manually added items (free text)
 *   - removal of individual merged items
 *
 * Storage: `culina:v1:shopping-list` →
 *   { checked: string[] (ingredient keys), manual: [{name, at}], removed: string[] }
 */
import { read, write } from '../storage.js';
import { STORAGE_KEYS } from '../constants.js';
import { ingredientKey } from '../utils/format.js';
import { cleanText, addUnique } from '../utils/validate.js';

const MAX_MANUAL = 60;

function empty() {
  return { checked: [], manual: [], removed: [] };
}

function sanitize(raw) {
  const data = raw && typeof raw === 'object' ? raw : {};
  const out = empty();
  if (Array.isArray(data.checked)) out.checked = data.checked.filter((k) => typeof k === 'string').slice(0, 300);
  if (Array.isArray(data.manual)) {
    out.manual = data.manual
      .filter((m) => m && typeof m.name === 'string' && m.name.trim())
      .slice(0, MAX_MANUAL)
      .map((m) => ({ name: m.name, at: Number(m.at) || Date.now() }));
  }
  if (Array.isArray(data.removed)) out.removed = data.removed.filter((k) => typeof k === 'string').slice(0, 300);
  return out;
}

function persist(state) {
  write(STORAGE_KEYS.shoppingList, state);
}

export const shoppingList = {
  state() {
    return sanitize(read(STORAGE_KEYS.shoppingList, null));
  },

  /** Key for a merged shopping entry (stable across regenerations). */
  keyFor(entry) {
    return ingredientKey(entry.name) || entry.name.toLowerCase();
  },

  isChecked(entry) {
    return this.state().checked.includes(this.keyFor(entry));
  },

  toggleChecked(entry) {
    const state = this.state();
    const key = this.keyFor(entry);
    const has = state.checked.includes(key);
    state.checked = has ? state.checked.filter((k) => k !== key) : [...state.checked, key];
    // Re-checking an item also un-removes it.
    if (!has) state.removed = state.removed.filter((k) => k !== key);
    persist(state);
    return !has;
  },

  isRemoved(entry) {
    return this.state().removed.includes(this.keyFor(entry));
  },

  remove(entry) {
    const state = this.state();
    const key = this.keyFor(entry);
    if (!state.removed.includes(key)) state.removed.push(key);
    state.checked = state.checked.filter((k) => k !== key);
    persist(state);
  },

  /** Restore an item removed from the current list. */
  restore(entry) {
    const state = this.state();
    state.removed = state.removed.filter((k) => k !== this.keyFor(entry));
    persist(state);
  },

  /**
   * Add a manual item. Returns { added, reason } for inline validation.
   */
  addManual(name) {
    const state = this.state();
    const result = addUnique(state.manual.map((m) => m.name), name, { max: MAX_MANUAL, keyFn: (v) => ingredientKey(v) || v.toLowerCase() });
    if (!result.added) return { added: false, reason: result.reason };
    state.manual = [...state.manual, { name: result.list[result.list.length - 1], at: Date.now() }];
    // Manual additions clear any prior removal of the same ingredient.
    state.removed = state.removed.filter((k) => k !== (ingredientKey(result.list[result.list.length - 1]) || ''));
    persist(state);
    return { added: true, reason: null };
  },

  removeManual(name) {
    const state = this.state();
    const before = state.manual.length;
    state.manual = state.manual.filter((m) => m.name !== name);
    if (state.manual.length !== before) persist(state);
  },

  /** Un-check every checked item (keeps the list itself). */
  resetChecks() {
    const state = this.state();
    state.checked = [];
    persist(state);
  },

  /** Clear everything — checked, manual, removals. */
  clearAll() {
    persist(empty());
  },

  counts(state = this.state()) {
    return {
      manual: state.manual.length,
      checked: state.checked.length,
      removed: state.removed.length,
    };
  },
};

export default shoppingList;
