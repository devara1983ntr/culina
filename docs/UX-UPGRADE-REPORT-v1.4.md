# CULINA v1.4.0 — UI/UX Upgrade Report

**Date:** 5 September 2026 · **Developer credit:** Designed & developed by Roshan
**Method:** full source audit (92 JS modules / 10 stylesheets / 34 routes) →
UI/UX Pro Max skill checklists (motion, UX guidelines, pre-delivery) →
surgical implementation → four-gate verification (77 unit tests · static
audit · production build · 397-assertion gateway suite).

Nothing was removed: every screen, feature, API integration, provider,
state and document from v1.3.0 ships unchanged in behavior — this release
*adds* an interaction layer and *fixes* deployment-critical defects.

---

## 1. Audit findings (all fixed)

| # | Severity | Finding | Root cause | Fix | Verification |
| --- | --- | --- | --- | --- | --- |
| F-1 | **High** | Filter/tab URL state escaped the deployment base on GitHub Pages project sites (`/culina/`): 9 pages called raw `history.replaceState(state,'','/recipes?…')` | Base path handled in `navigate()` but not in query-state sync | New `replaceUrl()` in `js/router.js` anchors every in-app URL write to `basePath()`; all 9 pages migrated (beer, breweries, cocktails, coffee, discover, favorites, ingredients, products, recipes) | `tests/router-url.test.js` — 7 regressions incl. exact sub-path assertions |
| F-2 | Medium | Favorites toast "View" did `location.assign('/favorites')` — full app reload + base-path breakage | Pre-dated router discipline | SPA `navigate('/favorites')` | audit + manual trace |
| F-3 | Low | `APP.version` stale at `1.1.0` (shown in drawer + footer) | Manual constant, never bumped | `1.4.0`, aligned with `package.json` + SW cache version | footer/drawer render |
| F-4 | Low | Privacy/Terms "Last updated 3 September 2026" | — | Refreshed to 5 September 2026 | doc pages |
| F-5 | Info | Gesture/motion gaps: swipe only on shopping list; entrance-only dialogs/toasts; no PTR, long-press, lightbox, route-exit, scroll progress, back-to-top | v1.0–1.3 focused on data integrity + brand | Full interaction layer (§2–§3) | this report + suites |

No TODO/FIXME/HACK markers, no mock/dummy data, no placeholder logic exist in
the shipped tree (grep-verified; the word "placeholder" appears only as HTML
input placeholders and as an honest registry note about a disabled novelty
image provider).

## 2. Motion system (Framer Motion engine — `motion` v13, vanilla API)

All animation flows through `js/utils/motion.js` (single `motion` import in
the app): centralized easing `EASE_OUT = [0.22,1,0.36,1]`, durations from
tokens, and a hard `prefers-reduced-motion` contract (every helper no-ops or
resolves instantly; CSS kill-switches in `gestures.css`).

| Moment | Spec | Skill rule applied |
| --- | --- | --- |
| Route enter | opacity 0→1, y 10→0, 320 ms | decelerate on arrival |
| **Route exit (new)** | opacity→0, y −6, **120 ms, runs in parallel with the next chunk load** | exit faster than enter; never block navigation (cap ≤250 ms) |
| Card reveal | inView, y 16→0, 420 ms, 40 ms stagger (capped 280 ms) | stagger ≤8 perceptible items; transform/opacity only |
| **Dialog exit (new)** | scale 0.975 + fade, 130 ms; Escape intercepted via `cancel` so it animates too | asymmetric timing; native a11y preserved |
| **Drawer exit (new)** | x →100 %, 160 ms | same |
| **Toast lifecycle (new)** | enter rise + **drag-follow swipe-away with spring-back** (36 px commit) | feedback follows the finger |
| Favorite pop | scale 1→1.4→0.92→1, 460 ms | one playful moment per view |
| **Scroll progress (new)** | motion `scroll()` → `scaleX`, 2 px ember-gold→spicy-orange gradient, hidden at top/bottom | scrub-driven, compositor-only |
| **Press feedback (new)** | `:active` scale 0.982 on cards/chips/tiles/tabs/nav | hover doesn't exist on touch — tap feedback must |
| Skeletons | shimmer 1.6 s loop (pre-existing) | loop <1.5 s beat; layout-matched (CLS-safe) |

## 3. Gesture system (every gesture = enhancement with a visible twin)

| Gesture | Where | Behavior | Accessible twin |
| --- | --- | --- | --- |
| **Pull-to-refresh** | global, coarse pointers, scroll-top only | direction-locked; `preventDefault` only while pulling (no native double-fire); resistance ×0.45, arm at 68 px, max 112; glass pill + spinning ring; haptic tick; re-renders route through TTL cache | normal navigation/retry buttons |
| **Swipe ⇄ tabs** | Discover (6 entities), Ingredients (2), Favorites (7), Home trending (3), Beer (2), Coffee (2) | 70 px horizontal, dominance ×1.4 vs vertical, clamped at ends, haptic tick; ignores `.swipe-item`/dialogs so layers never fight | visible tablists (full ARIA keyboard support) |
| **Long-press / right-click → quick actions** | every entity card app-wide | 450 ms, 10 px move tolerance, scroll cancels, capture-phase click suppression, haptic; sheet: Open · ♥ Save/Remove · 📅 Plan (recipes/cocktails) · Copy link (base-anchored absolute URL) · Share (Web Share API) | heart button, plan buttons, links, address bar |
| **Swipe ← to remove** | Shopping list (pre-existing), **History searches (new)**, **Favorites list view (new)** | destructive backdrop, 88–96 px arm, rubber-band right, 180 ms exit | ✕ / heart buttons on every row |
| **Drag & drop** | Planner week grid (pre-existing SortableJS) | cross-slot with button alternatives | remove/duplicate/move buttons |
| **Tap hero photo → lightbox** | Home featured + 6 detail pages | delegated (async images covered), zoom-in affordance, zoom-out cursor, honest 404 copy | image visible inline already; dialog a11y |
| **Swipe toast away** | toast stack | pointer-drag with follow + opacity ramp; stack capped at 3 | auto-dismiss + click-dismiss |

## 4. UX chrome additions

- **Back-to-top** — appears past 600 px, glass button, safe-area aware, sits
  above the mobile bottom nav, `tabindex=-1` while hidden, smooth/instant per
  reduced-motion.
- **Reading progress** — 2 px scroll-linked bar (detail pages benefit most;
  invisible at scroll extremes).
- **Minimal glassmorphism** — exactly two floating surfaces (PTR pill,
  back-to-top) use an 82–86 % surface tint + 8 px blur; nothing else frosted.

## 5. Security review (re-verified this release)

- **XSS:** all dynamic DOM built through `el()` text nodes — no `innerHTML`
  with data (the only two uses are static markup: PTR ring; lucide internals).
- **URLs:** every external href passes `safeUrl()` (http/https allowlist);
  external links carry `rel="noopener noreferrer"`; provider images use
  `referrerpolicy="no-referrer"`.
- **Gateway:** strict proxy allowlist (`/api/fruityvice/api/fruit/(all|\d+)`
  only), method guard, path-traversal defense, CSP + HSTS(HTTPS) + nosniff +
  frame-deny + referrer/permissions policies — 397 assertions green.
- **Clipboard/Share:** guarded try/catch with honest failure toasts; Web Share
  only when `navigator.share` exists.
- **Input validation:** kitchen/shopping/search inputs pass `validate.js`
  (limits, dedupe, quantity parsing) — unit-tested.
- **Dependencies:** `npm audit --audit-level=high` clean in CI; no API keys
  anywhere (key-requiring providers registered but honestly disabled).
- **HTTPS:** SW registers only on `https:` (or localhost dev); HSTS on the
  gateway; GitHub Pages serves HTTPS natively.

## 6. Performance

- Vendor chunk 147.1 kB (45.6 kB gzip) incl. motion+lucide+sortablejs; main
  169.6 kB (61.3 kB gzip); 34 route chunks code-split (largest page 10.5 kB).
- All new animation is transform/opacity only (compositor); gestures use
  passive listeners except the single PTR `touchmove` (which must prevent
  default); scroll handlers rAF-throttled.
- PTR/tab-swipe/long-press listeners are removed through `ctx.onCleanup`;
  swipe wrappers are released before every re-render (no accumulation).

## 7. Verification log (5 September 2026)

| Gate | Result |
| --- | --- |
| `npm test` (node:test) | **77/77 pass** (70 pre-existing + 7 new router regressions) |
| `npm run audit` | **PASS** — 92 files imports · 271 CSS classes defined · 68/68 icons registered (98 in set) · 34 routes ↔ 34 loaders · links resolve |
| `npm run build` | **PASS** — 2.6 s, chunks above |
| `node scripts/gateway-test.mjs` | **397 passed / 0 failed** (security headers, SPA fallback, proxy allowlist, brand byte-mirrors, sitemap) |
| Dev-server module smoke | 14/14 new/changed modules transform + serve 200 |
| Reduced-motion pass | every motion helper + CSS block verified no-op |
| Browser E2E matrix | runs in CI (Chromium+Firefox) when runner browsers resolve; not executable in this sandbox (no browser binaries) — compensated by unit+gateway+audit gates |

## 8. Pre-release checklist

- [x] No TODO/FIXME/HACK/placeholder logic in shipped code
- [x] No mock/dummy data — live providers or honest absence
- [x] No auth/premium/creator-studio surfaces (product boundaries respected)
- [x] Dark + light + system themes; larger-text mode; reduced motion
- [x] Responsive: 360 → 1440+ (6 breakpoints), safe areas, bottom-nav thumb reach
- [x] Sub-path deploy safety (GitHub Pages `/culina/`) — regression-tested
- [x] Version alignment: package 1.4.0 · APP 1.4.0 · SW cache 1.4.0 · CHANGELOG
- [x] CI green-path only deploy (tests → audit → build → npm audit → gateway)
- [x] Docs: COMPONENT-CATALOG · WIREFRAMES · this report · CHANGELOG · README
- [x] Developer credit: "Designed & developed by Roshan" — footer, About, README

---

## 8. Pre-push certification addendum (5 September 2026)

Full 20-section pre-push certification of the release candidate (`259a7dc`):
clean `npm ci` from a wiped workspace, reproducible builds, 10-viewport
responsive matrix, real-browser touch-gesture certification (CDP), a GitHub
Pages sub-path emulator serving the exact `deploy.yml` artifact
(`--base=/culina/` + `set-origin` + `404.html` semantics), and the repo E2E
suite on two engines.

### Defects found by certification — and fixed (F-6 … F-8)

| # | Severity | Defect | Fix |
|---|----------|--------|-----|
| F-6 | **High** | `mountScrollProgress` passed a one-argument callback to motion's `scroll()`. Motion dispatches on callback *arity*: one-arg callbacks receive the progress **number**, so `({ y }) => …` destructured `undefined` and threw `Cannot read properties of undefined (reading 'max')` on **every scroll frame** — console error spam in production and a scroll bar that never worked. | Use the two-argument `(progress, info)` form, read `info.y.progress` / `info.y.scrollLength`, and guard the non-scrollable case (scaleX(0), bar hidden). |
| F-7 | Medium | Real Android fires *both* the 450 ms long-press timer *and* a native `contextmenu` for the same gesture → two stacked action sheets. | `contextmenu` still suppresses the native menu, but no-ops when a long-press already fired. |
| F-8 | Medium | After long-press → sheet dismissed via Escape/backdrop (no follow-up click), `fired` stayed armed. The next tap on a link *inside a card* early-returned in `pointerdown` (interactive-ancestor guard) without resetting the flag, so click capture swallowed the tap — one silently lost navigation. | Reset `fired` on every `pointerdown` before the guards. Same-gesture suppression is untouched: the synthesized click always arrives before any new `pointerdown`. |

Also synced: `package-lock.json` root version 1.3.0 → 1.4.0 (metadata only;
`npm ci` was unaffected) and re-measured doc counts (COMPONENT-CATALOG line
counts, stylesheet count, WIREFRAMES nav breakpoints ≥1024 / <1024 / ≤767).

### Certification battery (all re-run against the fixed tree)

| Gate | Result |
|------|--------|
| `npm ci` + `npm test` | 77/77 · 0 vulnerabilities |
| `npm run audit` | PASS — 92 files · 271 classes · 68 icons · 34 routes↔loaders |
| Builds (root + `/culina/`) | clean, reproducible hashes · 46 chunks (34 route + shared + index/vendor) · largest page chunk 10.5 kB |
| Gateway suite | 397/397 |
| Browser E2E — Chromium | **92/92**, zero unexpected console/page errors |
| Browser E2E — Firefox 155 | **92/92**. Two benign console artifacts appear *only during deliberate offline injection*: Firefox logs the SW's `Response.error()` fallback ("passed an Error Response to respondWith") and aborted font downloads. The handler is byte-identical to live v1.3.0 and the app resolves to honest offline states (assertions pass). |
| Pages sub-path emulator | **22/22** — 9 paths direct-load + refresh, SPA nav and back/forward under `/culina/`, query-state sync (F-1 regression), SW scope `/culina/`, cache `culina-static-1.4.0`, base-agnostic manifest, zero page errors |
| Gesture / lightbox / motion / state / security / perf | **32/32** — tab swipe + dominance rule + keyboard fallback; long-press sheet opens once, scroll cancels, tap still navigates; swipe-to-remove thresholds (30 px keeps, 140 px removes); PTR engages at scroll-top and stays out mid-page; lightbox open/Escape/backdrop/focus + monogram fallback on blocked provider images; reduced-motion content visible, dialogs functional; 3 rapid back-to-back navigations resolve to the final route with a single mounted view; 10 viewports × 6 routes with zero horizontal overflow and exact bottom-nav breakpoint; hard-failure/malformed-JSON/429/partial-outage/empty/offline→recovery states; XSS probe inert; kitchen validation. Endurance: 20 round-trip navigations at 41–51 ms avg, heap Δ 1.1–1.6 MB, 268 steady-state DOM nodes, zero page errors. |
| Contrast (`scripts/verify-contrast.py`) | ALL PAIRS PASS — WCAG 2.2 AA, light + dark |
| API regression | `git diff v1.3.0 → js/api js/services` = **0 bytes** (adapters, normalizer, cache, errors, search untouched) |
| Security headers (gateway) | CSP (strict `script-src` + splash hash), nosniff, X-Frame-Options DENY, Referrer-Policy, Permissions-Policy, COOP. HSTS is set on HTTPS requests only (RFC 6797: browsers ignore it over plain HTTP); github.io enforces HSTS at the platform level. |

### Documented limitations (pre-existing — not v1.4 regressions)

- Middle-click / modifier-click on internal links intentionally bypasses the
  SPA interceptor (unmodified left clicks only), so on the Pages sub-path such
  clicks target the domain root and 404 there. Behaviour unchanged since v1.0;
  a build-time href rewrite would be the structural fix if ever needed.
- The `/api/fruityvice` proxy exists only behind the Node gateway; on static
  Pages hosting that provider degrades gracefully with an honest outage notice
  (verified by the partial-failure certification above).
