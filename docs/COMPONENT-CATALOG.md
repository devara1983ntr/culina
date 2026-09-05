# CULINA — Component Catalog (v1.4.0)

> The authoritative inventory of every module in the application: what it does,
> what it depends on, what depends on it, and why it exists (historical
> context). Generated from a full source audit on **5 September 2026** and
> maintained alongside the code — any new module ships with a catalog entry.
>
> **Scope:** 92 JavaScript modules (13,756 lines), 11 stylesheets, 34 routes,
> 28 registered providers (8 live), 77 automated tests, 397 gateway
> assertions, 1 CI pipeline + 1 Pages deploy pipeline.

---

## 1. System overview & layering

```
┌────────────────────────────────────────────────────────────────────────┐
│ SHELL        index.html → js/main.js → js/app.js (route lifecycle)     │
│              header · footer · bottom-nav · toast-root · dialog-root   │
├────────────────────────────────────────────────────────────────────────┤
│ PAGES        js/pages/*.js — 34 route modules, each exports render(ctx)│
│              ctx = { params, query, path, signal, onCleanup }          │
├────────────────────────────────────────────────────────────────────────┤
│ COMPONENTS   js/components/*.js — cards, states, modal, tabs, filters, │
│              search overlay, planner widgets, quick actions, lightbox  │
├────────────────────────────────────────────────────────────────────────┤
│ SERVICES     js/services/*.js — favorites · history · planner ·        │
│              search · settings · shopping · shoppingList · surprise    │
├────────────────────────────────────────────────────────────────────────┤
│ API LAYER    client (timeout/retry/dedupe) → cache (TTL) → adapters    │
│              → normalizer (pure) → registry (28 providers) → health    │
├────────────────────────────────────────────────────────────────────────┤
│ UTILITIES    dom · icons · format · fn · validate · motion · touch ·   │
│              pullToRefresh                                             │
├────────────────────────────────────────────────────────────────────────┤
│ FOUNDATION   constants · state (pub/sub store) · storage (safe JSON) · │
│              router (history API) · seo (meta/JSON-LD)                 │
└────────────────────────────────────────────────────────────────────────┘
```

**Dependency rule:** each layer may import from the layers below it, never
from above. Pages never see provider field names — only normalized domain
models (Recipe, Ingredient, Drink, Brewery, Product, Nutrition). One known,
deliberate exception: `components/quickActions.js → components/plannerWidgets.js`
is a **dynamic** `import()` to keep the card ↔ planner-widget cycle acyclic.

---

## 2. Foundation

### 2.1 `js/constants.js` (95 L)
Single source of truth for app identity and navigation data.
- **Exports:** `APP` (name, tagline, version `1.4.0`, repoUrl, developerCredit — *"Designed & developed by Roshan"*), `STORAGE_KEYS` (7 `culina:v1:*` keys), `NAV_PRIMARY` (5 items incl. Drinks dropdown), `NAV_SECONDARY` (11 items), `NAV_BOTTOM` (5 mobile destinations), `DAYS` (7), `MEALS` (4 incl. Snacks), `ENTITY_LABELS`, `SEARCH_SHORTCUT_LIMIT`.
- **Depends on:** nothing (leaf module).
- **Dependents:** header, bottomNav, footer, searchOverlay, plannerWidgets, quickActions, every service, most pages.
- **History:** v1.0.0 core; `developerCredit` added in v1.1.0 (gap G-23); version aligned to the package in **v1.4.0** (was stale at 1.1.0).

### 2.2 `js/state.js` (39 L)
Tiny pub/sub store (`createStore`) + the singleton `appState` holding `{ route, online, favoritesVersion, plannerVersion, settingsVersion, … }`.
- **Dependents:** app.js (route sync), header (badge), planner, favorites, settings pages, services (version bumps on persist).
- **Pattern:** services never mutate UI; they bump a version counter and subscribers re-render. Prevents double-render loops between the store and the DOM.

### 2.3 `js/storage.js` (90 L)
localStorage wrapper with JSON safety, private-mode tolerance, and `migrate()` (schema versioning). Exports `read`, `write`, `remove`, `migrate`, `__resetMemory` (test seam).
- **Rule:** every read is sanitized by the owning service — corrupted data degrades to empty, never to a crash.

### 2.4 `js/router.js` (131 L)
History-API SPA router; real `<a href>` links everywhere (crawlable), interception for client-side navigation.
- **Exports:** `routes` (34 entries), `matchRoute`, `currentRoute`, `navigate`, `replaceUrl` **(new v1.4.0)**, `basePath`, `installLinkInterception`.
- **`basePath()`** derives the deployment root (e.g. `/culina` on GitHub Pages project sites) from the manifest link — one source of truth, rewritten per-deploy by `scripts/set-origin.mjs`.
- **`replaceUrl(path)`** (v1.4.0): base-anchored `history.replaceState` for query-state sync. **Replaced 9 raw `history.replaceState` calls** that escaped the deployment base on sub-path hosts (see §11, finding F-1).
- **Dependents:** app.js, main.js, seo.js, all list/filter pages, cards.js, quickActions.js, searchOverlay.js.
- **Regression suite:** `tests/router-url.test.js` (7 tests) locks the sub-path contract.

### 2.5 `js/seo.js` (99 L)
`applyMeta({ title, description, path, robots, jsonLd })` — per-route `<title>`, meta description, canonical (base-aware), Open Graph, and JSON-LD (Recipe/thing schemas on detail pages). Called by every page's `render()`.

---

## 3. Shell & lifecycle

### 3.1 `index.html`
App shell: skip-link, `#site-header`, `#main`, `#site-footer`, `#bottom-nav`, boot splash, `#toast-root`, `#dialog-root`, noscript fallback with direct provider links. Inline theme bootstrap script reads `culina:v1:settings` **before first paint** (no theme flash).

### 3.2 `js/main.js` (69 L)
Entry point: Fontsource imports (Playfair Display 400–700 + Inter 300–700, self-hosted OFL), 10 stylesheet imports in cascade order (tokens → reset → base → layout → components → pages → expansion → **gestures (v1.4.0)** → utilities → responsive), boot-splash dismissal on `culina:app-ready`, production-only service-worker registration (HTTPS or localhost, readyState-guarded).

### 3.3 `js/app.js` (190 L)
Route lifecycle. `pageLoaders` = 34 code-split dynamic imports. `renderRoute()`:
1. bumps a render token (superseded navigations abort silently),
2. runs previous route's cleanups (`ctx.onCleanup` registry),
3. updates header/bottom-nav active states,
4. first paint → skeleton grid + `culina:app-ready` (splash dismisses before data resolves),
5. **v1.4.0 transition:** outgoing view fades out (`pageExit`, 120 ms) *in parallel* with the incoming chunk load — navigation is never blocked by animation,
6. mounts the view, `refreshIcons()`, `pageEnter()` (320 ms rise), focus to `#main` (WCAG SPA nav), scroll restore on popstate.
`boot()`: storage migration → settings init → header/footer/bottom-nav render → link interception → **back-to-top + scroll-progress + pull-to-refresh (v1.4.0)** → online/offline toasts → first `renderRoute()`.
- **Failure policy:** a page-module error renders the global `errorState` with retry; `AbortError` is ignored by design.

---

## 4. Components (`js/components/`)

| Module | L | Exports | Role & notes |
| --- | --- | --- | --- |
| `backToTop.js` **new 1.4** | 38 | `initBackToTop` | Floating control after 600 px scroll; smooth/instant per reduced-motion; sits above the mobile bottom nav (safe-area aware); `tabindex=-1` while hidden so it's out of the a11y tree. |
| `bottomNav.js` | 89 | `renderBottomNav`, `updateBottomNav` | 5 mobile destinations; "world" logic keeps Discover lit for all food/drink content routes; `aria-current` synced per navigation. |
| `brand.js` | 102 | `BrandLogo`, `BrandMark`, `BrandIcon`, `BrandWordmark` | Traced v1.3.0 identity (emblem on Midnight tile + wordmark SVGs from `/brand`). |
| `cards.js` | 212 | `entityCard`, `entityGrid`, `favoriteButton`, `itemRoute`, `mediaImage`, `monogramTile` | One visual language for 8 entity types. `mediaImage` degrades to a designed monogram tile on error/absence (no fake photos). `favoriteButton` toggles + `pop()` + toast with **SPA "View" action (fixed v1.4.0 — was `location.assign`, which broke on sub-path deploys and reloaded the app)**. `entityCard` now attaches the long-press/right-click quick-actions sheet (v1.4.0). |
| `filters.js` | 124 | `chipRow`, `selectField`, `searchField`, `switchField`, `viewToggle` | Semantic native controls (real `<select>`, `role="switch"`, `aria-pressed` chips). |
| `footer.js` | 96 | `renderFooter` | Brand block, Explore/Product columns, live enabled-provider attribution links (`rel="noopener noreferrer"`), legal line, `© 2026 CULINA · v1.4.0 · Designed & developed by Roshan`. |
| `header.js` | 208 | `renderHeader`, `updateActiveNav` | Brand, primary nav with accessible Drinks dropdown (aria-expanded, Escape, outside-click), search trigger (⌘K hint), theme cycler (light→dark→system), live favorites badge, mobile drawer, scroll elevation, global `/` + ⌘K shortcuts (typing- and dialog-aware). |
| `lightbox.js` **new 1.4** | 57 | `openLightbox`, `mountImageLightbox` | Tap a hero photo → enlarged `<dialog>` view (zoom-out cursor, Escape/backdrop/tap close, honest error copy if the provider image 404s). `mountImageLightbox(ctx, root)` uses **click delegation** on `.detail-hero-media img, .featured-media img`, so async-injected images are covered; cleanup via `ctx`. Wired on 7 pages: home, recipe, cocktail, beerDetail, breweryDetail, product, ingredient. |
| `mark-tile.js` | 8 | (side-effect) | Generated header mark tile. |
| `modal.js` | 112 | `openModal`, `openDrawer` | Native `<dialog>` (focus trap + inert backdrop for free). **v1.4.0:** animated exits (`dialogExit` 130 ms / `drawerExit` 160 ms — faster than entrances per the asymmetric-timing rule) and a `cancel`-event intercept so Escape goes through the same animated path; focus restore to the invoking element. |
| `nutrition.js` | 132 | `nutritionPanel`, `nutriscoreBadge`, `novaBadge` | Renders only what providers actually supply — absent fields stay absent (never 0, never invented). |
| `pagination.js` | 71 | `pagination`, `loadMoreButton` | Numbered pagination + progressive load-more (Discover uses load-more ≤2 pages then pager). |
| `plannerWidgets.js` | 264 | `plannerGrid`, `initSortable`, `addToPlanDialog`, `shoppingListDialog` | Week grid (7 days × 4 meals, max 6/slot), SortableJS drag & drop **with button alternatives on every item** (remove/duplicate), add-to-plan dialog, merged shopping-list dialog with unit-aware math. |
| `providerBadge.js` | 94 | `providerBadge`, `sourcePanel`, `providerStrip`, `providerStatusIcon`, `refreshProviderIcons` | Data-source transparency: every card carries its provider; the home strip shows live status dots. |
| `quickActions.js` **new 1.4** | 222 | `openQuickActions`, `attachQuickActions` | Long-press (touch/pen, 450 ms, 10 px move tolerance, scroll cancels, haptic tick) or right-click (desktop) opens an action sheet: Open · Save/Remove favorite · Add to plan (recipes/cocktails, dynamic import breaks the cycle) · Copy link (base-anchored absolute URL, clipboard guarded) · Share (Web Share API when present). **A11y contract:** every action is also reachable via visible UI. Click capture suppresses the tap that would follow a fired long-press. |
| `searchOverlay.js` | 345 | `openSearchOverlay` | ⌘K command palette: debounced 250 ms unified search, request abort on retype, grouped results with provider badges, full keyboard nav (arrows/Enter/Escape), `>` command mode (12 commands), recent searches (local, capped 8), suggestion chips, "View all N results" hand-off to `/search`. |
| `states.js` | 150 | `skeletonCard/Grid/Rows/Detail`, `loadingBlock`, `emptyState`, `errorState`, `partialFailureNotice`, `renderInto` | The state system (PRD §44): **no blank areas, ever.** Skeletons match final layout (CLS-safe), error states name the failing provider and offer retry, partial-failure notices render what succeeded. |
| `surprise.js` | 134 | `openSurprise` | Weighted random discovery across recipes/cocktails/fruits/breweries/food imagery; result dialog with save/plan/open actions. |
| `tabs.js` | 47 | `renderTabs` | WAI-ARIA tabs: roving tabindex, arrows, Home/End, `aria-selected`, count badges. |
| `toast.js` | 91 | `toast` | `aria-live="polite"` toasts (success/error/info) with optional action button. **v1.4.0:** stack capped at 3 (oldest yields), pointer-drag swipe-away with finger-follow + spring-back, dismiss guards against double-fire. |

---

## 5. Pages (`js/pages/`) — 34 route modules

Every page exports `render(ctx)` and follows the same contract:
`applyMeta()` → build DOM with `el()` → render skeletons into async hosts →
fetch with `ctx.signal` (aborted on navigation) → swap in data / `emptyState` /
`errorState` / `partialFailureNotice` → `refreshIcons()` → `mountReveal()` →
register teardown via `ctx.onCleanup`.

| Route | Module | L | Data | States & interactions (v1.4.0 additions in bold) |
| --- | --- | --- | --- | --- |
| `/` | `home.js` | 481 | MealDB, CocktailDB, SampleAPIs beers, Foodish | Hero + voice search (SpeechRecognition when exposed), today's inspiration (skeleton→card→retry), trending tabs **with swipe**, category tiles, kitchen band, recently-viewed, provider strip, **hero-photo lightbox** |
| `/discover` | `discover.js` | 519 | 6 providers | Entity tabs × per-entity filters × sort × grid/list × pagination, shareable URL state (**base-safe via `replaceUrl`**), **tab swipe on results** |
| `/search` | `search.js` | 246 | unified (7) | Debounced live search, grouped results, failure isolation notices, reveal motion |
| `/recipes` | `recipes.js` | 171 | MealDB | Letter index, category/cuisine filters, URL state (**base-safe**) |
| `/recipe/:id` | `recipe.js` | 298 | MealDB | Hero **(+lightbox)**, ingredients with measures, instructions, related, sticky save/plan bar, JSON-LD |
| `/ingredients` | `ingredients.js` | 214 | MealDB + Fruityvice | Two-source tabs (pantry/fruits) **with swipe**, local filter, URL state (**base-safe**) |
| `/ingredient/:source/:id` | `ingredient.js` | 274 | MealDB/Fruityvice | Detail **(+lightbox)**, nutrition panel (real data only), related recipes |
| `/nutrition` | `nutrition.js` | 205 | Fruityvice + OFF | Fruit comparison, product search, honest absence handling |
| `/products` | `products.js` | 180 | Open Food Facts | Name search + barcode lookup (validated EAN), URL state (**base-safe**) |
| `/product/:source/:id` | `product.js` | 168 | OFF | Detail **(+lightbox)**, Nutri-Score/NOVA badges, nutrition table |
| `/drinks` | `drinks.js` | 81 | CocktailDB teaser | Hub tiles to the four drink worlds + live teaser grid |
| `/cocktails` | `cocktails.js` | 221 | CocktailDB | A–Z index, glass/category filters, URL state (**base-safe**) |
| `/cocktail/:id` | `cocktail.js` | 211 | CocktailDB | Detail **(+lightbox)**, exact measures, glassware, IBA flags, related |
| `/beer` | `beer.js` | 154 | SampleAPIs | Ale/stout chips **with swipe + re-rendered chip state**, sort, URL state (**base-safe**) |
| `/beer/:style/:id` | `beerDetail.js` | 151 | SampleAPIs | Detail **(+lightbox)**, honest "not provided" fields, related |
| `/breweries` | `breweries.js` | 157 | Open Brewery DB | Search + country/type filters, cached pages (rate-limit aware), URL state (**base-safe**) |
| `/brewery/:name` | `breweryDetail.js` | 187 | Open Brewery DB | Detail **(+lightbox)**, website/phone links (safeUrl-guarded), nearby breweries |
| `/coffee` | `coffee.js` | 122 | SampleAPIs | Hot/iced chips **with swipe**, URL state (**base-safe**) |
| `/kitchen` | `kitchen.js` | 372 | local + MealDB | Ingredient input (validated, dedup), overlap ranking with exact match counts, `?add=` deep links |
| `/planner` | `planner.js` | 103 | local | Week grid, drag & drop + button alternatives, clear-week confirm, shopping-list dialog |
| `/shopping-list` | `shoppingList.js` | 239 | local | Merged + manual items, unit-aware math, **swipe-to-remove (pre-existing)**, check-off with pulse |
| `/favorites` | `favorites.js` | 216 | local | 7 collections with counts, sort, grid/list, per-collection empty states, **long-press quick actions**, **list-view swipe-to-unsave**, **collection swipe** |
| `/history` | `history.js` | 177 | local | Recent searches **with swipe-to-remove + toast feedback**, recently-viewed grid, clear buttons, disabled-state copy |
| `/health` | `health.js` | 207 | telemetry | 28-provider matrix, latency, classification, on-demand diagnostics (no polling) |
| `/settings` | `settings.js` | 247 | local | Theme (light/dark/system), larger text, history toggle, data stats, export/import (validated JSON)/reset with confirm |
| `/about` | `about.js` | 166 | static+registry | Mission, provider matrix, attribution, developer credit |
| `/privacy` | `privacy.js` | 59 | static | Local-first privacy statement — updated **5 September 2026** |
| `/terms` | `terms.js` | 62 | static | Terms of use — updated **5 September 2026** |
| `/accessibility` | `accessibility.js` | 56 | static | WCAG 2.2 AA statement + known limitations |
| `/categories` | `categories.js` | 79 | MealDB | Category index → filtered recipes |
| `/cuisines` | `cuisines.js` | 80 | MealDB | Area index → filtered recipes |
| `/food`, `/food/:source/:id` | `food.js` | 107 | Foodish | Random food imagery gallery (honest novelty surface) |
| `/offline` | `offline.js` | 51 | — | SW-served offline fallback |
| (no match) | app.js `notFoundView` | — | — | 404 empty-state with home CTA |
| — | `shared.js` | 92 | — | `pageHeader`, `section`, `sectionHead`, `docPage`, `mountReveal`, `refresh` |

---

## 6. Services (`js/services/`)

| Module | L | Storage key | Contract |
| --- | --- | --- | --- |
| `favorites.js` | 134 | `culina:v1:favorites` | 7 collections; `envelopeFor()` builds the canonical saved-item shape {id, entity, source, sourceId, title, image, subtitle, route}; `toggle`/`remove`/`has`/`counts`; every persist bumps `favoritesVersion` on `appState`. |
| `history.js` | 135 | `culina:v1:history` (+ legacy `recent-searches` migration) | Searches (cap 12) & views (cap 24), disableable from Settings, `recordSearch`/`recordView`/`removeSearch`/`clear`, sanitized on every read. |
| `planner.js` | 140 | `culina:v1:planner` | 7×4 grid, max 6 items/slot, add/removeAt/duplicateAt/move (drag)/clearDay/clearWeek, version-bump on persist. |
| `search.js` | 180 | — | `unifiedSearch(q)`: parallel `Promise.allSettled` across 7 providers → normalize → `dedupeItems` → deterministic `scoreItem` ranking → `{ query, groups, failures }`. One dead provider never sinks the search. |
| `settings.js` | 104 | `culina:v1:settings` | theme (light/dark/system + `cycleTheme`), largerText, historyEnabled; applies `data-theme` + `data-larger-text` on `<html>`; subscribes to system scheme changes. |
| `shopping.js` | 104 | — | `generateShoppingList(planned)`: merges recipe ingredients with **unit-aware quantity math** (g/kg, ml/l, tbsp/tsp, countables); mismatched units refuse to merge (tested); unspecified quantities flagged, not guessed. |
| `shoppingList.js` | 127 | `culina:v1:shopping-list` | Manual items + checked state, add/toggle/remove/clear, input limits from `validate.js`. |
| `surprise.js` | 88 | — | Weighted random across providers with fallbacks; returns a routable envelope. |

---

## 7. API layer (`js/api/`)

| Module | L | Role |
| --- | --- | --- |
| `client.js` | 216 | `apiRequest(url, opts)`: 10 s timeout (AbortController), 1 retry on network/5xx with jitter, **in-flight dedupe** (same URL → one fetch), TTL cache integration, error normalization, passive health telemetry on every call. |
| `cache.js` | 115 | In-memory + localStorage TTL cache (`culina-data-v1` SW cache complements it offline); TTL per endpoint class. |
| `errors.js` | 95 | `ApiError` with typed `ErrorType` (NETWORK/TIMEOUT/RATE_LIMIT/NOT_FOUND/SERVER/UNKNOWN), `userMessage()` (human copy per type), `normalizeError`, abort/timeout predicates, `assertObject/assertArray`. |
| `normalizer.js` | 356 | 18 **pure** functions: provider payloads → domain models. Unknown → `null` (never `0`, never fabricated). Ingredient extraction, measure parsing, instruction parsing, Nutri-Score/NOVA mapping. |
| `registry.js` | 662 | Machine-readable provider matrix: 28 entries × {id, name, docsUrl, access (DIRECT/PROXY_REQUIRED), classification (LIVE/API_KEY_REQUIRED/OAUTH_REQUIRED/UNAVAILABLE), endpoints, notes}. Adding a provider = 1 entry + 1 adapter + normalizer fns. |
| `health.js` | 127 | Passive telemetry (status, latency, lastError, lastCheck persisted in `culina:v1:health`) + on-demand `runDiagnostic` — never polls in the background. |
| `adapters/*.js` | 437 (9 files) | One per live provider: mealdb, cocktaildb, fruityvice (via `/api/fruityvice` gateway), foodish, openbrewerydb (page-randomized, cache-first for the 120 req/window limit), openfoodfacts (search retry on 503, reliable barcode path), beers, coffee. `index.js` exports the adapter map + `adapterFor`. |

**Gateway (`server.js`, root):** zero-dependency production server — serves `dist/` with SPA fallback, strict allowlist reverse proxy (`/api/fruityvice/api/fruit/(all|\d+)` only), method guard, path-traversal defense, security headers (CSP, HSTS on HTTPS, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`), `/healthz`. Contract-tested by `scripts/gateway-test.mjs` (**397 assertions**).

---

## 8. Utilities (`js/utils/`)

| Module | L | Exports | Notes |
| --- | --- | --- | --- |
| `dom.js` | 74 | `el`, `frag`, `svgEl`, `icon`, `clearNode`, `mount` | `el(tag, attrs, ...children)` microfactory: event props (`on*`), `style` objects, `hidden`/boolean attrs, arrays flattened, nulls dropped. **All HTML goes through text nodes — no `innerHTML` with data anywhere in the app** (XSS-safe by construction; the two `innerHTML` uses in the codebase are static strings: the PTR ring and lucide's own `createIcons`). |
| `icons.js` | 222 | `refreshIcons`, `Star` | Curated tree-shaken lucide set — **98 icons registered (v1.4.0: + ArrowUp, Link, ZoomIn)**, audit-verified against the installed package. |
| `format.js` | 141 | `S`, `N`, `truncate`, `titleCase`, `slug`, `safeUrl` (http/https only), `relativeTime`, `formatMs/Count/Rating`, `parseMeasure`, `splitList`, `queryTokens`, `ingredientKey`, `clamp01`, `normalizeTitle` | Display + safety helpers; `safeUrl` gates every external href. |
| `fn.js` | 69 | `debounce` (with `.cancel()`), `once`, `formatQuantity` | |
| `validate.js` | 73 | `cleanText`, `isValidQuery`, `addUnique`, `parseQuantity`, `validationMessage`, `INPUT_LIMITS`, `isAbortLike` | All user input passes through here (kitchen items, shopping list, search); limits tested. |
| `motion.js` | 150 | `prefersReducedMotion`, `pageEnter`, **`pageExit`**, `revealGrid`, `pop`, `pulse`, `dialogEnter`, **`dialogExit`**, `drawerEnter`, **`drawerExit`**, `toastEnter`, `staggerIn`, **`mountScrollProgress`** | The **only** module importing `motion` (Framer Motion's vanilla engine). Centralized timing/easing (`EASE_OUT = [0.22,1,0.36,1]`), reduced-motion contract: every helper no-ops or resolves instantly. Exit < enter (asymmetric timing). |
| `touch.js` | 152 | `makeSwipeable`, **`attachTabSwipe`** | Gesture layer #1: swipe-to-dismiss rows (destructive backdrop, 96 px threshold, rubber-band) and direction-locked horizontal tab swipes (70 px, never hijacks vertical scroll, ignores `.swipe-item`/dialogs so gesture layers don't fight). |
| `pullToRefresh.js` **new 1.4** | 113 | `attachPullToRefresh` | Gesture layer #2: coarse-pointer-only PTR; engages solely at scroll-top outside dialogs/controls/buttons; direction-locked; `preventDefault` only while pulling (blocks native PTR double-fire); resistance curve (×0.45, max 112 px); armed state at 68 px; haptic tick; re-renders the current route through the TTL cache. |

---

## 9. Stylesheets (`css/`) — cascade order matters

| File | L | Responsibility |
| --- | --- | --- |
| `tokens.css` | 240 | Primitives (brand six: Ember Gold `#FFB703`, Spicy Orange `#FB5607`, Fresh Green `#2ECC71`, Deep Crimson `#E63946`, Midnight `#0B0F19`, Cream `#FFF7E6`) → semantic tokens per theme (light: warm paper; dark: espresso/midnight). Type scale (clamp-based fluid), 4 px spacing rhythm, restrained radii, warm-tinted elevation, motion tokens, z-index scale (header 40 → toast 90), 44 px control height. Every color pairing AA-verified (`scripts/verify-contrast.py`). |
| `reset.css` | 95 | Modern reset, `box-sizing`, media defaults. |
| `base.css` | 175 | Typography, links, `:focus-visible` ring, skip-link, larger-text mode, selection color. |
| `layout.css` | 510 | Container system (1280/1440/780/680), grids (`grid-cards` + `.is-list` variants — **v1.4.0 extended for `.swipe-item` wrappers**), split layouts, sections. |
| `components.css` | 1773 | Buttons/chips/badges/inputs/switches/selects, cards + hover lift, skeletons (shimmer), state blocks, modal/drawer, tabs, toasts, planner grid, swipe items, nutrition badges, spinner keyframes. |
| `pages.css` | 635 | Page-specific: home hero/featured/tiles, kitchen, health table, history, settings rows, hub tiles. |
| `expansion.css` | 692 | v1.1 expansion surfaces: bottom nav, search overlay chrome, brewery hero, doc pages, listening mic state. |
| `gestures.css` **new 1.4** | 306 | Scroll-progress bar, PTR indicator (minimal glass: 8 px blur), back-to-top (glass, safe-area + bottom-nav aware), lightbox, action sheet, zoom-in affordance, press feedback (`:active` scale, compositor-only), reduced-motion kill-switch. |
| `utilities.css` | ~120 | Stack/cluster/muted/clamp/numeric/visually-hidden helpers. |
| `responsive.css` | 284 | 6 breakpoints (360/480/768/1024/1280/1440), print styles. |

---

## 10. Infrastructure & quality

- **Build:** `vite.config.js` — ES2020 target, vendor chunk (`motion` + `lucide` + `sortablejs`), dev/preview proxy for `/api/fruityvice`. `scripts/set-origin.mjs` rewrites absolute origins (canonical/OG/manifest) per deploy target.
- **PWA:** `public/manifest.webmanifest`, `public/sw.js` (cache `culina-static-1.4.0`; network-first navigations, immutable asset cache, TTL-capped data cache ≤120 entries, `/offline` fallback).
- **Tests (77):** `client.test.js`, `normalizer.test.js`, `search.test.js`, `storage.test.js`, `expansion.test.js` (validation/settings/history/shopping/planner/routes), **`router-url.test.js` (new v1.4 — 7 sub-path regressions)**. `node:test`, zero extra deps, per-file process isolation, DOM stubs in `tests/helpers/setup-storage.js`.
- **Static audit (`scripts/audit.mjs`, CI gate):** imports resolve · every JS-referenced CSS class exists · every icon name exists in lucide **and** the registry · 34 routes ↔ 34 loaders · internal links resolve.
- **Gateway suite (`scripts/gateway-test.mjs`, CI gate):** 397 assertions — security headers, SPA fallback, asset 404s, proxy allowlist, method guard, traversal defense, sitemap coverage, brand-asset byte-mirrors.
- **CI/CD:** `.github/workflows/ci.yml` (install → 77 tests → audit → build → `npm audit --audit-level=high` with registry-outage-only retry → gateway suite → E2E matrix Chromium+Firefox when browser binaries resolve) and `deploy.yml` (green-CI-only GitHub Pages deploy, sub-path build via `PUBLIC_URL`, artifact upload, Pages environment). No step swallows failures.
- **Docs:** `docs/` — API-VERIFICATION, BRAND-ASSET-MANIFEST, DESIGN-DECISIONS, EXPANSION-QA-REPORT, FINAL-RELEASE-AUDIT, GAP-REGISTER, MIGRATION-REPORT, RELEASE-CHECKLIST, **WIREFRAMES (new v1.4)**, **UX-UPGRADE-REPORT-v1.4 (new)**, brand forensics.

---

## 11. v1.4.0 audit findings (fixed in this release)

| # | Severity | Finding | Fix |
| --- | --- | --- | --- |
| F-1 | **High** | 9 pages synced filter/tab state with raw `history.replaceState('/path?…')` — on GitHub Pages project sites this escapes the `/culina/` base and breaks the URL (back-button, shareability, router matching). | `replaceUrl()` in router.js (base-anchored) + 7-test regression suite. |
| F-2 | Medium | Favorites toast "View" action used `location.assign('/favorites')` — full reload + same base-path breakage. | SPA `navigate('/favorites')`. |
| F-3 | Low | `APP.version` frozen at `1.1.0` since v1.1 (drawer + footer showed a stale version). | Aligned to `1.4.0`. |
| F-4 | Low | Policy pages dated 3 Sep 2026. | Refreshed to 5 Sep 2026. |
| F-5 | Info | Gesture coverage: swipe existed only on shopping-list rows; modals/toasts had entrance-only motion; no PTR, no long-press, no lightbox, no route-exit transition. | Full gesture/motion layer (see UX-UPGRADE-REPORT-v1.4). |

## 12. Historical context (release lineage)

- **v1.0.0** (2026-08) — production release: 21 routes, unified search, planner, favorites, health center, PWA, gateway, CI.
- **v1.1.0** — approved brand integration, release hardening, GitHub readiness; gap register G-01…G-23 closed (incl. developer credit); expansion surfaces (bottom nav, search overlay, 13 new routes → 34).
- **v1.2.0 / v1.3.0** (2026-09-04) — brand asset engineering: identity **traced from supplied artwork** (IoU-measured), full asset family, byte-mirror contracts, favicon/PWA/social sets.
- **v1.4.0** (2026-09-05) — **UX upgrade:** gesture & motion layer (PTR, tab swipe, long-press quick actions, image lightbox, swipe-to-remove, animated dialog/toast exits, route transitions, scroll progress, back-to-top), sub-path URL bugs fixed, 77 tests, catalog + wireframe documentation.
