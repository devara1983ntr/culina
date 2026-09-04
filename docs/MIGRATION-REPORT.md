# Brand Migration Report — v1.1.0 → v1.2.0

**Scope:** replace the v1.1.0 specification-reconstructed brand assets with
geometry **traced from the approved brand board**
(`docs/brand/culina-brand-board.png`), extend the family to every required
use case, and verify nothing regressed.

**Commit:** `b924547` (+ this report). **Result:** local battery fully green
(see §5). Deployment/live verification steps in §6.

---

## 1. What changed and why

The v1.1.0 mark was drawn from the *written* brand specification. Forensic
re-reading of the board (`docs/brand/BOARD-FORENSICS.md`) proved:

1. **The v1.1.0 source-region assumption was wrong** — it pointed at
   photographic texture (the board's food imagery), not the emblem.
2. The board presents the identity twice: **Panel A** (full-color emblem —
   delicate linework, gold/orange masses and a thin dark web painted directly
   on the shared cream badge surface; 61% cream / 23% color / 16% dark web
   at 6×) and **Panel B** (flat monogram — bold C, chef-hat terminal, fork in
   the aperture, green herb sprigs).
3. The board contains **no CULINA lettering**; its painted tagline letterforms
   match no real typeface (measured per-glyph: best ≈ 0.46 IoU).

v1.2.0 therefore ships **measured** geometry:

| Asset family | Built from | Fidelity |
|---|---|---|
| `culina-mark` (+dark/light, monogram aliases) | Panel B: threshold → find_contours → B-spline → cubic Bézier | IoU **0.969** vs source mask; Chromium render vs board crop **0.921** |
| `culina-emblem` | Panel A: 16-cluster k-means → per-layer contours, on the cream squircle tile | union IoU **0.918** |
| `culina-wordmark`, `culina-lockup`, logos, OG/Twitter cards | Playfair Display Italic **font outlines** (fontTools) | documented derivation (no board lettering exists) |
| `assets/brand/master/` | LANCZOS extractions (Panel A 4×, Panel B 4×, hero 3×) | faithful rasters, no invented detail |

The traced emblem renders flatter than the board's painted shading — an
honest, documented simplification (16 flat fills), which is exactly what the
spec's vector-fidelity branch requires.

## 2. File-level migration

**Added (canonical)**
- `assets/brand/vector/` — 14 SVGs: `culina-mark{-dark,-light}.svg`,
  `culina-monogram{,-cream}.svg`, `culina-emblem.svg`, `culina-wordmark{,-midnight}.svg`,
  `culina-lockup{,-light}.svg`, `culina-logo.svg`, `culina-logo-{dark,light}.svg`,
  `culina-mark-tile.svg` — byte-identical mirrors served from `public/brand/`.
- `assets/brand/{favicon,pwa,social,icons,raster}/` — canonical rasters +
  mirrors into `public/` (favicon set at root, icons in `public/icons/`,
  cards in `public/social/`).
- `assets/brand/source/` — board copy + forensic region map.
- `assets/brand/master/` — high-res raster masters (the §3 raster branch).
- `assets/brand/build/` — committed trace outputs (generator inputs).
- `scripts/brand/` — `trace_lib.py`, `trace_monogram.py`, `trace_emblem.py`,
  `wordmark_lib.py`, `build_wordmark.py`, `render-check.mjs`.
- `public/favicon.ico` (16+32+48), `public/favicon-48.png`,
  `public/icons/icon-maskable-192.png`.
- `docs/BRAND-ASSET-MANIFEST.md` — full inventory, fidelity numbers,
  typography derivation, safe areas, minimum sizes.

**Replaced (content superseded, names kept)** — `public/brand/*.svg` (6),
favicon 16/32 PNGs, PWA icons 192/512/maskable-512, apple-touch, OG/Twitter
cards, `js/components/mark-tile.js` (now embeds the traced tile), generator +
rasterizer (`scripts/raster-manifest.json` now 48 targets).

**Removed / retired**
- `public/favicon-64.png` (superseded by 48 + ICO) — `sw.js` cache key moved
  to `favicon-48.png`, cache version bumped `1.1.0 → 1.2.0` (clean swap, no
  stale-cache branding).
- `public/social/*.src.html` (v1.1.0 card generators; archived).

**Archived** — the complete v1.1.0 set in `assets/brand/archive/v1.1.0/`
(6 SVGs, raster manifest, README, social card sources). Referenced by
nothing live (asserted by the gateway suite).

**Integrated**
- `index.html`: favicon SVG + ICO + 16/32/48 + apple-touch 180.
- `manifest.webmanifest`: + `icon-maskable-192.png`.
- `css/tokens.css`: `--culina-{ember-gold,spicy-orange,fresh-green,
  deep-crimson,midnight,cream}` primitives + `--font-ui` (raw identity hues;
  UI keeps the AA-verified semantic tokens).
- `package.json` → 1.2.0; `public/sw.js` → v1.2.0.

## 3. Requirements compliance (tracing spec)

- **§3 genuine vectors:** every SVG is Bézier paths / font outlines — no
  raster-in-SVG, no renamed PNGs (gateway asserts SVG validity + mirrors).
- **§3 raster branch:** LANCZOS masters, no invented detail.
- **§13 small sizes:** ≤48 px icons are a *deliberate variant* (sprigs
  dropped, strokes expanded) — never a blind downscale; favicon.svg likewise.
- **Squircle geometry:** all badge-shaped assets use the board's rounded-
  square app-icon language (favicon.svg keeps the 64 px squircle).
- **Trace-if-vectorizable:** emblem color layers + monogram traced from the
  artwork (IoU above); typography documented as derived (no lettering on the
  board to trace).
- **Deployment:** sub-path-safe (relative manifest icons, `set-origin.mjs`
  rewrites social images at deploy).

## 4. Known limitations (documented, not hidden)

- The vector emblem is a 16-color flattening of painterly board shading —
  fidelity choice documented in `docs/BRAND-ASSET-MANIFEST.md`; the raster
  masters carry the painterly detail.
- Monogram herb sprigs trace at IoU 0.746 (small painted marks; kept ≥200 px
  area, token-mapped to Fresh Green).

## 5. Verification (executed, local)

| Check | Result |
|---|---|
| Unit tests (`node --test tests/`) | **70/70** |
| Route/link audit (`npm run audit`) | **PASSED** (34 routes) |
| WCAG 2.2 AA contrast (`verify-contrast.py`, both themes) | **ALL PAIRS PASS** |
| Production build (`vite build`) | ✓ 3.6 s |
| Gateway suite (`gateway-test.mjs`) | **381/381** (incl. brand contract: SVG validity, 14-vector mirrors, raster mirrors, ICO **3-frame** directory check, favicon dims, maskable 192, icon family, retired/archived reference scan) |
| E2E Chromium (`browser-qa.mjs`) | **92/92**, clean console |
| E2E Firefox | **92/92** (one transient font fetch during the offline-injection phase) |
| Render check (`scripts/brand/render-check.mjs`) | all 14 vector assets parse + render in Chromium |
| favicon.ico frame audit | 3 frames (16/32/48); each frame byte-embeds its dedicated render; PIL decodes all frames pixel-identical |

### Defect found & fixed during release verification

Live verification caught that `favicon.ico` shipped with a **single 16×16
frame** (the ad-hoc assembly step had silently written one frame instead of
three). Fixed *in the pipeline*, not by hand:

- `scripts/generate-brand-assets.py` now emits an `ico` assembly block
  (`favicon.ico` ← favicon-16/32/48.png) into `raster-manifest.json`;
- `scripts/rasterize-brand.mjs` assembles a proper 3-frame PNG-embedded ICO
  from the dedicated per-size renders (byte-copied, never rescaled);
- the gateway suite now parses the ICO directory and asserts 3 frames
  16/32/48 — the defect class is now regression-guarded;
- `--mirror-rasters` (previously only promised in the generator's usage
  text) is implemented: the canonical mirrors in `assets/brand/` are produced
  by the pipeline itself. Re-rasterizing all 48 targets reproduced every
  other PNG byte-identically (deterministic pipeline confirmed).

## 6. Deployment & live verification (after push)

```bash
git push origin main          # CI: unit + audit + build + gateway + E2E (both engines) + deploy
```

First deploy attempt failed in CI at the `npm audit` step — the npm
registry's audit endpoint was unavailable for the whole 5-retry window
(known transient; the same audit passes with **0 vulnerabilities** against
the live registry, and a re-run of the failed job deployed cleanly). CI
itself was green on the first pass: unit/audit/build/gateway ✓, E2E
chromium ✓, E2E firefox ✓.

Post-deploy smoke (against https://devara1983ntr.github.io/culina/):

```bash
BASE=https://devara1983ntr.github.io/culina
curl -sf $BASE/favicon.ico                     -o /dev/null && echo "ico OK"
curl -sf $BASE/favicon-48.png                  -o /dev/null && echo "48 OK"
curl -sf $BASE/icons/icon-maskable-192.png     -o /dev/null && echo "maskable OK"
curl -sf $BASE/brand/culina-emblem.svg         -o /dev/null && echo "emblem OK"
curl -sf $BASE/brand/culina-lockup.svg         -o /dev/null && echo "lockup OK"
curl -s  $BASE/favicon-64.png -o /dev/null -w "%{http_code}\n"   # expect 404
curl -s  $BASE/sw.js | grep -o "1\.2\.0" | head -1               # expect 1.2.0
```

In a browser: hard-reload once (SW cache v1.2.0 swaps in), verify the header
mark, tab favicon, and social preview (card validators).
