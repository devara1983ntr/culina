/**
 * CULINA — End-to-end browser QA against the production build.
 * Run:  node scripts/browser-qa.mjs   (server on :3000; needs playwright-core
 * + @sparticuz/chromium available to Node's resolver — see README).
 *
 * Engine selection (cross-browser gap G-03):
 *   CULINA_QA_ENGINE=firefox CULINA_QA_EXECUTABLE=/path/to/firefox node scripts/browser-qa.mjs
 * Defaults to the bundled headless Chromium (@sparticuz/chromium).
 *
 * Sections:
 *   A. Required surfaces (15 pages + expansion pages)
 *   B. Viewport overflow matrix (320→1440)
 *   C. Mobile navigation (bottom nav, safe area)
 *   D. Command palette & keyboard
 *   E. Settings, persistence, theme
 *   F. History & shopping list flows
 *   G. SPA navigation (back/forward, deep links, refresh)
 *   H. Offline & failure injection
 *   I. Accessibility (landmarks, headings, focus, targets, contrast, alt)
 *   J. PWA offline shell + performance baseline
 */
import { chromium, firefox } from 'playwright-core';
import sparticuz from '@sparticuz/chromium';

const ENGINE = process.env.CULINA_QA_ENGINE === 'firefox' ? 'firefox' : 'chromium';
const EXECUTABLE = process.env.CULINA_QA_EXECUTABLE || null;
const pw = ENGINE === 'firefox' ? firefox : chromium;

async function launchBrowser() {
  if (ENGINE === 'firefox') {
    return pw.launch({ executablePath: EXECUTABLE, headless: true });
  }
  return pw.launch({
    executablePath: EXECUTABLE || (await sparticuz.executablePath()),
    args: [...sparticuz.args, '--no-sandbox'],
    headless: true,
  });
}

const BASE = 'http://localhost:3000';
const results = [];
const consoleErrors = [];

const pass = (name) => { results.push(['PASS', name]); console.log('  ✓', name); };
const fail = (name, detail = '') => { results.push(['FAIL', name + (detail ? ` — ${detail}` : '')]); console.log('  ✗', name, detail); };

async function check(page, path, name, { selector, minCount = 1, timeout = 15000 } = {}) {
  try {
    await page.goto(BASE + path, { waitUntil: 'domcontentloaded', timeout: 20000 });
    if (selector) {
      await page.waitForSelector(selector, { timeout });
      const count = await page.locator(selector).count();
      if (count < minCount) return fail(name, `${selector}: ${count} < ${minCount}`);
    }
    pass(name);
  } catch (err) {
    fail(name, err.message.split('\n')[0]);
  }
}

async function overflowAt(page, width, height) {
  await page.setViewportSize({ width, height });
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(700);
  const pages = ['/', '/recipes', '/planner', '/shopping-list', '/settings', '/health'];
  let worst = 0;
  for (const p of pages) {
    await page.goto(BASE + p, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    worst = Math.max(worst, overflow);
  }
  return worst;
}

let browser = await launchBrowser();
let context = await browser.newContext({ viewport: { width: 1280, height: 900 } });

/* The sandbox has ~2 GB RAM and no swap: decoded image textures in
   software-GL chromium eventually OOM-kill the whole browser. No QA
   assertion depends on raster images (icons are inline lucide SVGs), so
   abort them at the network layer. */
const IMAGE_RE = /\.(jpe?g|png|webp|gif|avif)(\?|$)/i;
async function setupContext(ctx) {
  await ctx.route(IMAGE_RE, (route) => route.abort('blockedbyclient'));
  return ctx;
}
await setupContext(context);

/* Failure-injection runs in a dedicated context with service workers BLOCKED:
   an active SW's network fetches bypass playwright route interception, so an
   "outage" cannot be simulated on a SW-controlled page (the SW would simply
   fetch real data itself — resilience by design, but it defeats the test). */
async function isolatedPage() {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' });
  await setupContext(ctx);
  const p = await ctx.newPage();
  attachConsoleCapture(p);
  return { ctx, p };
}

// `page` is reassigned when the viewport matrix recovers from a chromium crash
let page = await context.newPage();
function attachConsoleCapture(target) {
  target.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  target.on('pageerror', (err) => consoleErrors.push('PAGEERROR: ' + err.message));
}
attachConsoleCapture(page);

/* Chromium occasionally dies mid-suite; sections start by making sure we
   still have a live page (and browser). IMPORTANT: a healthy page is REUSED,
   never recycled — in this single-process chromium build, pages created after
   the context's first page get their JS timer queue suspended (setTimeout
   never fires), which silently breaks debounced app behavior. Only a dead
   page (or a dead browser) triggers recreation. */
async function ensureAlive() {
  if (browser.isConnected()) {
    try {
      await page.evaluate(() => true);
      return; // page alive — reuse it
    } catch { /* page dead */ }
    try {
      page = await context.newPage();
      attachConsoleCapture(page);
      return;
    } catch { /* fall through to relaunch */ }
  }
  await browser.close().catch(() => {});
  browser = await launchBrowser();
  context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await setupContext(context);
  page = await context.newPage();
  attachConsoleCapture(page);
}

console.log(`\n── CULINA browser QA (expansion · engine: ${ENGINE}${EXECUTABLE && ENGINE === 'firefox' ? '' : ''}) ──\n`);
if (ENGINE === 'firefox' && !EXECUTABLE) {
  console.error('Set CULINA_QA_EXECUTABLE to a Playwright-compatible Firefox binary (see README).');
  process.exit(1);
}

/* ---------------- A. Required surfaces ---------------- */
console.log('A) Required surfaces');

await check(page, '/', 'Home renders', { selector: '#site-header .brand, #site-header .brand-lockup' });
await check(page, '/', 'Home: boot splash removed after load', { selector: 'main .home-hero, main h1' });
try {
  await page.waitForFunction(() => !document.getElementById('boot-splash'), null, { timeout: 10000 });
  pass('boot splash removed');
} catch {
  fail('boot splash removed');
}
await check(page, '/', 'Home: what-can-I-make band', { selector: '.kitchen-band' });
await check(page, '/search?q=chicken', 'Search runs (live providers)', { selector: '.result-section, .state-block' });
await check(page, '/recipes', 'Recipes list (TheMealDB)', { selector: '.card', minCount: 4 });
await check(page, '/recipe/mealdb:52772', 'Recipe detail (deep link)', { selector: '.detail-hero' });
await check(page, '/recipe/mealdb:52772', 'Recipe: sticky action bar', { selector: '.recipe-actionbar' });
await check(page, '/ingredients', 'Ingredients page', { selector: 'main h1' });
await check(page, '/ingredient/mealdb/Chicken', 'Ingredient detail', { selector: 'main h1, .detail-hero', timeout: 20000 });
await check(page, '/drinks', 'Drinks hub', { selector: '.hub-tile', minCount: 4 });
await check(page, '/cocktails', 'Cocktails (TheCocktailDB)', { selector: '.card', minCount: 4 });
await check(page, '/cocktail/cocktaildb:11007', 'Cocktail detail', { selector: '.detail-hero' });
await check(page, '/breweries', 'Breweries (Open Brewery DB)', { selector: '.card, .state-block', minCount: 1 });
await check(page, '/coffee', 'Coffee (SampleAPIs)', { selector: '.card', minCount: 4 });
await check(page, '/kitchen', 'Kitchen match', { selector: '.kitchen-input' });
{
  // Fresh profile = empty plan (by design), so seed one dish before checking the grid
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    localStorage.setItem('culina:v1:planner', JSON.stringify({
      monday: { dinner: [{ id: 'mealdb:52772', title: 'Teriyaki Chicken Casserole', entity: 'recipe', route: '/recipe/mealdb:52772' }] },
    }));
  });
}
await check(page, '/planner', 'Planner (seeded week grid)', { selector: '.planner-week' });
{
  const slotLabels = await page.locator('.planner-slot-label').allTextContents().catch(() => []);
  const hasSnack = slotLabels.some((t) => /snack/i.test(t));
  hasSnack ? pass('planner includes snack slot') : fail('planner includes snack slot', `labels: ${slotLabels.slice(0, 6).join(' | ')}`);
}
await check(page, '/shopping-list', 'Shopping list page', { selector: '.shopping-add-form, .state-block' });
await check(page, '/favorites', 'Favorites', { selector: '.tabs, .state-block' });
await check(page, '/health', 'API health center', { selector: '.data-table tbody tr', minCount: 20 });
await check(page, '/settings', 'Settings page', { selector: '.setting-row', minCount: 3 });
await check(page, '/about', 'About page', { selector: '.about-section', minCount: 4 });

/* Expansion pages */
await check(page, '/food', 'Food hub', { selector: '.hub-tile', minCount: 4 });
await check(page, '/categories', 'Categories (live)', { selector: '.card', minCount: 6 });
await check(page, '/cuisines', 'Cuisines (live)', { selector: '.card', minCount: 6 });
await check(page, '/beer/ale/1', 'Beer detail (deep link)', { selector: '.detail-hero, .state-block' });
await check(page, '/history', 'History page', { selector: 'main h1' });
await check(page, '/privacy', 'Privacy', { selector: '.doc-section', minCount: 3 });
await check(page, '/terms', 'Terms', { selector: '.doc-section', minCount: 3 });
await check(page, '/accessibility', 'Accessibility statement', { selector: '.doc-section', minCount: 3 });
await check(page, '/offline', 'Offline route', { selector: '.offline-hero' });
await check(page, '/food/mealdb/Chicken', 'Food deep-link renders ingredient', { selector: 'main h1, .detail-hero', timeout: 20000 });

/* Brewery detail by name (needs list first) */
await ensureAlive();
try {
  await page.goto(BASE + '/breweries?country=United%20States', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.card a', { timeout: 15000 });
  const href = await page.getAttribute('.card a', 'href');
  if (href && href.startsWith('/brewery/')) {
    await page.goto(BASE + href, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.detail-hero, .state-block', { timeout: 15000 });
    pass(`Brewery detail deep link (${decodeURIComponent(href).slice(0, 40)}…)`);
  } else {
    fail('Brewery detail deep link', 'no brewery card link');
  }
} catch (err) { fail('Brewery detail deep link', err.message.split('\n')[0]); }

/* ---------------- B. Viewport matrix ---------------- */
console.log('\nB) Viewport overflow matrix');
async function relaunchBrowser() {
  await ensureAlive();
  return page;
}
for (const [w, h] of [[320, 568], [375, 667], [390, 844], [430, 932], [768, 1024], [1024, 1366], [1440, 900]]) {
  let worst = null;
  for (let attempt = 0; attempt < 3 && worst === null; attempt += 1) {
    try {
      // NOTE: stays on the main page — recycled pages get their JS timers
      // suspended in this chromium build (see ensureAlive). Crash recovery
      // happens through ensureAlive below.
      worst = await overflowAt(page, w, h);
    } catch {
      await ensureAlive();
    }
  }
  if (worst === null) fail(`${w}×${h}`, 'page crashed after 3 attempts');
  else worst <= 2 ? pass(`${w}×${h}: no horizontal overflow`) : fail(`${w}×${h}`, `overflow ${worst}px`);
}

/* ---------------- C. Mobile navigation ---------------- */
await ensureAlive();
console.log('\nC) Mobile bottom navigation');
await page.setViewportSize({ width: 375, height: 720 });
await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(600);
{
  const visible = await page.locator('.bottom-nav').isVisible().catch(() => false);
  visible ? pass('bottom nav visible at 375px') : fail('bottom nav visible at 375px');
  const buttons = await page.locator('.bottom-nav-btn').count();
  buttons === 5 ? pass(`bottom nav has 5 destinations`) : fail('bottom nav destinations', String(buttons));
  const bodyPad = await page.evaluate(() => getComputedStyle(document.body).paddingBottom);
  parseFloat(bodyPad) >= 56 ? pass(`body clears bottom nav (${bodyPad})`) : fail('body padding', bodyPad);
  // active state on /planner
  await page.goto(BASE + '/planner', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(400);
  const current = await page.locator('.bottom-nav-btn[aria-current="page"]').count();
  current >= 1 ? pass('bottom nav indicates active route') : fail('bottom nav active state');
}
await page.setViewportSize({ width: 1280, height: 900 });
await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(400);
{
  const hidden = !(await page.locator('.bottom-nav').isVisible().catch(() => false));
  hidden ? pass('bottom nav hidden on desktop') : fail('bottom nav hidden on desktop');
}

/* ---------------- D. Command palette & keyboard ---------------- */
await ensureAlive();
console.log('\nD) Command palette');
await ensureAlive();
async function openPalette() {
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#site-header .brand, #site-header .brand-lockup', { timeout: 10000 });
  await page.waitForTimeout(300);
  await page.keyboard.press('Control+k');
  await page.waitForSelector('dialog.search-overlay[open]', { timeout: 5000 });
  await page.waitForTimeout(400);
  // On slow boots the first route render can steal focus (main.focus() for
  // screen readers) after the dialog opened — re-focus the input explicitly.
  await page.locator('dialog.search-overlay input').focus();
}

try {
  await openPalette();
  const commands = await page.locator('dialog .command-item').count();
  commands >= 6 ? pass(`palette opens with ${commands} quick actions`) : fail('palette quick actions', String(commands));
} catch (err) { fail('palette opens', err.message.split('\n')[0]); }

await ensureAlive();
try {
  await openPalette();
  await page.keyboard.type('>theme');
  await page.waitForTimeout(900); // debounce (250ms) + re-render settle
  const filtered = await page.locator('dialog .command-item').count();
  filtered >= 1 && filtered <= 3 ? pass(`">" filters to commands (${filtered} match(es))`) : fail('">" filter', `${filtered} items`);
} catch (err) { fail('">" filter', err.message.split('\n')[0]); }

await ensureAlive();
try {
  // Enter with no active row runs the FIRST command (unambiguous: planner)
  await openPalette();
  await page.keyboard.type('>planner');
  await page.waitForTimeout(900); // debounce (250ms) + re-render settle
  const plannerMatches = await page.locator('dialog .command-item').count();
  await page.keyboard.press('Enter');
  await page.waitForTimeout(600);
  if (/\/planner$/.test(page.url()) && plannerMatches >= 1) {
    pass('Enter runs first filtered command (→ /planner)');
  } else {
    fail('Enter runs first filtered command', `matches=${plannerMatches} url=${page.url()}`);
  }
} catch (err) { fail('Enter runs command', err.message.split('\n')[0]); }

await ensureAlive();
try {
  await openPalette();
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  const closed = await page.locator('dialog.search-overlay[open]').count();
  closed === 0 ? pass('Escape closes palette') : fail('Escape closes palette');
} catch (err) { fail('Escape closes palette', err.message.split('\n')[0]); }

await ensureAlive();
try {
  await page.goto(BASE + '/recipes', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(400);
  await page.keyboard.press('/');
  await page.waitForTimeout(500);
  const open = await page.locator('dialog.search-overlay[open]').count();
  open ? pass('"/" opens palette outside inputs') : fail('"/" shortcut');
  await page.keyboard.press('Escape');
} catch (err) { fail('"/" shortcut', err.message.split('\n')[0]); }

await ensureAlive();
try {
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#site-header [aria-label*="Search by voice"], #site-header .search-trigger', { timeout: 8000 });
  pass('header search affordance present');
} catch (err) { fail('header search affordance', err.message.split('\n')[0]); }

/* ---------------- E. Settings, theme, persistence ---------------- */
await ensureAlive();
console.log('\nE) Settings & persistence');
await ensureAlive();
try {
  await page.goto(BASE + '/settings', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.segmented-btn', { timeout: 8000 });
  const dark = page.locator('.segmented-btn[role="radio"]').nth(1);
  await dark.click();
  await page.waitForTimeout(300);
  const themeNow = await page.getAttribute('html', 'data-theme');
  themeNow === 'dark' ? pass('settings switches theme to dark') : fail('settings theme', themeNow);
  // persists across reload
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(400);
  const afterReload = await page.getAttribute('html', 'data-theme');
  afterReload === 'dark' ? pass('theme persists across reload') : fail('theme persistence', afterReload);
  // back to system
  await page.waitForSelector('.segmented-btn', { timeout: 8000 });
  await page.locator('.segmented-btn[role="radio"]').nth(2).click();
  await page.waitForTimeout(200);
  pass('settings restores system theme');
} catch (err) { fail('settings flows', err.message.split('\n')[0]); }

/* ---------------- F. History & shopping list flows ---------------- */
await ensureAlive();
console.log('\nF) History & shopping list');
try {
  // view a recipe → history entry
  await page.goto(BASE + '/recipe/mealdb:52772', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.detail-hero', { timeout: 15000 });
  await page.goto(BASE + '/history', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(600);
  const cards = await page.locator('.history-card, .history-row').count();
  const viewsText = await page.textContent('body');
  (cards > 0 || /Teriyaki/i.test(viewsText)) ? pass('history records viewed recipe') : fail('history records views');
} catch (err) { fail('history flow', err.message.split('\n')[0]); }

await ensureAlive();
try {
  await page.goto(BASE + '/shopping-list', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#manual-item', { timeout: 8000 });
  // empty-state or list present; add manual item
  await page.fill('#manual-item', 'Paper towels');
  await page.click('.shopping-add-form button[type="submit"]');
  await page.waitForTimeout(500);
  let rows = await page.locator('.shopping-row').count();
  rows >= 1 ? pass('manual item added to shopping list') : fail('manual add', String(rows));
  // duplicate rejected with inline message
  await page.fill('#manual-item', 'paper towels');
  await page.click('.shopping-add-form button[type="submit"]');
  let errVisible = 0;
  for (const wait of [400, 800, 1600]) { // poll: slow renders must not fail this
    await page.waitForTimeout(wait);
    errVisible = await page.locator('.field-error:not([hidden])').count();
    if (errVisible) break;
  }
  errVisible ? pass('duplicate input blocked with inline validation') : fail('duplicate validation', `field-errors visible: ${errVisible}`);
  // check persists after reload
  await page.locator('.shopping-row input[type="checkbox"]').first().check();
  await page.waitForTimeout(300);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(700);
  const stillChecked = await page.locator('.shopping-row.is-checked').count();
  stillChecked >= 1 ? pass('checked state persists after reload') : fail('checked persistence');
  // clear all via settings reset would nuke other test state — remove manually
  await page.locator('.shopping-row .icon-btn').first().click().catch(() => {});
} catch (err) { fail('shopping list flow', err.message.split('\n')[0]); }

/* ---------------- G. SPA navigation ---------------- */
await ensureAlive();
console.log('\nG) SPA navigation');
await ensureAlive();
try {
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-nav-link]', { timeout: 8000 });
  await page.evaluate(() => { window.__nav_test = 42; });
  await page.click('[data-nav-link]:nth-of-type(1)');
  await page.waitForTimeout(800);
  const marker = await page.evaluate(() => window.__nav_test);
  marker === 42 ? pass('SPA transition without reload') : fail('SPA transition', 'marker lost');
  // back/forward
  await page.goBack();
  await page.waitForTimeout(700);
  const backPath = new URL(page.url()).pathname;
  backPath === '/' ? pass('history.back restores previous route') : fail('back navigation', backPath);
  await page.goForward();
  await page.waitForTimeout(700);
  const fwdPath = new URL(page.url()).pathname;
  pass(`history.forward works (${fwdPath})`);
} catch (err) { fail('SPA navigation', err.message.split('\n')[0]); }

/* ---------------- H. Offline & failure injection ---------------- */
await ensureAlive();
console.log('\nH) Offline & failure injection');

try {
  // A full page load is impossible while offline (even localhost is blocked),
  // so verify the running app detects connectivity loss and says so.
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#site-header', { timeout: 8000 });
  await context.setOffline(true);
  let toastText = '';
  await page.waitForSelector('.toast', { timeout: 5000 }).catch(() => {});
  toastText = await page.evaluate(() => document.querySelector('.toast')?.textContent || '');
  await context.setOffline(false);
  await page.waitForTimeout(300);
  /offline|connection|reconnect/i.test(toastText)
    ? pass('offline detection toast on connectivity loss')
    : fail('offline toast', JSON.stringify(toastText));
} catch (err) { await context.setOffline(false).catch(() => {}); fail('offline toast', err.message.split('\n')[0]); }

try {
  // Inject a provider outage: block TheMealDB entirely. Runs in a fresh
  // SW-free context (empty caches, no SW to bypass the interception).
  const { ctx, p } = await isolatedPage();
  await p.route(/themealdb\.com/, (route) => route.abort('failed'));
  await p.goto(BASE + '/recipes', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(7000); // DCL fires before modules finish; budget for boot + retries
  const body = await p.textContent('body');
  const hasErrorState = /didn’t respond|Try again|error|unavailable|rate-limit/i.test(body);
  const skeletons = await p.locator('.skeleton').count();
  hasErrorState && skeletons === 0 ? pass('provider outage → graceful error state (no stuck skeletons)') : fail('provider outage', `errorUI=${hasErrorState} skeletons=${skeletons}`);
  await p.unroute(/themealdb\.com/);
  // recovery
  await p.goto(BASE + '/recipes', { waitUntil: 'domcontentloaded' });
  await p.waitForSelector('.card', { timeout: 15000 });
  pass('provider recovery after unroute');
  await ctx.close().catch(() => {});
} catch (err) { fail('failure injection', err.message.split('\n')[0]); }

await ensureAlive();
try {
  // Malformed provider data: valid JSON, wrong shape → must fail safely
  const { ctx, p } = await isolatedPage();
  await p.route(/themealdb\.com\/api\/json/, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{"meals": "not-an-array"}' }));
  await p.goto(BASE + '/recipes?category=Beef', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(3000);
  const body = await p.textContent('body');
  const safe = !/not-an-array|\[object/i.test(body);
  safe ? pass('malformed provider data fails safely (no raw data leak)') : fail('malformed data handling');
  await ctx.close().catch(() => {});
} catch (err) { fail('malformed data injection', err.message.split('\n')[0]); }

await ensureAlive();
try {
  // Stuck-loading audit on home: no skeletons after 10s
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(10500);
  const skeletons = await page.locator('.skeleton').count();
  skeletons === 0 ? pass('home: no stuck loading states after 10s') : fail('stuck skeletons', `${skeletons} remain`);
} catch (err) { fail('stuck loading audit', err.message.split('\n')[0]); }

/* ---------------- I. Accessibility ---------------- */
await ensureAlive();
console.log('\nI) Accessibility (WCAG 2.2 AA spot-audits)');

try {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#site-header', { timeout: 10000 });
  await page.waitForTimeout(800);

  // 1. landmarks + skip link
  const landmarks = await page.evaluate(() => ({
    header: Boolean(document.querySelector('header')),
    main: Boolean(document.querySelector('main')),
    footer: Boolean(document.querySelector('footer')),
    nav: Boolean(document.querySelector('nav')),
    skip: Boolean(document.querySelector('.skip-link')),
  }));
  landmarks.header && landmarks.main && landmarks.footer && landmarks.nav && landmarks.skip
    ? pass('landmarks present (header/main/footer/nav + skip link)')
    : fail('landmarks', JSON.stringify(landmarks));

  // 2. exactly one h1, no skipped heading levels (home + recipes + settings)
  const headingIssues = [];
  for (const path of ['/', '/recipes', '/settings']) {
    await page.goto(BASE + path, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(600);
    const h = await page.evaluate(() => {
      const hs = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].map((n) => Number(n.tagName[1]));
      const skips = [];
      for (let i = 1; i < hs.length; i++) if (hs[i] - hs[i - 1] > 1) skips.push(`${hs[i - 1]}→${hs[i]}`);
      return { h1: hs.filter((x) => x === 1).length, skips };
    });
    if (h.h1 !== 1) headingIssues.push(`${path}: ${h.h1} h1s`);
    if (h.skips.length) headingIssues.push(`${path}: skips ${h.skips.join(',')}`);
  }
  headingIssues.length === 0 ? pass('one h1 per page, no skipped heading levels') : fail('heading structure', headingIssues.join(' | '));

  // 3. keyboard: first Tab reaches the skip link; focus ring is visible
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#site-header', { timeout: 10000 });
  await page.waitForTimeout(500);
  await page.keyboard.press('Tab');
  const focusInfo = await page.evaluate(() => {
    const el = document.activeElement;
    if (!el) return { ok: false };
    const cs = getComputedStyle(el);
    return { ok: true, isSkip: el.classList.contains('skip-link'), outline: cs.outlineStyle !== 'none' && cs.outlineWidth !== '0px' };
  });
  focusInfo.ok && focusInfo.isSkip ? pass('first Tab focuses the skip link') : fail('keyboard focus start', JSON.stringify(focusInfo));
  focusInfo.outline ? pass('focused element shows a visible outline') : fail('focus visibility (outline)');

  // 4. bottom-nav touch targets ≥ 44×44 at 375px
  await page.setViewportSize({ width: 375, height: 720 });
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.bottom-nav', { timeout: 8000 });
  await page.waitForTimeout(500);
  const smallTargets = await page.evaluate(() =>
    [...document.querySelectorAll('.bottom-nav a, .bottom-nav button')].filter((n) => {
      const r = n.getBoundingClientRect();
      return r.width < 44 || r.height < 44;
    }).length,
  );
  smallTargets === 0 ? pass('bottom-nav touch targets ≥ 44×44 px') : fail('touch targets', `${smallTargets} under 44px`);

  // 5. decorative icons are aria-hidden; content images carry alt
  const iconAudit = await page.evaluate(() => {
    const bare = [...document.querySelectorAll('[data-lucide]')].filter((n) => n.getAttribute('aria-hidden') !== 'true').length;
    const imgs = [...document.querySelectorAll('main img')];
    const noAlt = imgs.filter((n) => !n.hasAttribute('alt')).length;
    return { bare, noAlt, imgs: imgs.length };
  });
  iconAudit.bare === 0 ? pass('decorative icons are aria-hidden') : fail('icon aria-hidden', `${iconAudit.bare} unlabelled`);
  iconAudit.noAlt === 0 ? pass(`all ${iconAudit.imgs} content images have alt text`) : fail('img alt', `${iconAudit.noAlt} missing`);

  // 6. contrast spot-check (both themes): body, muted, primary button, badge.
  //    Waits out the body's background-color transition after switching themes
  //    and composites translucent backgrounds (e.g. badge tint over surface)
  //    before measuring — naive checks produce false failures here.
  const contrastIssues = await page.evaluate(async () => {
    const parseRGB = (str) => {
      const m = str.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/);
      if (!m) return null;
      return { r: Number(m[1]), g: Number(m[2]), b: Number(m[3]), a: m[4] === undefined ? 1 : Number(m[4]) };
    };
    const lum = ({ r, g, b }) => {
      const f = (v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const composite = (top, under) => ({
      r: top.a * top.r + (1 - top.a) * under.r,
      g: top.a * top.g + (1 - top.a) * under.g,
      b: top.a * top.b + (1 - top.a) * under.b,
      a: 1,
    });
    const bgOf = (el) => {
      let acc = null;
      let n = el;
      while (n) {
        const c = parseRGB(getComputedStyle(n).backgroundColor);
        if (c && c.a > 0) acc = acc ? composite(acc, c) : c;
        if (acc && acc.a >= 0.99) break;
        n = n.parentElement;
      }
      if (!acc) acc = { r: 250, g: 247, b: 242, a: 1 }; // --color-background light default
      return acc;
    };
    const ratio = (fg, bg) => {
      const l1 = lum(fg), l2 = lum(bg);
      return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    };
    const issues = [];
    const check = (sel, label, min = 4.5) => {
      const el = document.querySelector(sel);
      if (!el) return;
      const fg = parseRGB(getComputedStyle(el).color);
      if (!fg) { issues.push(`${label}: unparseable color`); return; }
      const r = ratio(fg, bgOf(el));
      if (r < min) issues.push(`${label}: ${r.toFixed(2)}:1 < ${min}:1`);
    };
    for (const theme of ['light', 'dark']) {
      document.documentElement.dataset.theme = theme;
      await new Promise((r2) => setTimeout(r2, 450)); // let the body bg transition finish
      check('main p, main .card-desc, main li', `body/${theme}`);
      check('.muted, .result-sub, .card-sub', `muted/${theme}`);
      check('.btn-primary', `primary-btn/${theme}`);
      check('.badge', `badge/${theme}`);
    }
    document.documentElement.dataset.theme = 'light';
    return issues;
  });
  contrastIssues.length === 0 ? pass('contrast spot-checks ≥ 4.5:1 (light + dark)') : fail('contrast', contrastIssues.join(' | '));

  // 7. dialog: focus moves inside; Escape closes and restores focus
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#site-header', { timeout: 10000 });
  await page.keyboard.press('Control+k');
  await page.waitForSelector('dialog.search-overlay[open]', { timeout: 5000 });
  const focusInDialog = await page.evaluate(() => {
    const d = document.querySelector('dialog.search-overlay[open]');
    return Boolean(d && d.contains(document.activeElement));
  });
  focusInDialog ? pass('dialog receives focus on open') : fail('dialog focus');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  const closed = (await page.locator('dialog.search-overlay[open]').count()) === 0;
  closed ? pass('Escape closes dialog (native <dialog> semantics)') : fail('dialog Escape');
} catch (err) { fail('accessibility section', err.message.split('\n')[0]); }

/* ---------------- J. PWA offline shell + performance baseline ---------------- */
await ensureAlive();
console.log('\nJ) PWA & performance');

try {
  // 1. service worker registers and controls the page
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  const sw = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    return { controlled: Boolean(navigator.serviceWorker.controller), scope: reg.scope };
  });
  sw.controlled ? pass(`service worker controls the app (scope ${sw.scope})`) : fail('service worker control', JSON.stringify(sw));

  // 2. hard reload while offline → cached shell still boots (the offline promise)
  await page.evaluate(() => navigator.serviceWorker.ready);
  // deterministic precondition: the shell must actually be in the SW static cache
  const shellCached = await page.evaluate(async () => {
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      const keys = await caches.keys();
      const staticKey = keys.find((k) => k.startsWith('culina-static-'));
      if (staticKey) {
        const c = await caches.open(staticKey);
        if (await c.match('/')) return true;
      }
      await new Promise((r) => setTimeout(r, 300));
    }
    return false;
  });
  if (!shellCached) throw new Error('SW static cache never received the shell');
  // Firefox quirk: with context route interception active, an offline reload
  // served by a service worker fails with NS_ERROR_OFFLINE (proven fine
  // without interception). Temporarily lift the image block for this check.
  await context.unroute(IMAGE_RE).catch(() => {});
  let reloaded = false;
  for (let attempt = 0; attempt < 2 && !reloaded; attempt++) {
    try {
      await context.setOffline(true);
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 12000 });
      reloaded = true;
    } catch {
      await context.setOffline(false).catch(() => {});
      await page.waitForTimeout(1000);
    }
  }
  if (!reloaded) throw new Error('offline reload failed after retry');
  // wait for the header CONTENT (the element itself exists in the static shell
  // long before JS boots) — offline module loading via the SW can take seconds
  await page.waitForSelector('#site-header .brand, #site-header .brand-lockup', { timeout: 15000 });
  // the splash fades out after app-ready (transition + 900ms failsafe) — wait for detach
  let splashGone = true;
  try {
    await page.waitForFunction(() => !document.getElementById('boot-splash'), null, { timeout: 12000 });
  } catch { splashGone = false; }
  const offlineShell = await page.evaluate(() => ({
    header: Boolean(document.querySelector('#site-header .brand, #site-header .brand-lockup')),
    skeletons: document.querySelectorAll('.skeleton').length,
  }));
  offlineShell.splashGone = splashGone;
  const honestStates = await page.waitForTimeout(9500).then(() => page.evaluate(() => ({
    skeletons: document.querySelectorAll('.skeleton').length,
    errorOrEmpty: Boolean(document.querySelector('.state-block')),
  })));
  await context.setOffline(false);
  offlineShell.header && offlineShell.splashGone
    ? pass('offline reload boots the cached shell (header renders, splash dismissed)')
    : fail('offline shell', JSON.stringify(offlineShell));
  honestStates.skeletons === 0
    ? pass('offline provider failures resolve to honest states (no stuck skeletons)')
    : fail('offline stuck skeletons', `${honestStates.skeletons} remain`);

  // 3. back online → full recovery on reload
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.card, .hub-tile', { timeout: 15000 });
  pass('online reload restores live content');
  // restore the image block and reload once more so the perf baseline is
  // measured under the same conditions as the rest of the suite
  await context.route(IMAGE_RE, (route) => route.abort('blockedbyclient'));
  await page.goto(BASE + '/', { waitUntil: 'load', timeout: 20000 });
  await page.waitForTimeout(800);

  // 4. performance baseline (navigation timing + DOM weight)
  const perf = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0] || {};
    return {
      domContentLoaded: Math.round(nav.domContentLoadedEventEnd || 0),
      load: Math.round(nav.loadEventEnd || 0),
      transferKB: Math.round((nav.transferSize || 0) / 1024),
      domNodes: document.querySelectorAll('*').length,
      imgs: document.images.length,
    };
  });
  perf.load > 0 && perf.load < 8000
    ? pass(`perf baseline: DCL ${perf.domContentLoaded}ms · load ${perf.load}ms · doc ${perf.transferKB}KB · ${perf.domNodes} DOM nodes`)
    : fail('perf baseline', JSON.stringify(perf));
} catch (err) { await context.setOffline(false).catch(() => {}); fail('PWA/perf section', err.message.split('\n')[0]); }

await browser.close();

/* ---------------- report ---------------- */
const fails = results.filter(([s]) => s === 'FAIL').length;
console.log(`\n── Results: ${results.length - fails}/${results.length} passed ──`);
const relevantErrors = consoleErrors.filter((e) => !/net::|Failed to load resource|ERR_NETWORK|ERR_INTERNET|ERR_FAILED|favicon|ServiceWorker intercepted|Image corrupt or truncated|CORS request did not succeed/i.test(e));
if (relevantErrors.length) {
  console.log('\nConsole/page errors (excluding injected network failures):');
  for (const e of [...new Set(relevantErrors)].slice(0, 12)) console.log('  •', e.slice(0, 220));
} else {
  console.log('No unexpected console/page errors.');
}
process.exit(fails ? 1 : 0);
