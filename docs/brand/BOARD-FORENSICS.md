# CULINA Brand Sources — Forensic Analysis (v1.3.0)

Sources of truth (user-supplied originals; supersede the v1.2.0 brand board,
which is archived under `assets/brand/archive/v1.2.0/`):

| ID | File | Size | Role |
|---|---|---|---|
| **IMG-A** | `assets/brand/source/culina-logo-board.png` | 1329×1183 | Logo composition: emblem + wordmark + tagline + ornament, stacked |
| **IMG-B** | `assets/brand/source/culina-emblem-master.png` | 1254×1254 | Emblem master — isolated, finer detail; the trace source for the emblem |

Method: programmatic only (k-means color clustering, connected components,
glyph bitmap segmentation, band profiling). No vision available; hue-ASCII
map technique for visual verification.

## IMG-A — logo board layout (verified regions)

| Region | Coordinates | Content |
|---|---|---|
| **Emblem** | x178–1148, y49–830 | The full-color culinary emblem (below) |
| **Wordmark** | x170–1156, y830–1022 (ink 178.2–1144.8 × 830.0–1021.8) | `CULINA` — serif capitals with high-contrast strokes, three-tone paint (gold body, deep-gold shade, white sparkle) |
| **Tagline** | x226–1106, y1066–1100 (ink 227.8–1102.5 × 1071.0–1096.8) | `TASTE • DISCOVER • PLAN • ENJOY` — letter-spaced small caps, amber #D8921E |
| **Ornament** | x398–942, y1112–1150 (ink 415.5–929.2 × 1118.0–1149.5) | Gold utensil/garnish flourish row, #784500 |

Wordmark metrics: cap height 191.8 px on a 966.6 px ink width (ratio 5.04:1) —
the vector wordmark reproduces the traced letterforms at ink height, so the
type identity is the artwork's own, not a substituted font.

## IMG-B — emblem master (the identity)

Read from the trace layers, outer to inner:

- A **golden "C" ring** — the dominant mass: pale gold highlights (#FBF9F3,
  #FCEE96) over a gold→orange sweep (#FACB31, #F6A815, #E17C08, #B15907).
- A **white chef hat** cradled in the ring's upper opening (#FBF9F3/#EEE4D2
  with #D2BBA4/#B49069 shading).
- A **fork** at the center counter, tines up.
- A **flame and a red cocktail glass** in the lower-right opening
  (#E61F03, #8C2303).
- **Green herb sprigs** flanking the composition (#437503, #83B50B).

Trace region (60,40)–(1190,1140); ink bbox (84.0,58.5)–(1164.5,1122.0).

## Trace quality (IoU vs source masks)

| Asset | Layers | Union IoU | Notes |
|---|---|---|---|
| Emblem (IMG-B) | 14 color layers | **0.9084** | best #FBF9F3 0.9484 · worst #B15907 0.8437 |
| Wordmark (IMG-A) | 3 layers | — | gold #FAB625 **0.9265** · deep #A66003 0.8128 · white #FFFFFF 0.7991 |
| Tagline (IMG-A) | 1 layer | **0.9081** | #D8921E |
| Ornament (IMG-A) | 1 layer | **0.8809** | #784500 |

## §13 small-size simplification (six families)

The 14 emblem layers consolidate into 6 families for ≤48 px renders:

| Family | Absorbs | Area (source px) | Layer IoU |
|---|---|---|---|
| `#F7B728` gold | F6A815, FACB31, FBE25F, FCEE96 | 379,378 | 0.8913 |
| `#DC7307` orange | E17C08, B15907 | 211,567 | 0.8513 |
| `#DE2A05` crimson | E61F03, 8C2303 | 219,640 | 0.8424 |
| `#567F06` green | 437503, 83B50B | 207,401 | 0.8625 |
| `#F6F0E7` white/cream | FBF9F3, EEE4D2 | 328,182 | 0.9252 |
| `#C9AF92` tan | D2BBA4, B49069 | 111,023 | 0.9433 |

Size tiers: ≥64 px full 14-layer geometry · 48 px simple+thr 0 · 32 px
simple+thr 4000 · 16 px simple+thr 12000 · tile/favicon simple min-area 700
with crimson+green forced (they carry identity at 16 px).

## Grounds

The board paints the emblem directly on transparent/midnight grounds; the app
icon presentation (from the board's own usage) places the emblem on a
**Midnight #0B0F19 square** — matching the site's Midnight theme token.
`§26` palette tokens are unchanged by v1.3.0 (Ember Gold, Spicy Orange,
Fresh Green, Deep Crimson, Midnight, Cream); the traced layers are source
sampling, the tokens remain the spec.

## Precedence

1. These two files are the absolute source of truth for the mark and wordmark.
2. `design-system/culina/` rules still govern typography/spacing in-product;
   where its type identity conflicts with the artwork, the artwork wins.
3. The v1.2.0 board (`assets/brand/archive/v1.2.0/source/`) is historical.
