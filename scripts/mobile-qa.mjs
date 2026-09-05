/**
 * CULINA — Mobile layout regression battery (forensic fix verification).
 *
 * Standalone suite (fresh browser per run) verifying the responsive layout
 * contracts of the home search capsule, quick-action chips, header controls
 * and fixed bottom navigation on an Android-class touch viewport:
 *
 *   1. lead icon owns its grid column (never overlaps text)
 *   2. input text area isolated from icon and trailing controls
 *   3. submit button contained within the capsule
 *   4. microphone never overlaps submit or input
 *   5. microphone 44x44 (or honestly absent without SpeechRecognition)
 *   6. clear control respects [hidden]
 *   7. focus ring with zero layout shift
 *   8. long queries scroll inside the input, capsule geometry holds
 *   9. chips share one height and meet the touch target
 *  10. chips wrap within the content column
 *  11. body clearance covers the fixed nav + safe-area inset
 *  12. header controls 44x44 with consistent spacing
 *  13. Enter submits to /search?q= (base-path safe)
 *  14. 320/360/375/390/412/430 sweep: no overflow, geometry holds
 *
 * Run against a running gateway:  npm run test:mobile
 * Engines: CULINA_QA_ENGINE=firefox CULINA_QA_EXECUTABLE=<path> supported.
 */
import { chromium, firefox } from 'playwright-core';

const ENGINE = process.env.CULINA_QA_ENGINE === 'firefox' ? 'firefox' : 'chromium';
const EXECUTABLE = process.env.CULINA_QA_EXECUTABLE || null;
const BASE = process.env.CULINA_QA_BASE || 'http://localhost:3000';
const pw = ENGINE === 'firefox' ? firefox : chromium;

async function launchBrowser() {
  if (ENGINE === 'firefox') return pw.launch({ executablePath: EXECUTABLE, headless: true });
  if (EXECUTABLE) return pw.launch({ executablePath: EXECUTABLE, args: ['--no-sandbox'], headless: true });
  const sparticuz = (await import('@sparticuz/chromium')).default;
  return pw.launch({ executablePath: await sparticuz.exec(), args: [...sparticuz.args, '--no-sandbox'], headless: true });
}

const results = [];
const consoleErrors = [];
const pass = (n) => { results.push(['PASS', n]); console.log('  \u2713', n); };
const fail = (n, d = '') => { results.push(['FAIL', n]); console.log('  \u2717', n, d ? '— ' + d : ''); };

const browser = await launchBrowser();
console.log(`\nCULINA mobile layout battery — engine: ${ENGINE}`);
/* ============ L) Mobile layout regression (forensic fix battery) ============ */
console.log('\nMobile layout contracts (390x844 touch viewport)');
try {
  const mctx = await browser.newContext({
    hasTouch: true,
    viewport: { width: 390, height: 844 },
    // Layout battery only — SW behaviour is covered by section J. Blocking SW
    // here also avoids a Firefox profile quirk where a service worker
    // registered by an earlier (closed) context intercepts navigations in a
    // fresh context and stalls them.
    serviceWorkers: 'block',
    // Android-class emulation is a Chromium capability; Firefox gets the same
    // viewport + touch without the mobile-UA spoof.
    ...(ENGINE === 'chromium'
      ? { isMobile: true, userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36' }
      : {}),
  });
  const mp = await mctx.newPage();
  mp.on('pageerror', (e) => consoleErrors.push('PAGEERROR: ' + e.message));
  await mp.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await mp.waitForSelector('.hero-search', { timeout: 15000 });
  await mp.waitForTimeout(500);

  const geom = () => mp.evaluate(() => {
    const g = (sel) => { const e = document.querySelector(sel); if (!e) return null; const b = e.getBoundingClientRect(); return { x: b.x, y: b.y, right: b.right, bottom: b.bottom, w: b.width, h: b.height }; };
    return {
      wrap: g('.hero-search'), input: g('.hero-search .input'), lead: g('.hero-search .lead-icon'),
      btn: g('.hero-search .search-submit'), mic: g('.hero-search .search-trail .icon-btn'),
      clear: g('.hero-search .input-clear'),
      chips: [...document.querySelectorAll('.hero-quick .chip')].map((c) => { const b = c.getBoundingClientRect(); return { x: b.x, right: b.right, h: b.height }; }),
      nav: g('.bottom-nav'), bodyPad: parseFloat(getComputedStyle(document.body).paddingBottom),
      headerBtns: [...document.querySelectorAll('#site-header .header-actions button')].map((b) => { const r = b.getBoundingClientRect(); return { x: r.x, right: r.right, w: r.width, h: r.height, visible: r.width > 0 }; }).filter((b) => b.visible),
      sw: document.documentElement.scrollWidth, iw: innerWidth,
    };
  });
  const hits = (a, b) => a && b && a.x < b.right && b.x < a.right && a.y < b.bottom && b.y < a.bottom;
  let m = await geom();

  // 1. lead icon owns its column: never overlaps the text box
  m.lead && m.input && m.lead.right <= m.input.x + 0.5
    ? pass('search icon sits in its own grid column, clear of the text box')
    : fail('search icon/text separation', JSON.stringify({ lead: m.lead, input: m.input }));

  // 2. input starts after the icon zone and ends before the trail cluster
  m.input.x > m.wrap.x && (!m.mic || m.input.right <= m.mic.x + 0.5)
    ? pass('input text area is isolated from icon and trailing controls')
    : fail('input isolation', JSON.stringify(m.input));

  // 3. submit button fully inside the capsule
  m.btn && m.btn.x >= m.wrap.x && m.btn.right <= m.wrap.right + 0.5
    ? pass('submit button contained within the search capsule')
    : fail('submit containment', JSON.stringify({ btn: m.btn, wrap: m.wrap }));

  // 4. microphone never overlaps submit or input
  (!m.mic || (!hits(m.mic, m.btn) && !hits(m.mic, m.input)))
    ? pass('microphone has its own layout area (no overlap with button or text)')
    : fail('mic overlap', JSON.stringify({ mic: m.mic, btn: m.btn }));

  // 5. microphone touch target (voice is feature-detected: absent where the
  //    platform exposes no SpeechRecognition — e.g. Firefox — by design)
  const hasSpeech = await mp.evaluate(() => !!(window.SpeechRecognition || window.webkitSpeechRecognition));
  hasSpeech
    ? (m.mic && m.mic.w >= 44 && m.mic.h >= 44
        ? pass('voice control meets the 44x44 touch target')
        : fail('mic touch target', JSON.stringify(m.mic)))
    : (!m.mic
        ? pass('voice control correctly absent where SpeechRecognition is unsupported')
        : fail('mic should be absent without SpeechRecognition', JSON.stringify(m.mic)));

  // 6. clear button truly hidden when empty, appears while typing
  const clearHidden = !m.clear || m.clear.w === 0;
  await mp.fill('.hero-search .input', 'tomato');
  await mp.waitForTimeout(150);
  const clearShown = await mp.evaluate(() => { const c = document.querySelector('.hero-search .input-clear'); const b = c.getBoundingClientRect(); return b.width > 0; });
  await mp.fill('.hero-search .input', '');
  clearHidden && clearShown
    ? pass('clear control respects [hidden] (absent when empty, present while typing)')
    : fail('clear visibility', JSON.stringify({ clearHidden, clearShown }));

  // 7. focus ring without layout shift
  const before = await geom();
  await mp.focus('.hero-search .input');
  await mp.waitForTimeout(120);
  const focused = await mp.evaluate(() => {
    const w = document.querySelector('.hero-search'); const b = w.getBoundingClientRect();
    return { shadow: getComputedStyle(w).boxShadow, x: b.x, y: b.y, w: b.width, h: b.height };
  });
  focused.shadow !== 'none' && Math.abs(focused.w - before.wrap.w) < 0.5 && Math.abs(focused.h - before.wrap.h) < 0.5
    ? pass('focus state paints a ring with zero layout shift')
    : fail('focus shift', JSON.stringify(focused));

  // 8. long query stays inside the field (internal scroll, no field overflow)
  await mp.fill('.hero-search .input', 'roasted pumpkin sage brown butter pasta with crisped shallots'.repeat(2));
  await mp.waitForTimeout(150);
  const longQ = await geom();
  const longOk = await mp.evaluate(() => { const i = document.querySelector('.hero-search .input'); return i.scrollWidth >= i.clientWidth - 1; });
  longOk && longQ.wrap.right <= longQ.iw && !hits(longQ.lead, longQ.input) && longQ.btn.right <= longQ.wrap.right + 0.5
    ? pass('long queries scroll inside the input; capsule geometry holds')
    : fail('long query', JSON.stringify(longQ));
  await mp.fill('.hero-search .input', '');

  // 9. quick-action chips: one consistent height, full touch target on touch UIs
  const chipHs = [...new Set(m.chips.map((c) => c.h))];
  chipHs.length === 1 && chipHs[0] >= 44
    ? pass('quick-action chips share one height and meet the touch target')
    : fail('chip consistency', JSON.stringify(chipHs));

  // 10. chips wrap inside the container (no clipping past the gutter)
  m.chips.every((c) => c.right <= m.iw - 8)
    ? pass('quick-action chips wrap within the content column')
    : fail('chip containment', JSON.stringify(m.chips));

  // 11. fixed bottom nav: content clearance + safe-area padding present
  m.nav && m.bodyPad >= m.nav.h
    ? pass(`body clearance (${m.bodyPad}px) covers the fixed nav (${m.nav.h.toFixed(1)}px) + safe-area`)
    : fail('nav clearance', JSON.stringify({ bodyPad: m.bodyPad, nav: m.nav }));

  // 12. header controls: 44px targets with >=8px breathing room
  const hb = m.headerBtns;
  const gapsOk = hb.every((b, i) => i === 0 || b.x - hb[i - 1].right >= 7.5);
  hb.every((b) => b.w >= 44 && b.h >= 44) && gapsOk
    ? pass('header controls are 44x44 with consistent spacing')
    : fail('header controls', JSON.stringify(hb));

  // 13. Enter in the field still submits to /search?q=
  await mp.fill('.hero-search .input', 'basil');
  await mp.press('.hero-search .input', 'Enter');
  await mp.waitForURL(/\/search\?q=basil/, { timeout: 8000 });
  pass('Enter submits the hero field to the search route (base-path safe)');

  // 14. narrow-viewport sweep: no horizontal overflow, geometry holds
  const sweep = [];
  for (const w of [320, 360, 375, 390, 412, 430]) {
    await mp.setViewportSize({ width: w, height: 800 });
    await mp.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await mp.waitForSelector('.hero-search', { timeout: 15000 });
    await mp.waitForTimeout(180);
    const g = await geom();
    const ok = g.sw <= g.iw && g.input.w >= 140 && g.lead.right <= g.input.x + 0.5 && g.btn.right <= g.wrap.right + 0.5 && (!g.mic || !hits(g.mic, g.btn));
    sweep.push([w, ok]);
  }
  sweep.every(([, ok]) => ok)
    ? pass('320/360/375/390/412/430 sweep: no overflow, icon/text/button geometry holds')
    : fail('narrow sweep', JSON.stringify(sweep));

  await mctx.close();
} catch (err) { fail('mobile regression section', err.message.split('\n')[0]); }

await browser.close();
const fails = results.filter(([s]) => s === 'FAIL').length;
console.log(`\n── Mobile battery: ${results.length - fails}/${results.length} passed ──`);
if (consoleErrors.length) {
  console.log('Unexpected page errors:');
  for (const e of [...new Set(consoleErrors)].slice(0, 8)) console.log('  •', e.slice(0, 200));
  process.exit(1);
}
process.exit(fails ? 1 : 0);
