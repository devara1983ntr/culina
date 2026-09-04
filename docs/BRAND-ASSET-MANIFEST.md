# CULINA — Brand Asset Manifest (v1.3.0)

The complete brand asset system, **traced from the supplied original artwork**
(the absolute source of truth):

- `assets/brand/source/culina-logo-board.png` (IMG-A, 1536×1024) — the brand
  board: emblem, wordmark, tagline, ornament, logo composition
- `assets/brand/source/culina-emblem-master.png` (IMG-B, 1024×1024) — the
  emblem master used for the trace (finer detail, isolated)

Every vector asset is genuine traced geometry (Bézier paths); no raster-in-SVG,
no renamed PNGs. Generation pipeline:

```
scripts/brand/trace_emblem.py    IMG-B emblem → 14 color layers (union IoU 0.91)
scripts/brand/trace_wordmark.py  IMG-A wordmark → 3 color layers (IoU 0.81–0.93)
scripts/brand/trace_tagline.py   IMG-A tagline (IoU 0.91) + ornament (IoU 0.88)
scripts/generate-brand-assets.py compose the 13-asset family (§13 size tiers)
node scripts/rasterize-brand.mjs browser-true rasterization of every PNG
```

Forensic source analysis: `docs/brand/BOARD-FORENSICS.md`.

## Asset status overview

- **ACTIVE** — every file listed below under `assets/brand/` and mirrored in
  `public/` (the serving surface). `public/brand/*.svg` are byte-identical
  mirrors of `assets/brand/vector/` (asserted by the gateway suite); raster
  mirrors are byte-identical too.
- **ARCHIVED** — the v1.2.0 and v1.1.0 asset sets live in
  `assets/brand/archive/v{v1.2.0,v1.1.0}/` for provenance. Nothing live
  references them (asserted).
- **THIRD-PARTY / APP ICONS (never brand assets)** — Lucide UI icons
  (`js/utils/icons.js`) and @fontsource fonts are product dependencies, not
  brand assets; they are untouched by this system.

## Canonical vector family — `assets/brand/vector/` (mirror: `public/brand/`)

| File | Bytes | Geometry |
|---|---|---|
| `culina-emblem.svg` | 199,393 | viewBox 0 0 512 512 |
| `culina-icon.svg` | 199,372 | viewBox 0 0 512 512 |
| `culina-lockup-light.svg` | 273,969 | viewBox 0 0 760 558 |
| `culina-lockup.svg` | 273,876 | viewBox 0 0 760 598 |
| `culina-logo-dark.svg` | 278,193 | viewBox 0 0 1329 1183 |
| `culina-logo-light.svg` | 278,280 | viewBox 0 0 780 649 |
| `culina-logo.svg` | 278,325 | viewBox 0 0 1329 1183 |
| `culina-mark-dark.svg` | 199,624 | viewBox 0 0 512 512 |
| `culina-mark-light.svg` | 199,417 | viewBox 0 0 512 512 |
| `culina-mark-tile.svg` | 60,394 | viewBox 0 0 64 64 |
| `culina-mark.svg` | 199,388 | viewBox 0 0 512 512 |
| `culina-wordmark-light.svg` | 50,711 | viewBox 0 0 967 192 |
| `culina-wordmark.svg` | 50,718 | viewBox 0 0 967 192 |

| Asset | Presentation |
|---|---|
| `culina-emblem.svg` | The full-color emblem alone — traced 14-layer geometry, transparent |
| `culina-lockup-light.svg` | Lockup for light grounds (Cream ground, midnight ink) |
| `culina-lockup.svg` | Formal lockup — emblem + CULINA + TASTE • DISCOVER • PLAN • ENJOY + ornament, on Midnight |
| `culina-logo-dark.svg` | Stacked logo for dark grounds — emblem + wordmark + tagline + ornament, transparent |
| `culina-logo-light.svg` | Stacked logo for light grounds (transparent) |
| `culina-logo.svg` | Presentation logo — Midnight card, cream badge, emblem, wordmark, tagline, ornament (README/docs) |
| `culina-mark-dark.svg` | Emblem recolored for dark grounds (pale ink on transparent) |
| `culina-mark-light.svg` | Emblem for light grounds (full color on transparent) |
| `culina-mark-tile.svg` | The favicon-style 64 px tile — Midnight squircle + §13 simplified emblem; embedded in js/components/mark-tile.js |
| `culina-mark.svg` | The canonical flat mark — golden C emblem (chef hat, fork, flame, cocktail, herb sprigs), transparent, for any ground |
| `culina-wordmark-light.svg` | Wordmark recolored for light grounds |
| `culina-wordmark.svg` | CULINA in Playfair Display 700 — traced three-color letterforms (gold/deep-gold/white), true outlines, no runtime font dependency |

## Favicon set — `assets/brand/favicon/` (mirror: `public/` root + `public/icons/`)

| File | Bytes | Geometry |
|---|---|---|
| `favicon-16.png` | 694 | 16×16 |
| `favicon-32.png` | 1,899 | 32×32 |
| `favicon-48.png` | 3,463 | 48×48 |
| `favicon.ico` | 6,110 | 16+32+48 (3-frame) |
| `favicon.svg` | 60,394 | viewBox 0 0 64 64 (= mark-tile) |

`favicon.svg` is the deliberate small-size variant (§13): the Midnight
squircle + six-family simplified emblem (min-area 700, forced crimson +
green). `favicon.ico` bundles 16+32+48. `favicon-64.png` stays retired
(SW cache key remains `favicon-48.png`; cache version bumped to 1.3.0).

## App icon family — `assets/brand/icons/`

| File | Bytes | Geometry |
|---|---|---|
| `culina-icon-128.png` | 11,988 | 128×128 |
| `culina-icon-144.png` | 14,401 | 144×144 |
| `culina-icon-152.png` | 15,614 | 152×152 |
| `culina-icon-16.png` | 426 | 16×16 |
| `culina-icon-180.png` | 20,247 | 180×180 |
| `culina-icon-192.png` | 22,441 | 192×192 |
| `culina-icon-256.png` | 34,545 | 256×256 |
| `culina-icon-32.png` | 1,313 | 32×32 |
| `culina-icon-384.png` | 62,324 | 384×384 |
| `culina-icon-48.png` | 2,784 | 48×48 |
| `culina-icon-512.png` | 92,449 | 512×512 |
| `culina-icon-64.png` | 4,016 | 64×64 |
| `culina-icon-72.png` | 4,832 | 72×72 |
| `culina-icon-96.png` | 7,585 | 96×96 |

- ≥ 64 px: full 14-layer traced emblem on the Midnight square.
- ≤ 48 px: **deliberate small-size variant** — §13 six-family simplification
  with size-tiered stroke thinning (never a blind downscale).

## PWA assets — `assets/brand/pwa/` (mirror: `public/icons/`)

| File | Bytes | Geometry |
|---|---|---|
| `apple-touch-icon.png` | 19,155 | 180×180 |
| `icon-192.png` | 22,441 | 192×192 |
| `icon-512.png` | 92,449 | 512×512 |
| `icon-maskable-192.png` | 15,598 | 192×192 |
| `icon-maskable-512.png` | 67,394 | 512×512 |

Maskable icons keep the emblem inside the 80% safe zone. `apple-touch-icon.png`
(180) is full-bleed Midnight; iOS applies its own corner mask.

## Social cards — `assets/brand/social/` (mirror: `public/social/`)

| File | Bytes | Geometry |
|---|---|---|
| `og-image.png` | 111,624 | 1200×630 |
| `twitter-card.png` | 111,605 | 1200×628 |

Composed entirely from traced paths (emblem, Playfair wordmark + tagline,
ornament, Inter description — *Discover food. Understand it. Make it yours.*)
— the cards carry no font dependency even as a source SVG.

## Raster renders — `assets/brand/raster/`

| File | Bytes | Geometry |
|---|---|---|
| `culina-emblem-128.png` | 17,173 | 128×128 |
| `culina-emblem-256.png` | 46,621 | 256×256 |
| `culina-emblem-512.png` | 118,735 | 512×512 |
| `culina-lockup-1200.png` | 284,324 | 1200×944 |
| `culina-lockup-light-1200.png` | 225,971 | 1200×998 |
| `culina-logo-dark-128.png` | 19,656 | 128×114 |
| `culina-logo-dark-256.png` | 55,415 | 256×228 |
| `culina-logo-dark-512.png` | 141,340 | 512×456 |
| `culina-logo-dark-64.png` | 6,780 | 64×57 |
| `culina-logo-light-128.png` | 10,765 | 128×107 |
| `culina-logo-light-256.png` | 29,539 | 256×213 |
| `culina-logo-light-512.png` | 80,167 | 512×426 |
| `culina-logo-light-64.png` | 3,910 | 64×53 |
| `culina-logo-transparent-512.png` | 141,340 | 512×456 |
| `culina-mark-128.png` | 22,298 | 128×128 |
| `culina-mark-256.png` | 61,077 | 256×256 |
| `culina-mark-512.png` | 149,678 | 512×512 |
| `culina-mark-dark-512.png` | 278,766 | 512×512 |
| `culina-mark-light-512.png` | 120,009 | 512×512 |
| `culina-mark-transparent-512.png` | 149,678 | 512×512 |
| `culina-wordmark-450.png` | 24,088 | 450×89 |
| `culina-wordmark-900.png` | 60,744 | 900×179 |
| `culina-wordmark-light-450.png` | 24,119 | 450×89 |
| `culina-wordmark-light-900.png` | 61,767 | 900×179 |

## The embedded mark — `js/components/mark-tile.js`

The app-embedded tile module (header mark + boot splash via
`public/brand/culina-mark-tile.svg`): a `export default` template string
carrying **every path of the canonical tile** (asserted by the gateway suite —
path-for-path, not byte-for-byte, because the module adds width/height/aria
attributes). `js/components/brand.js` inlines it; the SVG is parsed with
DOMParser and attached via importNode — no HTML injection path.

## Verification (all green at v1.3.0)

- Gateway suite 391/391 (SVG MIME + standalone + **no raster embeds**, ICO
  frames, PNG dims, byte-identical mirrors, manifest icons, tile-module
  embed, retired-asset absence).
- Browser E2E 92/92 on Chromium and Firefox (header renders the traced
  emblem on its Midnight tile; splash uses the canonical tile; all brand
  assets resolve).
- Unit 70/70 · audit · WCAG AA contrast · production build.
