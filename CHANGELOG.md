# Changelog

All notable changes to CULINA are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

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
