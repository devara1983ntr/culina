# Changelog

All notable changes to CULINA are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

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
