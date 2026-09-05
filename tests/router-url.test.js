/**
 * CULINA — Router URL-state tests (v1.4.0 regression suite).
 *
 * Guards the GitHub Pages sub-path contract: every in-app URL write
 * (replaceUrl / navigate) must stay anchored under basePath(). A bare
 * history.replaceState('/discover?x') silently escapes the deployment
 * root on project sites (https://user.github.io/culina/) — this suite
 * makes that failure mode un-shippable.
 */
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

/* Minimal DOM stubs — node:test runs each file in its own process, so
   these never leak into the other suites. */
const calls = [];
globalThis.history = {
  state: { scroll: 0 },
  replaceState: (...args) => calls.push(['replaceState', ...args]),
  pushState: (...args) => calls.push(['pushState', ...args]),
};

let manifestHref = null;
globalThis.document = {
  querySelector: (sel) =>
    sel === 'link[rel="manifest"]' && manifestHref !== null
      ? { getAttribute: () => manifestHref }
      : null,
};

globalThis.window = {
  localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
  location: { origin: 'https://devara1983ntr.github.io', pathname: '/culina/discover', search: '' },
  dispatchEvent: () => {},
  addEventListener: () => {},
  scrollTo: () => {},
  matchMedia: () => ({ matches: false }),
};
globalThis.location = globalThis.window.location;
globalThis.PopStateEvent = class PopStateEvent { constructor(type) { this.type = type; } };

const { replaceUrl, basePath, navigate, matchRoute } = await import('../js/router.js');

beforeEach(() => {
  calls.length = 0;
});

test('basePath is empty at a domain root (no manifest link)', () => {
  manifestHref = null;
  assert.equal(basePath(), '');
});

test('basePath derives the Pages sub-path from the manifest link', () => {
  manifestHref = '/culina/manifest.webmanifest';
  assert.equal(basePath(), '/culina');
});

test('replaceUrl anchors query-state writes under the deployment base', () => {
  manifestHref = '/culina/manifest.webmanifest';
  replaceUrl('/discover?entity=beers&page=2');
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], 'replaceState');
  assert.equal(calls[0][3], '/culina/discover?entity=beers&page=2');
});

test('replaceUrl normalizes a missing leading slash', () => {
  manifestHref = '/culina/manifest.webmanifest';
  replaceUrl('beer?style=stout');
  assert.equal(calls[0][3], '/culina/beer?style=stout');
});

test('replaceUrl preserves the existing history state (no scroll loss)', () => {
  manifestHref = '/culina/manifest.webmanifest';
  replaceUrl('/favorites?tab=beers');
  assert.deepEqual(calls[0][1], { scroll: 0 });
});

test('navigate pushes base-anchored URLs', () => {
  manifestHref = '/culina/manifest.webmanifest';
  navigate('/planner');
  assert.equal(calls[0][0], 'pushState');
  assert.equal(calls[0][3], '/culina/planner');
});

test('matchRoute resolves app paths stripped of the base', () => {
  const m = matchRoute('/recipe/52772');
  assert.equal(m.page, 'recipe');
  assert.equal(m.params.id, '52772');
  assert.equal(matchRoute('/nope'), null);
});
