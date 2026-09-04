# CULINA Brand Board — Forensic Analysis

Source of truth: `docs/brand/culina-brand-board.png` (copy of
`uploads/file_000000001760821185b32dcf0edf5d01.png`), 1536×1024, midnight ground.
Method: programmatic only (color classification masks, connected components,
glyph bitmap segmentation). No vision available; ASCII-map technique.

## Board layout (verified coordinates)

| Region | Coordinates | Content |
|---|---|---|
| **Hero emblem illustration** | (208,64)–(484,433), 276×369 | Large culinary "C" emblem: cream→light-gold→gold→orange ribbon sweep, fork (parallel tines) in counter, deep-red accent (#C50201), green garnish accents, gold bottom arc |
| **Panel A badge** (primary) | (871,67)–(1008,222), 137×155 | Cream roundel (#FEF5E3) + full-color emblem: gold/orange diagonal C mass, crimson/orange cocktail cluster right, cream hat mass, green specks, dark ground (#2C2F33) |
| **Panel B badge** (monogram) | (871,243)–(1007,392), 136×149 | Cream roundel + flat dark monogram: bold C whose top terminal swells chef-hat-like, fork with separated tines nested in aperture, green herb sprigs |
| **Illustration column** | x744–828 (y92–205, y299–374, y435–474) | Small culinary illustrations |
| **Top-right illustration** | (1413,101)–(1496,192) | Leaf/herb illustration |
| **Mid-right illustrations** | (1102,319)–(1184,408), (900–1293, 660–705) | Culinary illustrations (bottle, leaf) |
| **Ingredient row** | x98–824, y438–554 | Ingredient illustrations |
| **Palette strip** | y480–538 | 5 swatches + midnight bg |
| **Utensil ornament** | x196–500, y538–550 | Gold knife/fork/spoon glyph row |
| **TAGLINE** | x100–587, y576–587 | `TASTE • DISCOVER • PLAN • ENJOY` — cream, italic serif, round bullets (verified glyph-by-glyph) |
| **Divider** | y602–616 | Horizontal rule + diamond center |
| **Icon strip** | x222–496, y627–662 | Gold outline icons: herb sprig, leaf, martini glass, serving dome, fork, ladle |
| **App-icon mockup** | (1110,780)–(1170,840), 60×60 | Cream rounded square + dark monogram + green herb accents (Panel B language) |
| **Device mockups** | y678–1024 | Phones/laptop showing app UI |

## Palette (sampled)

| Swatch | x-range | Sampled | Spec token |
|---|---|---|---|
| Gold | 1034–1089 | `#FDB10B` | `--culina-ember-gold` (#FFB703) |
| Orange | 1113–1167 | `#FE4F00` | `--culina-spicy-orange` (#FB5607) |
| Green | 1192–1246 | `#30BD71` | `--culina-fresh-green` (#2ECC71) |
| Crimson | 1274–1330 | `#E82F3C` | `--culina-deep-crimson` (#E63946) |
| Cream | 1438–1494 | `#FDF6E7` | `--culina-cream` |
| Midnight | board ground | (dark, ~#10131A family) | `--culina-midnight` |

Badge roundel cream: `#FEF5E3`/`#FEF6E3`. Panel A emblem interior samples:
gold `#FFAF23`/`#FED441`, orange `#F44700`/`#FE8A12`, cream `#FEF8EA`,
dark `#2C2F33`, warm gray `#D2C3B6`, light gold glow `#EFD08A`.

## Text findings

- **Only text on the board**: the tagline `TASTE • DISCOVER • PLAN • ENJOY`
  (italic serif, ~13 px caps, cream) + unreadable 3 px swatch labels.
- **No “CULINA” wordmark lettering exists anywhere on the board** (checked
  light-on-dark and dark-on-light, glyph-size component sweep of full board).
  The brand name is presented only through the emblem/monogram.
- Consequence (documented in BRAND-ASSET-MANIFEST): `culina-wordmark.svg`
  letterforms are **constructed** vector paths in the board’s typographic
  language (high-contrast italic serif, matching tagline glyph proportions),
  not traced from board lettering — because none exists. Tagline in the lockup
  uses the same constructed letterforms.

## v1.1.0 correction (historical)

The v1.1.0 “mark region” assumption (x190–485 y160–450) pointed at the hero
illustration / photographic texture, not an emblem. v1.1.0’s mark was a spec
reconstruction; it is superseded by the traced artwork in this release and
archived under `assets/brand/archive/`.

## Emblem character (corrected during tracing — important)

Measured composition of the Panel A interior (6× extraction, k-means): **61%
cream, ~23% colored elements, ~16% thin dark web**. The emblem is *not*
painted on a solid dark plate — it is **delicate linework, gold/orange masses
and a thin dark web painted directly on the shared cream badge surface**
(an earlier reading of "dark ground with colored emblem" was wrong; the
apparent darkness in coarse ASCII maps was mid-tone glow, mostly light-gold).
Consequences implemented in v1.2.0:

- `culina-emblem.svg` = traced layers on the cream squircle tile (the tile is
  the ground, exactly as the board paints it).
- `culina-mark.svg` = the Panel B **monogram** (bold, flat, transparent) — the
  canonical mark; the Panel A emblem is the illustrative presentation.
- Logo lockups = cream badge + emblem layers; OG card = emblem on its tile.

## Typography verification (measured)

Per-glyph aligned IoU of the board's painted tagline capitals vs candidate
italic serifs at native cap height: Playfair Display 400–700i ≈ 0.32–0.36,
Libre Bodoni 400–700i ≈ 0.40–0.44, EB Garamond ≈ 0.38–0.39, Cormorant
Garamond ≈ 0.41–0.46. **No exact typeface match** — the board's lettering is
a painted approximation. Production typography (wordmark, lockup tagline,
OG card) uses **Playfair Display Italic** (the declared display font) as true
font outlines via fontTools — documented derivation, not a trace.

## Vectorization strategy (as built, v1.2.0)

- **Panel B monogram** → `culina-mark` family: threshold → skimage
  find_contours → scipy B-spline → Douglas-Peucker → cubic Bézier paths.
  IoU vs source mask: 0.969 combined (0.966 dark / 0.746 sprigs — the sage
  sprigs are small painted marks; kept at ≥200 px area, token-mapped to
  Fresh Green). Chromium render of the final SVG vs the board crop
  silhouette: IoU 0.921.
- **Panel A emblem** → `culina-emblem`: 16-cluster seeded k-means →
  per-layer contour tracing. Union IoU 0.918. Palette is the artwork's own
  quantized colors (documented simplification: painterly shading → 16 flat
  fills).
- **Hero** → reference + raster master (3× LANCZOS).
- **Raster masters**: Panel A 4×, Panel B 4×, hero 3× — the §3
  “high-resolution raster master” branch (no invented detail).
- **Wordmark/lockup**: Playfair Display Italic outlines (see above).
