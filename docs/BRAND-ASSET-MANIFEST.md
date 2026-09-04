# CULINA — Brand Asset Manifest (v1.2.0)

The complete brand asset system, **traced from the approved brand board**
(`docs/brand/culina-brand-board.png` — the absolute source of truth). Every
vector asset is genuine traced geometry (Bézier paths); no raster-in-SVG, no
renamed PNGs. Generation pipeline:

```
scripts/brand/trace_monogram.py    Panel B monogram → Bézier paths (IoU 0.969)
scripts/brand/trace_emblem.py      Panel A emblem → 16 color layers (union IoU 0.918)
scripts/generate-brand-assets.py   compose family (typography via fontTools outlines)
node scripts/rasterize-brand.mjs   browser-true rasterization of every PNG
```

Forensic source analysis: `docs/brand/BOARD-FORENSICS.md`.

## Asset status overview

- **ACTIVE** — every file listed below under `assets/brand/` and mirrored in
  `public/` (the serving surface). `public/brand/*.svg` are byte-identical
  mirrors of `assets/brand/vector/` (asserted by the gateway suite).
- **ARCHIVED** — the v1.1.0 asset set lives in `assets/brand/archive/v1.1.0/`
  for provenance. Nothing live references it (asserted).
- **THIRD-PARTY / APP ICONS (never brand assets)** — Lucide UI icons
  (`js/utils/icons.js`) and @fontsource fonts are product dependencies, not
  brand assets; they are untouched by this system.

## Canonical vector family — `assets/brand/vector/` (mirror: `public/brand/`)

| File | Bytes | Geometry |
|---|---|---|
| `culina-emblem.svg` | 78,379 | viewBox 0 0 512 512 |
| `culina-lockup-light.svg` | 107,404 | viewBox 0 0 608.7 180.0 |
| `culina-lockup.svg` | 107,404 | viewBox 0 0 608.7 180.0 |
| `culina-logo-dark.svg` | 107,436 | viewBox 0 0 630.5 228.0 |
| `culina-logo-light.svg` | 107,470 | viewBox 0 0 630.5 228.0 |
| `culina-logo.svg` | 107,504 | viewBox 0 0 228.0 228.0 |
| `culina-mark-dark.svg` | 12,153 | viewBox 0 0 512 512 |
| `culina-mark-light.svg` | 12,224 | viewBox 0 0 512 512 |
| `culina-mark-tile.svg` | 12,232 | viewBox 0 0 64 64 |
| `culina-mark.svg` | 12,153 | viewBox 0 0 512 512 |
| `culina-monogram-cream.svg` | 12,153 | viewBox 0 0 512 512 |
| `culina-monogram.svg` | 12,153 | viewBox 0 0 512 512 |
| `culina-wordmark-midnight.svg` | 5,331 | viewBox 0 0 473.8 104 |
| `culina-wordmark.svg` | 5,331 | viewBox 0 0 473.8 104 |

| Asset | Presentation |
|---|---|
| `culina-mark.svg` | The canonical flat mark — Panel B monogram (bold C with chef-hat terminal, fork in the aperture, green herb sprigs), Midnight + Fresh Green, transparent |
| `culina-mark-dark.svg` | Monogram recolored Cream + Fresh Green for dark/midnight grounds |
| `culina-mark-light.svg` | Monogram on a Cream squircle tile for light surfaces |
| `culina-monogram.svg`, `culina-monogram-cream.svg` | Explicit aliases of the mark presentations above |
| `culina-emblem.svg` | The Panel A full-color emblem — traced color layers on the Cream squircle tile (the board paints the emblem directly on the badge surface; the tile *is* the ground) |
| `culina-wordmark.svg` / `-midnight` | CULINA in Playfair Display 700 Italic, true font outlines via fontTools (no runtime font dependency) |
| `culina-lockup.svg` / `-light` | Emblem tile + CULINA + *TASTE • DISCOVER • PLAN • ENJOY* — the formal lockup for spacious contexts |
| `culina-logo.svg` | Presentation logo: Midnight card + Cream badge + emblem + wordmark + tagline (readable on any ground; README/docs) |
| `culina-logo-dark.svg` / `culina-logo-light.svg` | Badge lockup for dark / light grounds (light adds an Ember-Gold keyline — contrast adjustment only) |
| `culina-mark-tile.svg` | The favicon-style 64 px tile (Cream squircle + monogram); embedded in `js/components/mark-tile.js` |

## Favicon set — `assets/brand/favicon/` (mirror: `public/` root + `public/icons/`)

| File | Bytes | Geometry |
|---|---|---|
| `favicon-16.png` | 567 | 16×16 |
| `favicon-32.png` | 1,240 | 32×32 |
| `favicon-48.png` | 1,821 | 48×48 |
| `favicon.ico` | 539 | 16+32+48 |
| `favicon.svg` | 6,311 | viewBox 0 0 64 64 |

`favicon.svg` is the deliberate small-size variant (§13): monogram only — no
herb sprigs — with stroke expansion for legibility from 16 px. `favicon.ico`
bundles 16+32+48. `favicon-64.png` is retired (SW cache key moved to
`favicon-48.png`, cache version bumped to 1.2.0).

## App icon family — `assets/brand/icons/`

| File | Bytes | Geometry |
|---|---|---|
| `culina-icon-128.png` | 5,151 | 128×128 |
| `culina-icon-144.png` | 5,954 | 144×144 |
| `culina-icon-152.png` | 6,343 | 152×152 |
| `culina-icon-16.png` | 490 | 16×16 |
| `culina-icon-180.png` | 7,618 | 180×180 |
| `culina-icon-192.png` | 8,202 | 192×192 |
| `culina-icon-256.png` | 11,531 | 256×256 |
| `culina-icon-32.png` | 1,037 | 32×32 |
| `culina-icon-384.png` | 17,973 | 384×384 |
| `culina-icon-48.png` | 1,715 | 48×48 |
| `culina-icon-512.png` | 24,789 | 512×512 |
| `culina-icon-64.png` | 2,311 | 64×64 |
| `culina-icon-72.png` | 2,619 | 72×72 |
| `culina-icon-96.png` | 3,739 | 96×96 |

- ≥ 64 px: full monogram + herb sprigs on the Cream squircle (the board's own
  app-icon mockup presentation, forensically located at board (1110,780)–(1170,840)).
- ≤ 48 px: **deliberate small-size variant** — sprigs dropped, strokes expanded
  (never a blind downscale).

## PWA assets — `assets/brand/pwa/` (mirror: `public/icons/`)

| File | Bytes | Geometry |
|---|---|---|
| `apple-touch-icon.png` | 5,834 | 180×180 |
| `icon-192.png` | 8,202 | 192×192 |
| `icon-512.png` | 24,789 | 512×512 |
| `icon-maskable-192.png` | 5,107 | 192×192 |
| `icon-maskable-512.png` | 16,042 | 512×512 |

Maskable icons keep the monogram inside the 80% safe zone (21% inset — safe
across Android mask shapes). `apple-touch-icon.png` (180) is full-bleed Cream
with the monogram; iOS applies its own corner mask.

## Social cards — `assets/brand/social/` (mirror: `public/social/`)

| File | Bytes | Geometry |
|---|---|---|
| `og-image.png` | 257,882 | 1200×630 |
| `twitter-card.png` | 257,560 | 1200×628 |

Composed entirely from traced paths (emblem tile, Playfair wordmark + tagline,
Inter description — *Discover food. Understand it. Make it yours.*) — the OG
card carries no font dependency even as a source SVG.

## Raster renders — `assets/brand/raster/`

| File | Bytes | Geometry |
|---|---|---|
| `culina-emblem-128.png` | 9,765 | 128×128 |
| `culina-emblem-256.png` | 25,208 | 256×256 |
| `culina-emblem-512.png` | 61,748 | 512×512 |
| `culina-lockup-1200.png` | 74,718 | 1200×355 |
| `culina-lockup-light-1200.png` | 78,136 | 1200×355 |
| `culina-logo-dark-128.png` | 4,381 | 128×46 |
| `culina-logo-dark-256.png` | 11,082 | 256×93 |
| `culina-logo-dark-512.png` | 27,827 | 512×185 |
| `culina-logo-dark-64.png` | 1,727 | 64×23 |
| `culina-logo-light-128.png` | 4,779 | 128×46 |
| `culina-logo-light-256.png` | 12,063 | 256×93 |
| `culina-logo-light-512.png` | 29,961 | 512×185 |
| `culina-logo-light-64.png` | 2,018 | 64×23 |
| `culina-mark-128.png` | 5,794 | 128×128 |
| `culina-mark-256.png` | 12,692 | 256×256 |
| `culina-mark-512.png` | 27,070 | 512×512 |
| `culina-mark-dark-512.png` | 26,401 | 512×512 |
| `culina-mark-light-512.png` | 23,412 | 512×512 |
| `culina-monogram-128.png` | 5,794 | 128×128 |
| `culina-monogram-256.png` | 12,692 | 256×256 |
| `culina-monogram-512.png` | 27,070 | 512×512 |
| `culina-wordmark-900.png` | 26,025 | 900×198 |

## Source & masters

- `assets/brand/source/culina-brand-board.png` — byte copy of the approved board.
- `assets/brand/source/board-regions.json` — forensic region map (both badges,
  hero, palette strip, tagline, app-icon mockup).
- `assets/brand/master/` — faithful LANCZOS extractions (no invented detail):

| File | Bytes | Geometry |
|---|---|---|
| `hero-illustration-3x.png` | 888,573 | 828×1107 |
| `panelA-emblem-4x.png` | 268,632 | 548×620 |
| `panelB-monogram-4x.png` | 160,239 | 544×596 |

The masters are the §3 “high-resolution raster master” branch: the board's
emblem is painted/photorealistic shading, so raster masters preserve it
exactly while the vector family carries the traceable structure.

## Archived (v1.1.0) — `assets/brand/archive/v1.1.0/`

| File | Bytes | Geometry |
|---|---|---|
| `README.md` | 550 |  |
| `culina-logo-dark.svg` | 14,268 | viewBox 0 0 401.8 96 |
| `culina-logo-light.svg` | 14,268 | viewBox 0 0 401.8 96 |
| `culina-logo.svg` | 14,268 | viewBox 0 0 401.8 96 |
| `culina-mark-tile.svg` | 2,273 | viewBox 0 0 64 64 |
| `culina-mark.svg` | 2,156 | viewBox 0 0 64 64 |
| `culina-wordmark.svg` | 3,745 | viewBox -2 -2 244.8 49.3 |
| `raster-manifest.json` | 18,670 |  |
| `social-sources` | 128 |  |

Superseded: the v1.1.0 mark was a specification reconstruction, and its
source-region assumption pointed at photographic texture rather than the
board's actual emblem (see `docs/brand/BOARD-FORENSICS.md`). Retained for
provenance only.

## Tracing fidelity (measured, not claimed)

| Trace | Method | IoU vs source mask |
|---|---|---|
| Panel B monogram | threshold → find_contours → B-spline → Douglas-Peucker → cubic Bézier | combined **0.969** (dark 0.966, sprigs 0.746) |
| Panel A emblem | 16-cluster k-means color layers → per-layer contours | union **0.918** (ground 0.910) |
| Monogram render check | headless-Chromium rasterization of the final SVG vs the board crop silhouette | **0.921** |

## Typography derivation (documented)

The board contains **no CULINA lettering** — the only text is the tagline
*TASTE • DISCOVER • PLAN • ENJOY* (italic serif) and unreadable 3 px swatch
labels (verified glyph-by-glyph; see BOARD-FORENSICS.md). The wordmark and
lockup typography therefore follow the board's typographic language —
high-contrast italic serif — using **Playfair Display Italic** (the project's
declared display font, self-hosted OFL), converted to true vector outlines.
Per-glyph comparison against the board's painted letterforms found no exact
typeface match (best candidate ≈ 0.46 IoU at 11 px), so this is a documented
derivation, not a trace.

## Safe areas & minimum sizes

- **Mark (monogram)**: legible to 16 px (favicon variant); full mark with
  sprigs ≥ 48 px. Minimum comfortable 24 px in UI chrome.
- **Emblem**: ≥ 96 px; below that use the monogram.
- **Wordmark**: ≥ 96 px wide.
- **Lockup**: ≥ 320 px wide; below that use mark + wordmark only.
- **Maskable icons**: monogram within the central 80% (21% inset).
- **apple-touch**: full-bleed plate, monogram at 71% (14.5% inset).

## Integration points (all verified)

`index.html` (favicon SVG+ICO+16/32/48+apple-touch, OG/Twitter),
`public/manifest.webmanifest` (icons incl. maskable 192+512, brand colors),
`public/sw.js` (v1.2.0 cache invalidation; retired favicon-64 dropped),
`js/components/mark-tile.js` (embedded canonical tile),
`js/components/brand.js` (BrandMark/BrandIcon/BrandLogo),
`css/tokens.css` (`--culina-*` brand primitives + `--font-ui`),
`js/seo.js` + `scripts/set-origin.mjs` (absolute social images).

## Verification

- Gateway suite: brand-asset contract (existence, MIME, exact dimensions, SVG
  validity, byte-identical mirrors incl. raster mirrors, manifest icons,
  favicon wiring, retired/archived reference scan).
- E2E section K: favicon wiring, brand/social asset resolution, manifest
  colors + icons, splash tile, header mark.
- Rasterizer: browser-true rendering of every PNG from the exact SVG bytes.
- Render checks: monogram SVG rasterized in Chromium matches the board crop
  at IoU 0.921; wordmark verified as true letterforms.
