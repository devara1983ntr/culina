# Brand Migration Report — v1.2.0 → v1.3.0

**Scope:** replace the v1.2.0 board-traced brand assets with geometry
**traced from the user-supplied original artwork** —
`assets/brand/source/culina-logo-board.png` (IMG-A, the logo composition)
and `assets/brand/source/culina-emblem-master.png` (IMG-B, the emblem
master) — the new absolute source of truth, and verify nothing regressed.

**Commit:** `f8ce17d` (+ this report). **Result:** local battery fully green
(§5), CI 3/3, deploy green, live verification 30/30 (§6).

---

## 1. What changed and why

The v1.2.0 system traced the *old* brand board: its Panel A/B regions, its
(derived, Playfair-outline) wordmark, its cream tile presentation. The
supplied artwork supersedes all of that:

| v1.2.0 (superseded) | v1.3.0 (this migration) |
|---|---|
| Emblem traced from old board Panel A (16 layers) | Emblem traced from the dedicated emblem master — 14 k-means layers, union IoU **0.908** |
| Wordmark = Playfair Display outlines (documented derivation) | Wordmark **traced from the board's own painted letterforms** — three-tone gold/deep/white, IoU 0.81–0.93 |
| Tagline/ornament absent from lockups (derived Playfair italic) | Tagline (*TASTE • DISCOVER • PLAN • ENJOY*, IoU 0.908) + utensil ornament (IoU 0.881) traced and composed into logo/lockup/social |
| Tile = Cream squircle + flat monogram | Tile = **Midnight #0B0F19 square + six-family simplified emblem** (the artwork's own app-icon presentation) |
| Logo PNGs letterboxed 512×185 | Natural aspect: 512×456 (dark) / 512×426 (light) |
| 14 SVGs (incl. monogram aliases) | **13 SVGs** (monogram family retired; `culina-wordmark`/`-light`, `culina-icon` added) |
| Social: emblem tile + wordmark + description | Social: emblem + wordmark + **tagline + ornament** + description, ink-budgeted to the 630 px canvas |

## 2. Deliverables produced

- **Vector family (13):** mark (+dark/light), emblem, icon, wordmark
  (+light), mark-tile, lockup (+light), logo (+dark/light) — all genuine
  traced Bézier geometry, zero raster embeds (asserted), byte-identical
  mirrors in `public/brand/`.
- **Favicon system:** SVG tile (= canonical mark-tile), 16/32/48 PNGs,
  3-frame ICO (16/32/48); `favicon-64.png` stays retired.
- **App icons:** 14 sizes (512→16) with §13 tiers — ≥64 px full geometry;
  48 px simple+thr 0; 32 px +4000; 16 px +12000 — never a blind downscale.
- **PWA:** 192/512 any + maskable, apple-touch 180 — full-bleed Midnight.
- **Social:** og-image 1200×630, twitter-card 1200×628.
- **Raster renders (24):** mark/emblem/wordmark/lockup/logo families incl.
  transparent variants; 52 rasterization targets, browser-true rendering.
- **Embedded mark:** `js/components/mark-tile.js` regenerated **by the
  pipeline** (new generator step), asserted path-for-path against the
  canonical tile by the gateway suite.
- **Docs:** `docs/BRAND-ASSET-MANIFEST.md` (v1.3.0 inventory),
  `docs/brand/BOARD-FORENSICS.md` (new sources, trace IoUs, six-family
  table), DESIGN-DECISIONS §22, GAP-REGISTER Round 3 (G-24…G-28), CHANGELOG
  1.3.0, README/CONTRIBUTING/MASTER path fixes.

## 3. What was retired

The complete v1.2.0 set — vectors, rasters, icons, favicons, PWA, social,
masters, build JSONs, the old board copy and the v1.2.0 trace scripts — is
archived under `assets/brand/archive/v1.2.0/`. Nothing live references it
(gateway asserts the retired surfaces 404: `/favicon-64.png`,
`/brand/culina-monogram.svg`). The stale `monogram-geom.json` build file was
deleted (not archived — superseded, not source).

## 4. Fidelity evidence (full tables in `docs/brand/BOARD-FORENSICS.md`)

| Asset | Layers | IoU |
|---|---|---|
| Emblem (IMG-B) | 14 color layers | union **0.9084** (worst layer 0.8437) |
| Wordmark (IMG-A) | 3 layers | 0.9265 / 0.8128 / 0.7991 |
| Tagline (IMG-A) | 1 | **0.9081** |
| Ornament (IMG-A) | 1 | **0.8809** |
| §13 six-family simplification | 6 | 0.842–0.943 per family |

Visual verification (hue-ASCII mapping, no vision available): source board
vs traced logo-dark side-by-side — emblem, wordmark, tagline and ornament
bands match in position and proportion; favicon-16 legible; og-image carries
all five ink bands (emblem 48–288, wordmark 314–443, tagline 466–487,
ornament 496–510, description 539–558).

## 5. Local battery (all green at `f8ce17d`)

| Gate | Result |
|---|---|
| Unit tests | 70/70 |
| Static audit | PASSED |
| WCAG 2.2 AA contrast | all pairs pass |
| Production build | ✓ |
| Gateway suite | **391/391** (new: no-raster-embed per served SVG, tile-module path-for-path embed, natural-aspect PNG dims) |
| Browser E2E — Chromium | **92/92** (new: header = traced emblem on Midnight tile; `/brand/culina-wordmark.svg` resolves) |
| Browser E2E — Firefox | **92/92** |

Two test-suite corrections were made during integration, both filed in
GAP-REGISTER Round 3: the provider-outage E2E check now polls up to 15 s
(single-shot 7 s was exceeded by sandbox load + retry backoff — the error
state verifiably appears), and the gateway tile-embed assertion is now
path-for-path (the module legitimately adds width/height/aria attributes).

## 6. Deployment & live verification

- Push `f8ce17d` → **CI 3/3** (quality + Chromium E2E + Firefox E2E) →
  **Deploy to GitHub Pages: success**.
- Live checks against `https://devara1983ntr.github.io/culina/` — **30/30**:
  - All **13 `/brand/*.svg`** byte-identical to canonical, SVG MIME, no
    raster embeds; `favicon.svg` == canonical tile.
  - `favicon.ico` = 3 frames (16/32/48); logo PNGs 512×456 / 512×426;
    social cards 1200×630 / 1200×628.
  - `sw.js` VERSION 1.3.0; splash uses `/brand/culina-mark-tile.svg`;
    manifest name "CULINA — Food Intelligence & Discovery" + maskable
    192/512.
  - Retired surfaces 404 (`favicon-64.png`, `culina-monogram.svg`).

## 7. Verdict

**BRAND SYSTEM READY** — v1.3.0 geometry is traced from the supplied
artwork at measured fidelity, integrated at every touchpoint (header, boot
splash, favicons, PWA, social, docs), archived cleanly, and verified end to
end: local battery, CI on both browser engines, deployment, and the live
surface. No placeholder assets, no renamed rasters, no raster-in-SVG, no
stale branding.
