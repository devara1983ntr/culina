# CULINA — Expansion QA Report

**Date:** 2026-09-03 · **Build:** production (`dist/`, index chunk ~100 kB / 31 kB gzip)

## Final gate — all green

| Gate | Command | Result |
| --- | --- | --- |
| Unit tests | `npm test` | **70/70 pass** (48 core + 22 expansion) |
| Static audit | `npm run audit` | **PASSED** — imports (87 files), 256 CSS classes defined, 67 icons valid **and registered**, 34 routes ↔ 34 loaders, all static internal links resolve |
| Production build | `npm run build` | clean, ~3 s, no warnings |
| Browser E2E | `npm run test:ui` | **67/67 pass** — reproduced twice consecutively; no unexpected console/page errors |
| Live preview | port 3000 | serving the current build (asset hash verified) |

## E2E coverage (scripts/browser-qa.mjs, 67 checks)

- **A — Surfaces (34):** every route incl. deep links (`/recipe/mealdb:52772`, `/cocktail/…`, `/beer/ale/1`, brewery by harvested href, `/food/…`), boot splash removal, kitchen band, seeded planner grid with snack slots, sticky recipe action bar.
- **B — Viewport matrix (7):** no horizontal overflow at 320/375/390/430/768/1024/1440 px across 6 pages.
- **C — Mobile bottom nav (5):** visible at 375 px, 5 destinations, active-route indication, body clearance, hidden on desktop.
- **D — Command palette (6):** opens with quick actions, `>` command filter, **Enter executes the first filtered command**, Escape, `/` shortcut outside inputs, header search affordance.
- **E — Settings (3):** theme switch, persistence across reload, restore system.
- **F — History & shopping list (4):** viewing a recipe records history; manual item add; duplicate blocked with inline validation; checked state persists after reload.
- **G — SPA navigation (3):** no reload on nav, history.back/forward.
- **H — Failure injection (5):** offline detection toast, provider outage → graceful error state with no stuck skeletons, recovery after unroute, malformed JSON (`{"meals":"not-an-array"}`) fails safely with no raw-data leak, no stuck loading states after 10 s.

## Real bugs the QA round found and fixed

1. **`history.recordView is not a function`** — the patcher added calls to 4 detail pages but their `history` import never landed (a string-vs-list bug in the one-off patch script). Fixed; brewery/recipe/cocktail/beer detail now record views.
2. **Recipe & cocktail detail deep links broken** — route ids are `provider:sourceId` refs; pages passed the whole ref to the API (`lookup.php?i=mealdb:52772` → `Invalid ID` → "Recipe not found"). Fixed by stripping the provider prefix (see `docs/DESIGN-DECISIONS.md` §15).
3. **13 icons used but never registered** in `js/utils/icons.js` (sun-moon, house, mic, palette, wifi-off, …) — silently invisible. Fixed; the audit now checks registry membership so it can't regress (§17).
4. **Command palette Enter did nothing in `>` mode** — Enter fell through to search navigation. Now Enter runs the first filtered command.
5. **Boot splash frozen during slow provider loads** — splash dismissed only after first-route *data* resolved (up to ~9 s of logo-only screen). Now a first-paint skeleton mounts and the splash dismisses immediately (`culina:app-ready`), with `boot()` as backstop (§14).
6. **Manual shopping-list items couldn't be checked** — manual rows had no checkbox listener and always rendered unchecked. Both fixed; check state persists.
7. **Header overflow at 320 px (11 px)** — search trigger + 4 buttons didn't fit. Below 400 px the header search trigger hides (bottom nav owns Search there); all viewports now clean.
8. **`userMessage` HTTP key bug** (4th instance of the `ErrorType.HTTP_ERROR` vs `ErrorType.HTTP` mix-up) and **`parseQuantity('') === 0`** — both found by the expansion unit tests.

## QA-suite engineering notes (why the harness looks the way it does)

- **playwright-core 1.6x glob routes don't match cross-origin URLs** (scheme-less patterns) — the failure-injection tests were silently vacuous until switched to **RegExp** patterns. Verified interception counts before trusting results.
- The app's **three cache layers** (in-memory Map, sessionStorage mirror, service-worker TTL cache) each had to be cleared before outage injection — stale data otherwise masked outages *by design* (documented graceful degradation, not a bug).
- Sandbox has ~2 GB RAM / no swap: headless single-process chromium in software GL OOMs on image-heavy pages, so the suite **blocks raster images** at the network layer and **recycles pages between blocks** with a browser-relaunch fallback. No assertion depends on raster images (icons are inline lucide SVGs).
- `waitForSelector(…, { state: 'detached' })` waits for the element to *appear first* — an already-removed splash hangs it. The splash check uses `waitForFunction(() => !document.getElementById('boot-splash'))` instead.
- Planner check seeds localStorage first: a fresh profile shows the planner's *empty state* by design, not the week grid.

## Scope decisions

- **Swipe-to-delete stays on shopping-list rows only.** Planner items use SortableJS touch-drag; a swipe gesture on the same surface would conflict with drag initiation (§16).
- Firefox ESR was not installed in the sandbox; the suite runs on the bundled headless Chromium. Cross-browser verification remains open if a Firefox build becomes available.
