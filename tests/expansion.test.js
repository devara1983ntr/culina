/**
 * CULINA — Expansion test suite: validation utils, settings, history,
 * shopping-list state, planner snack meal, and structural route audits.
 */
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { makeLocalStorage } from './helpers/setup-storage.js'; // MUST be first

import {
  cleanText,
  isValidQuery,
  addUnique,
  parseQuantity,
  validationMessage,
  INPUT_LIMITS,
} from '../js/utils/validate.js';
import { settingsService } from '../js/services/settings.js';
import { history } from '../js/services/history.js';
import { shoppingList } from '../js/services/shoppingList.js';
import { planner } from '../js/services/planner.js';
import { DAYS, MEALS } from '../js/constants.js';
import { routes } from '../js/router.js';
import { pageLoaders } from '../js/app.js';
import { userMessage, ApiError, ErrorType } from '../js/api/errors.js';

beforeEach(() => {
  window.localStorage.clear();
});

/* --------------------------------------------------------- validate */

test('cleanText trims, collapses whitespace and caps length', () => {
  assert.equal(cleanText('  chicken   breast '), 'chicken breast');
  assert.equal(cleanText('a'.repeat(50), { max: 10 }), 'a'.repeat(10));
  assert.equal(cleanText(null), '');
  assert.equal(cleanText(42), '42');
});

test('isValidQuery rejects blank and whitespace-only input', () => {
  assert.equal(isValidQuery('margarita'), true);
  assert.equal(isValidQuery('   '), false);
  assert.equal(isValidQuery(''), false);
});

test('addUnique blocks duplicates, empties and over-limit adds', () => {
  let out = addUnique([], 'Rice');
  assert.deepEqual(out.list, ['Rice']);
  assert.equal(out.added, true);

  out = addUnique(out.list, 'rice');
  assert.equal(out.added, false);
  assert.equal(out.reason, 'duplicate');

  out = addUnique(out.list, '   ');
  assert.equal(out.reason, 'empty');

  let big = [];
  for (let i = 0; i < INPUT_LIMITS.list; i++) big.push(`item ${i}`);
  const capped = addUnique(big, 'one more', { max: INPUT_LIMITS.list });
  assert.equal(capped.reason, 'limit');
  assert.equal(capped.list.length, INPUT_LIMITS.list);
});

test('parseQuantity accepts sane values and rejects garbage/negatives', () => {
  assert.equal(parseQuantity('2'), 2);
  assert.equal(parseQuantity('1,5'), 1.5);
  assert.equal(parseQuantity('-3'), null);
  assert.equal(parseQuantity('abc'), null);
  assert.equal(parseQuantity(''), null);
  assert.equal(parseQuantity('1e9'), null);
});

test('validationMessage maps reasons to friendly copy', () => {
  assert.match(validationMessage('duplicate', { what: 'ingredient' }), /already/i);
  assert.match(validationMessage('empty', { what: 'ingredient' }), /enter/i);
  assert.match(validationMessage('limit'), /maximum/i);
});

/* --------------------------------------------------------- settings */

test('settings sanitize corrupted values to safe defaults', () => {
  window.localStorage.setItem('culina:v1:settings', JSON.stringify({ theme: 'neon', historyEnabled: 'yes', largerText: 5 }));
  const s = settingsService.get();
  assert.equal(s.theme, 'system');
  assert.equal(s.historyEnabled, true);
  assert.equal(s.largerText, false);
});

test('settings set + persist + read back', () => {
  settingsService.set({ theme: 'dark', largerText: true });
  assert.deepEqual(settingsService.get(), { theme: 'dark', historyEnabled: true, largerText: true });
});

test('settings cycleTheme walks light → dark → system → light', () => {
  settingsService.set({ theme: 'light' });
  assert.equal(settingsService.cycleTheme(), 'dark');
  assert.equal(settingsService.cycleTheme(), 'system');
  assert.equal(settingsService.cycleTheme(), 'light');
});

test('settings appliedTheme never returns "system"', () => {
  settingsService.set({ theme: 'system' });
  assert.match(settingsService.appliedTheme(), /^(light|dark)$/);
});

/* ---------------------------------------------------------- history */

test('history records, dedupes and caps searches', () => {
  assert.equal(history.recordSearch('chicken'), true);
  history.recordSearch('pasta');
  history.recordSearch('CHICKEN'); // dedupe (case-insensitive)
  assert.equal(history.searches().length, 2);
  assert.equal(history.searches()[0].q, 'CHICKEN');
  for (let i = 0; i < 30; i++) history.recordSearch(`q${i}`);
  assert.ok(history.searches().length <= 12);
});

test('history records views with most-recent-first ordering', () => {
  history.recordView({ id: 'mealdb:1', entity: 'recipe', title: 'Soup', route: '/recipe/mealdb:1' });
  history.recordView({ id: 'mealdb:2', entity: 'recipe', title: 'Salad', route: '/recipe/mealdb:2' });
  history.recordView({ id: 'mealdb:1', entity: 'recipe', title: 'Soup', route: '/recipe/mealdb:1' });
  const views = history.views();
  assert.equal(views.length, 2);
  assert.equal(views[0].id, 'mealdb:1');
});

test('history removeSearch and clear work', () => {
  history.recordSearch('curry');
  history.recordSearch('stew');
  history.removeSearch('curry');
  assert.equal(history.searches().length, 1);
  history.clear({ what: 'searches' });
  assert.equal(history.searches().length, 0);
  history.recordView({ id: 'x', entity: 'recipe', title: 'X', route: '/recipe/x' });
  history.clear();
  assert.equal(history.counts().searches + history.counts().views, 0);
});

test('history respects the disable setting', () => {
  settingsService.set({ historyEnabled: false });
  assert.equal(history.recordSearch('nope'), false);
  assert.equal(history.recordView({ id: 'n', entity: 'recipe', title: 'N', route: '/n' }), false);
  settingsService.set({ historyEnabled: true });
  assert.equal(history.recordSearch('yes'), true);
});

/* ----------------------------------------------------- shoppingList */

const entry = (name) => ({ name, display: '2 cups', recipes: ['A'], matchedCount: 1 });

test('shoppingList check state persists and toggles', () => {
  const e = entry('Rice');
  assert.equal(shoppingList.isChecked(e), false);
  shoppingList.toggleChecked(e);
  assert.equal(shoppingList.isChecked(e), true);
  shoppingList.toggleChecked(e);
  assert.equal(shoppingList.isChecked(e), false);
});

test('shoppingList remove + restore round-trip', () => {
  const e = entry('Rice');
  shoppingList.remove(e);
  assert.equal(shoppingList.isRemoved(e), true);
  shoppingList.restore(e);
  assert.equal(shoppingList.isRemoved(e), false);
});

test('shoppingList addManual validates duplicates, empties and caps', () => {
  assert.equal(shoppingList.addManual('Paper towels').added, true);
  assert.equal(shoppingList.addManual('paper towels').reason, 'duplicate');
  assert.equal(shoppingList.addManual('   ').reason, 'empty');
  shoppingList.clearAll();
});

test('shoppingList manual key is case/diacritic-insensitive', () => {
  shoppingList.addManual('Rice');
  assert.equal(shoppingList.addManual('RICE').reason, 'duplicate');
  assert.equal(shoppingList.addManual('Crème Fraîche').added, true);
  assert.equal(shoppingList.addManual('creme fraiche').reason, 'duplicate');
  shoppingList.clearAll();
});

/* ---------------------------------------------------------- planner */

test('planner supports the snack meal slot alongside breakfast/lunch/dinner', () => {
  assert.deepEqual(MEALS.map((m) => m.id), ['breakfast', 'lunch', 'dinner', 'snack']);
  assert.equal(planner.add('monday', 'snack', { id: 's1', title: 'Granola' }), true);
  assert.equal(planner.slot('monday', 'snack').length, 1);
  assert.equal(planner.itemCount(), 1);
});

test('planner week covers all seven days', () => {
  assert.equal(DAYS.length, 7);
});

/* ---------------------------------------------------- route audits */

test('every route resolves to a lazy page loader (and vice versa)', () => {
  assert.ok(routes.length >= 30, 'expected the expanded route table');
  const missing = routes.filter((r) => !pageLoaders[r.page]);
  assert.deepEqual(missing, []);
  const pages = new Set(routes.map((r) => r.page));
  const unused = Object.keys(pageLoaders).filter((k) => !pages.has(k));
  assert.deepEqual(unused, []);
});

test('deep-link detail routes exist for every entity family', () => {
  const paths = routes.map((r) => r.path);
  for (const expected of [
    '/recipe/:id',
    '/ingredient/:source/:id',
    '/cocktail/:id',
    '/product/:source/:id',
    '/beer/:style/:id',
    '/brewery/:name',
    '/shopping-list',
    '/settings',
    '/history',
    '/privacy',
    '/terms',
    '/accessibility',
    '/offline',
    '/categories',
    '/cuisines',
    '/food',
  ]) {
    assert.ok(paths.includes(expected), `missing route ${expected}`);
  }
});

/* ------------------------------------------------- error messaging */

test('userMessage maps every error type to friendly copy (no stack traces)', () => {
  const cases = [
    [ErrorType.TIMEOUT, /too long/i],
    [ErrorType.NETWORK, /reach/i],
    [ErrorType.RATE_LIMIT, /limit/i],
    [ErrorType.AUTH, /credentials/i],
    [ErrorType.INVALID_RESPONSE, /unexpected/i],
    [ErrorType.HTTP, /error|find/i],
  ];
  for (const [type, pattern] of cases) {
    const message = userMessage(new ApiError({ type, message: 'raw internal detail http://x?secret=1' }));
    assert.match(message, pattern, `friendly copy for ${type}`);
    assert.ok(!message.includes('http'), `no URLs leak for ${type}`);
  }
});
