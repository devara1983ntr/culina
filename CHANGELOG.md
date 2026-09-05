# Changelog

All notable changes to CULINA are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

## [Unreleased]

Post-release production-maintenance pass (2026-09-05). Documentation and
repository hygiene only — no application behavior changes.

### Changed

- `README.md` rewritten as the comprehensive production document: full 34-route
  table, provider matrix including all 20 registered-but-not-enabled providers
  with truthful classifications, storage/PWA/motion/gesture models, npm-script
  reference, single consolidated deployment section, consolidated
  known-limitations, real-data policy and repository-hygiene policy. All counts
  re-verified against the tree (77 unit tests incl. `tests/router-url.test.js`,
  397 gateway assertions, 92-check E2E on Chromium + Firefox).

### Fixed

- Mobile home search capsule reconstructed around a 3-column CSS grid
  (`[lead icon | input | trailing actions]`): the lead icon now owns its own
  column (it could previously collapse onto the placeholder because an
  undefined `--space-11` token voided the input's left padding at computed-value
  time), the submit button and voice control are in-flow members of a trailing
  action cluster (the absolutely positioned button previously escaped the
  capsule and covered the microphone), the `[hidden]` clear control is honored
  (a missing reset let author `display` rules override the attribute), and the
  hard-coded `7rem` right-padding hack is gone. Below 480px — and inside the
  narrow hero column below 1200px — the capsule stacks the submit action onto
  its own full-width row so the placeholder is never clipped.
- Mobile spacing/clearance: quick-action chips meet the 44px touch target on
  coarse pointers with a consistent 12px rhythm; header controls keep an 8px
  gap on ≤400px viewports; body clearance and the recipe action bar / back-to-top
  offsets now derive from a `--bottom-nav-h` token plus `env(safe-area-inset-bottom)`
  instead of a hard-coded 64px that under-measured the real nav height.
- `docs/BRAND-ASSET-MANIFEST.md`: source-artwork dimensions corrected to the
  measured values (IMG-A 1329×1183, IMG-B 1254×1254), matching
  `docs/brand/BOARD-FORENSICS.md`; manifest marked current for v1.4.0 (brand
  frozen, unchanged).
- Dead references to the retired v1.1.0 brand board (`culina-brand-board.png`)
  in this file and `docs/GAP-REGISTER.md` now point at its preserved archive
  copy under `assets/brand/archive/v1.2.0/source/`.
- `js/utils/validate.js`: header comment referenced a nonexistent
  `tests/validate.test.js`; the validation unit tests live in
  `tests/expansion.test.js`.
- `.gitignore`: local environment files (`.env`, `.env.local`, `.env.*.local`)
  are now ignored; `.env.example` remains tracked.

### Added

- `scripts/mobile-qa.mjs` + `npm run test:mobile`: standalone 14-check mobile
  layout regression battery (touch viewport), executed for both engines in the
  CI e2e matrix alongside the 92-check E2E suite.

### Removed

- `docs/brand/culina-logo-board.png` and `docs/brand/culina-emblem-master.png`
  — unreferenced byte-identical duplicates of `assets/brand/source/` (the
  canonical copies referenced by the README, brand manifest, board forensics
  and the brand pipeline). `docs/brand/BOARD-FORENSICS.md` is retained.

## [1.4.0] — 2026-09-05

UX upgrade: a full gesture & motion layer on top of the v1.3.0 brand system,
plus deployment-critical URL fixes. Nothing removed — every screen, feature,
provider and state ships unchanged in behavior. Docs: full component catalog,
wireframes/flows and the upgrade report (`docs/COMPONENT-CATALOG.md`,
`docs/WIREFRAMES.md`, `docs/UX-UPGRADE-REPORT-v1.4.md`).

### Fixed — pre-push certification & release-verification findings
- **F-6 (High): scroll-progress exception spam** — `mountScrollProgress` used a
  one-argument callback for motion's `scroll()`, which dispatches on arity and
  passes such callbacks a progress *number*; destructuring `{ y }` threw on
  every scroll frame and the bar never worked. Now the two-argument
  `(progress, info)` form with a non-scrollable guard.
- **F-7: double action sheet on Android** — the native `contextmenu` a real
  Android long-press emits after the 450 ms timer no longer opens a second
  sheet (native menu still suppressed).
- **F-8: lost tap after sheet dismissal** — the click-suppression flag stayed
  armed when a long-press sheet was dismissed without a follow-up click,
  swallowing the next tap on a card link. Every fresh `pointerdown` disarms it.
- **F-9: social card URLs under sub-path** — runtime `og:image`/`twitter:image`
  fallbacks were absolutized against the bare origin, dropping the GitHub
  Pages base (`/culina/`) and 404ing share previews. Now base-prefixed;
  provider-specified route images pass through untouched.
- **F-10: share/copy-link under sub-path** — recipe & cocktail detail `share()`
  built absolute URLs without the deployment base; now `basePath()`-prefixed.

### Fixed
- **Sub-path URL escape (High)** — 9 pages synced filter/tab state with raw
  `history.replaceState('/path?…')`, which left the deployment base on GitHub
  Pages project sites (`/culina/`). New base-anchored `replaceUrl()` in
  `js/router.js`, migrated everywhere (beer, breweries, cocktails, coffee,
  discover, favorites, ingredients, products, recipes) and locked by a new
  7-test regression suite (`tests/router-url.test.js`).
- Favorites toast "View" action did a full-page `location.assign('/favorites')`
  (base-path unsafe) — now SPA `navigate()`.
- `APP.version` was stale at 1.1.0 in the drawer/footer — aligned to 1.4.0
  (package, constant and SW cache version move together from now on).
- Privacy & Terms "Last updated" refreshed to 5 September 2026.

### Added — gestures (every one an enhancement with a visible accessible twin)
- **Pull-to-refresh** (touch, scroll-top only, direction-locked, resistance
  curve, glass pill indicator, haptic tick) — revalidates the current route
  through the API client's TTL cache (`js/utils/pullToRefresh.js`).
- **Swipe between tabs** on Discover (6 entities), Ingredients, Favorites (7
  collections), Home trending, Beer and Coffee (`attachTabSwipe`, never
  hijacks vertical scroll, ignores row-level swipe items and dialogs).
- **Long-press / right-click quick actions** on every entity card: Open ·
  Save/Remove favorite · Add to plan · Copy link (base-anchored absolute URL) ·
  Share (Web Share API when available) — `js/components/quickActions.js`.
- **Swipe-left to remove** extended to History searches and Favorites
  list-view rows (shopping list already had it) with toast feedback.
- **Image lightbox** — tap hero photos on Home featured + recipe/cocktail/beer/
  brewery/product/ingredient details (`js/components/lightbox.js`, delegated so
  async images are covered).
- **Back-to-top** control (appears past 600 px, safe-area + bottom-nav aware)
  and a **reading-progress bar** (motion `scroll()`, 2 px, hidden at extremes).
- **Toast upgrades** — stack capped at 3, swipe-away with finger-follow and
  spring-back.

### Added — motion (all via the `motion` engine, centralized in `utils/motion.js`)
- Animated **route transitions**: outgoing view exits (120 ms) in parallel with
  the incoming chunk load — navigation is never blocked by animation.
- Animated **dialog/drawer exits** (faster than entrances; Escape intercepted
  through `cancel` so it animates too, native focus handling preserved).
- **Press feedback** (`:active` scale) on cards, chips, tiles, tabs, nav —
  touch-first alternative to hover.
- New stylesheet `css/gestures.css` (progress bar, PTR, back-to-top, lightbox,
  action sheet, press feedback) with a full `prefers-reduced-motion`
  kill-switch; minimal glassmorphism limited to the two floating surfaces.

### Tests
- 77 unit tests (was 70): +7 router sub-path regressions. Audit, build and the
  397-assertion gateway suite green.

## [1.3.0] — 2026-09-04

Brand re-engineering: the identity is **traced from the supplied original
artwork** (`assets/brand/source/` — logo board + emblem master), which
supersedes the v1.2.0 board and its derived typography.

### Changed
- **Emblem** — re-traced from the emblem master: 14 k-means color layers
  (union IoU 0.91) capturing the golden C ring, white chef hat, fork, flame,
  red cocktail and green sprigs. All mark/emblem/logo/lockup assets recomposed.
- **Wordmark, tagline, ornament** — now **traced from the board's own paint**
  (three-tone CULINA letterforms, IoU 0.81–0.93; *TASTE • DISCOVER • PLAN •
  ENJOY*; utensil ornament). This replaces the v1.2.0 Playfair-outline
  derivation — the type identity is the artwork's own.
- **Tile ground flipped to Midnight** — favicon/app-icon tile and the embedded
  header mark (`js/components/mark-tile.js`, regenerated) now present the
  simplified six-family emblem on a Midnight #0B0F19 square (the artwork's own
  app-icon presentation).
- **Social cards** recomposed: emblem + CULINA + tagline + ornament +
  *Discover food. Understand it. Make it yours.* on Midnight (1200×630 /
  1200×628), within the canvas ink budget.
- **Public logo PNGs** now render at natural aspect (512×456 / 512×426) —
  no more letterboxed 512×185 crops.
- SW cache version → 1.3.0.

### Added
- `culina-wordmark.svg` / `culina-wordmark-light.svg` to the served family
  (13 SVGs total); raster family gains transparent + light variants
  (24 renders, 52 rasterization targets).
- Gateway contract: no raster embeds in any served `/brand` SVG; tile-module
  embed asserted **path-for-path**; PNG dims at natural aspect (391 assertions).
- E2E section K: header = traced emblem on Midnight tile (paths ≥ 5, no
  gradients, no raster); `/brand/culina-wordmark.svg` resolves (92 checks).
- `docs/brand/BOARD-FORENSICS.md` rewritten for the new sources (layout map,
  trace IoUs, six-family §13 table).

### Removed
- The v1.2.0 monogram asset family (monogram, monogram-cream,
  wordmark-midnight) and its build geometry — **archived** complete under
  `assets/brand/archive/v1.2.0/` (with the v1.2.0 board and scripts).

## [1.2.0] — 2026-09-04

Brand asset engineering: the identity is now **traced from the approved
board artwork**, not reconstructed from the written spec.

### Added
- **Traced asset family** (see `docs/BRAND-ASSET-MANIFEST.md`): the Panel B
  monogram (IoU 0.97) as the canonical `culina-mark` (+ dark/light
  presentations), the Panel A full-color emblem as `culina-emblem` (16
  quantized color layers, union IoU 0.92), the formal `culina-lockup`
  (emblem + CULINA + tagline), `culina-logo-{dark,light}` badge lockups,
  and explicit monogram aliases — 14 canonical SVGs with byte-identical
  `public/brand/` mirrors.
- **Favicon set completed**: `favicon.ico` (16+32+48), `favicon-48.png`,
  SVG favicon as a deliberate small-size monogram variant (no sprigs,
  expanded strokes). `favicon-64.png` retired.
- **App icon family**: all 14 sizes (512→16) with a deliberate ≤48 px
  simplified variant; PWA icons gain `icon-maskable-192.png`; apple-touch
  (180) follows the board's own app-icon mockup (cream plate + monogram).
- **Social cards rebuilt** from traced paths only (emblem tile + Playfair
  wordmark + tagline + description) — no font dependency even at source.
- **Asset governance**: `assets/brand/{source,master,vector,raster,icons,
  favicon,pwa,social,archive}` structure; the board copy + forensic region
  map in `source/`; faithful LANCZOS raster masters in `master/`; the
  complete v1.1.0 set archived in `archive/v1.1.0/`.
- **Brand primitives in tokens**: `--culina-{ember-gold,spicy-orange,
  fresh-green,deep-crimson,midnight,cream}` + `--font-ui`.
- **Docs**: `docs/BRAND-ASSET-MANIFEST.md` (full inventory, tracing
  fidelity, typography derivation, safe areas, minimum sizes) and
  `docs/brand/BOARD-FORENSICS.md` (board region map, emblem character
  correction, typography verification).
- Gateway brand-asset contract extended: SVG validity, full vector-family
  mirrors, raster mirrors, icon-family dimensions, maskable 192, ICO,
  retired/archived reference scan.
- E2E section K extended: ICO + 48 px favicon wiring, emblem/lockup/maskable
  resolution.

### Changed
- `js/components/mark-tile.js` now embeds the traced monogram tile (was the
  v1.1.0 spec reconstruction); `brand.js` documentation updated.
- Service worker cache bumped to **1.2.0** (new branding precached; retired
  `favicon-64.png` cache key replaced by `favicon-48.png`).
- `manifest.webmanifest` icons: maskable 192 added.
- Wordmark/logo typography re-set in Playfair Display **Italic** (matching
  the board's tagline lettering language) as fontTools outlines.

### Fixed
- **The v1.1.0 mark was not the board's emblem**: forensic tracing located
  the true emblem (Panel A badge) and monogram (Panel B badge) on the board
  and proved the v1.1.0 source-region assumption pointed at photographic
  texture. All brand geometry is now measured from the artwork itself.

## [1.1.0] — 2026-09-04

Approved-brand integration, release hardening and public repository readiness.

### Added
- **Approved brand identity** (`docs/brand/culina-brand-board.png`): Ember
  Gold / Spicy Orange / Fresh Green / Deep Crimson / Midnight / Cream palette,
  Playfair Display + Inter typography (self-hosted, OFL), the C-mark
  (chef hat · fork · spoon · leaf · cocktail · flame) and the
  *TASTE • DISCOVER • PLAN • ENJOY* tagline across the product.
- **Brand asset system**: vector mark/tile/wordmark/logo SVGs (wordmark as
  true outlines via fontTools), favicon set (SVG + 16/32/64 PNG + apple-touch),
  PWA icons incl. maskable, and real 1200×630 Open Graph / Twitter cards —
  all generated from a single geometry source
  (`scripts/generate-brand-assets.py` + `scripts/rasterize-brand.mjs`).
- **Gateway brand-asset contract**: 32 new assertions (asset presence, MIME,
  exact pixel dimensions, byte-identical mirrors, manifest colors) — 72 total.
- **E2E section K — Brand identity & metadata** (10 checks): header mark,
  wordmark font, favicon links, absolute social images, splash asset, brand
  asset resolution, manifest colors, footer/about tagline + developer credit
  — 92 checks total.
- `scripts/verify-contrast.py` — WCAG 2.2 AA contrast proof for every token
  pairing in both themes.
- `scripts/set-origin.mjs` — deployment origin rewriting for sitemap, robots
  and social images.
- Community and release files: `LICENSE` (MIT), `SECURITY.md`,
  `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `.env.example`, this changelog.
- GitHub Pages deployment workflow (sub-path build, SPA 404 bootstrapping,
  origin rewriting) — deployment always gated on a green pipeline.
- Developer credit ("Designed & developed by Roshan") in the About page,
  footer and README.

### Changed
- Design tokens remapped to the approved palette; deepened/lightened shades
  are used only where AA contrast requires them (documented + verified).
- Service worker: scope-relative URLs (sub-path deployments supported) and
  cache version bump to 1.1.0.
- Manifest: brand colors, SVG icon entry, `id`/`start_url`/`scope` made
  deployment-agnostic.
- OG/Twitter metadata: large-image cards, runtime-absolute image URLs.
- README rebuilt as the project landing document (real screenshots, provider
  matrix, deployment, CI, browser support matrix).

### Fixed
- Favicon set was incomplete (no SVG/16/32 variants).
- OG image was a raw app icon instead of a real social card; Twitter card was
  `summary` instead of `summary_large_image`.
- No LICENSE file despite the MIT declaration in package.json.

## [1.0.0] — 2026-09-03

Initial production release.

- 34-route food intelligence platform: recipes, ingredients, nutrition,
  products, cocktails, beer, breweries, coffee, kitchen match, meal planner,
  favorites, history, shopping list, API health center, About + legal pages.
- Unified provider architecture: 28 registered providers (8 enabled, keyless),
  adapters + normalizers + health telemetry; honest degradation everywhere.
- Local-first persistence (`culina:v1:*`), PWA with offline shell, enforced
  CSP + security headers via the zero-dependency gateway.
- Quality gates: 70 unit tests, static audit, 72→40 gateway assertions,
  dual-engine browser E2E (Chromium + Firefox), CI pipeline with no
  failure-ignoring steps, release documentation set (GAP-REGISTER,
  RELEASE-CHECKLIST, FINAL-RELEASE-AUDIT, DESIGN-DECISIONS).
