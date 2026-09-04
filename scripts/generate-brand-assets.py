#!/usr/bin/env python3
"""
CULINA — Brand asset generator v1.2.0 (traced from the approved board).

REAL VECTORIZATION (spec §3): geometry is traced from the approved brand
board (docs/brand/culina-brand-board.png) by scripts/brand/trace_monogram.py
(Panel B flat monogram — IoU-measured) and scripts/brand/trace_emblem.py
(Panel A full-color emblem — quantized color layers, IoU-measured). This
generator consumes the traced geometry (assets/brand/build/*.json) and emits
the canonical asset family. Nothing here re-invents the artwork; typography
is composed from true font outlines (fontTools) — no runtime font dependency.

Board presentations reproduced:
  • Panel A — cream squircle badge + organic dark plate + full-color emblem
    → culina-logo family (badge presentation) + culina-mark (full-color mark)
  • Panel B — cream squircle + flat dark monogram + green herb sprigs
    → culina-monogram → tiles, favicons, app icons (board's app-icon mockup)
  • Tagline (board, italic serif): TASTE • DISCOVER • PLAN • ENJOY

Outputs (canonical under assets/brand/, mirrored byte-equal under public/):
  vector/   culina-mark{,-dark,-light}.svg, culina-monogram{,-cream}.svg,
            culina-wordmark{,-midnight}.svg, culina-lockup{,-light}.svg,
            culina-logo.svg, culina-logo-{dark,light}.svg, culina-mark-tile.svg
  favicon/  favicon.svg (+ favicon-16/32/48.png, favicon.ico via raster step)
  icons/    culina-icon-{512,384,256,192,180,152,144,128,96,72,64,48,32,16}.png
  pwa/      icon-{192,512}.png, icon-maskable-{192,512}.png, apple-touch-icon.png
  social/   og-image.png (1200×630), twitter-card.png (1200×628)
  master/   faithful LANCZOS extractions of the board artwork (4×)
  source/   board copy + region map (forensic coordinates)

Rasters are rendered by scripts/rasterize-brand.mjs from the SVG strings in
scripts/raster-manifest.json; `--mirror-rasters` (run after rasterizing)
copies public/ outputs into the canonical assets/brand/ layout.
"""
from __future__ import annotations
import json
import pathlib
import shutil
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts" / "brand"))
from wordmark_lib import bounds, svg_text_group  # noqa: E402
from trace_lib import load_board, extract  # noqa: E402

BUILD = ROOT / "assets" / "brand" / "build"
AB = ROOT / "assets" / "brand"
PUBLIC = ROOT / "public"

# --- palette (tokens; artwork colors are preserved in masters) -----------
GOLD = "#FFB703"
ORANGE = "#FB5607"
GREEN = "#2ECC71"
CRIMSON = "#E63946"
MIDNIGHT = "#0B0F19"
CREAM = "#FFF7E6"
CREAM_70 = "#D9D2BF"  # cream @ ~78% on midnight (AA-adjacent supporting tone)

FONT_DIR = ROOT / "node_modules" / "@fontsource"
PF700I = FONT_DIR / "playfair-display/files/playfair-display-latin-700-italic.woff"
PF500I = FONT_DIR / "playfair-display/files/playfair-display-latin-500-italic.woff"
INTER400 = FONT_DIR / "inter/files/inter-latin-400-normal.woff"

TAGLINE = "TASTE • DISCOVER • PLAN • ENJOY"
DESCRIPTION = "Discover food. Understand it. Make it yours."

# --- traced geometry ------------------------------------------------------
mono = json.loads((BUILD / "monogram-geom.json").read_text())
emblem = json.loads((BUILD / "emblem-geom.json").read_text())
MONO_DARK, MONO_GREEN = mono["dark_path"], mono["green_path"]
EMBLEM_LAYERS = emblem["layers_full"]          # ground first, then elements
EMBLEM_ELEMENTS = emblem["layers_elements"]

for d in ("vector", "favicon", "icons", "pwa", "social", "master", "source",
          "raster", "archive"):
    (AB / d).mkdir(parents=True, exist_ok=True)
for d in ("brand", "icons", "social"):
    (PUBLIC / d).mkdir(parents=True, exist_ok=True)


def svg_wrap(vb, body, label, width=None, height=None):
    dims = f' width="{width}" height="{height}"' if width else ""
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}"{dims} role="img" '
            f'aria-label="{label}">\n{body}\n</svg>\n')


def squircle(size, radius_ratio, fill, extra=""):
    r = round(size * radius_ratio, 2)
    return f'<rect x="0" y="0" width="{size}" height="{size}" rx="{r}" fill="{fill}"{extra}/>'


def squircle_at(x, y, size, radius_ratio=0.19, fill=CREAM):
    r = round(size * radius_ratio, 2)
    return (f'<rect x="{x:.2f}" y="{y:.2f}" width="{size}" height="{size}" '
            f'rx="{r}" fill="{fill}"/>')


def mono_group(size, dark_fill, green_fill, include_green=True, stroke=0.0,
               inset=0.24):
    """Monogram (512-space paths) placed centered in a size×size box."""
    k = (1 - 2 * inset) * size / 512.0
    off = size * inset
    st = f' stroke="{dark_fill}" stroke-width="{stroke:.1f}"' if stroke else ""
    body = f'<path fill="{dark_fill}" fill-rule="evenodd"{st} d="{MONO_DARK}"/>'
    if include_green:
        body += f'\n<path fill="{green_fill}" fill-rule="evenodd" d="{MONO_GREEN}"/>'
    return f'<g transform="translate({off:.2f},{off:.2f}) scale({k:.6f})">\n{body}\n</g>'


def emblem_group(x, y, size, layers=EMBLEM_LAYERS, keyline=None):
    k = size / 512.0
    parts = []
    for i, L in enumerate(layers):
        st = (f' stroke="{keyline}" stroke-width="10"' if (keyline and i == 0) else "")
        parts.append(f'<path fill="{L["color"]}" fill-rule="evenodd"{st} d="{L["d"]}"/>')
    return f'<g transform="translate({x:.2f},{y:.2f}) scale({k:.6f})">\n' + "\n".join(parts) + "\n</g>"


# ---------------------------------------------------------------- text pieces
WM_TRACK = 0.045
TL_TRACK = 0.30
wx0, wy0, wx1, wy1, _ = bounds(PF700I, "CULINA", WM_TRACK)
WM_CAP = wy1 - wy0
WM_W_AT_CAP = (wx1 - wx0)
tx0, ty0, tx1, ty1, _ = bounds(PF500I, TAGLINE, TL_TRACK)
TL_CAP = ty1 - ty0
TL_W_AT_CAP = (tx1 - tx0)
dx0, dy0, dx1, dy1, _ = bounds(INTER400, DESCRIPTION, 0.0)
DS_CAP = dy1 - dy0
DS_W_AT_CAP = (dx1 - dx0)


def wordmark_group(cap, fill, x, baseline):
    s = cap / WM_CAP
    return svg_text_group(PF700I, "CULINA", WM_TRACK, fill, baseline, s,
                          x_origin=x - wx0 * s), WM_W_AT_CAP * s


def tagline_group(cap, fill, x, baseline):
    s = cap / TL_CAP
    return svg_text_group(PF500I, TAGLINE, TL_TRACK, fill, baseline, s,
                          x_origin=x - tx0 * s), TL_W_AT_CAP * s


def description_group(cap, fill, x, baseline):
    s = cap / DS_CAP
    return svg_text_group(INTER400, DESCRIPTION, 0.0, fill, baseline, s,
                          x_origin=x - dx0 * s), DS_W_AT_CAP * s


# ------------------------------------------------------------------ svg family
svgs = {}   # name -> content; written to assets/brand/vector + public/brand

# culina-mark — the canonical flat mark: Panel B monogram (transparent)
svgs["culina-mark.svg"] = svg_wrap(
    "0 0 512 512", mono_group(512, MIDNIGHT, GREEN, inset=0.03), "CULINA monogram")
# culina-mark-dark — cream recolor for dark/midnight grounds
svgs["culina-mark-dark.svg"] = svg_wrap(
    "0 0 512 512", mono_group(512, CREAM, GREEN, inset=0.03), "CULINA monogram")
# culina-mark-light — monogram on a cream squircle tile for light surfaces
svgs["culina-mark-light.svg"] = svg_wrap(
    "0 0 512 512",
    squircle(512, 0.19, CREAM) + "\n" + mono_group(512, MIDNIGHT, GREEN, inset=0.16),
    "CULINA monogram")
# explicit monogram aliases (same geometry; documented in the manifest)
svgs["culina-monogram.svg"] = svgs["culina-mark.svg"]
svgs["culina-monogram-cream.svg"] = svgs["culina-mark-dark.svg"]
# culina-emblem — the Panel A full-color emblem on its cream tile. The board
# paints the emblem directly on the cream badge surface (linework + gold
# masses + thin dark web; no separate plate), so the tile IS the ground.
EMBLEM_INSET = 0.135
EMBLEM_SIZE = 512 * (1 - 2 * EMBLEM_INSET)
svgs["culina-emblem.svg"] = svg_wrap(
    "0 0 512 512",
    squircle(512, 0.19, CREAM) + "\n"
    + emblem_group(512 * EMBLEM_INSET, 512 * EMBLEM_INSET, EMBLEM_SIZE),
    "CULINA emblem")
# wordmarks
def wordmark_svg(fill):
    s = 100.0 / WM_CAP
    g, w = wordmark_group(100, fill, 0, 0)
    g = svg_text_group(PF700I, "CULINA", WM_TRACK, fill, 100 + wy0 * s, s,
                       x_origin=2.0 - wx0 * s)
    return svg_wrap(f"0 0 {w + 4:.1f} 104", g, "CULINA wordmark"), w + 4
svgs["culina-wordmark.svg"], WM_W = wordmark_svg(CREAM)
svgs["culina-wordmark-midnight.svg"], _ = wordmark_svg(MIDNIGHT)

# lockup — [full-color mark] CULINA + tagline (transparent)
def lockup_svg(wm_fill, tl_fill):
    MARK, GAP, WM_CAP_H, TL_CAP_H, PAD = 168.0, 34.0, 84.0, 15.6, 6.0
    wm_g, wm_w = wordmark_group(WM_CAP_H, wm_fill, 0, 0)
    tl_g, tl_w = tagline_group(TL_CAP_H, tl_fill, 0, 0)
    text_w = max(wm_w, tl_w)
    W = PAD + MARK + GAP + text_w + PAD
    H = MARK + 2 * PAD
    wm_base = PAD + MARK * 0.5 + WM_CAP_H * 0.42
    tl_base = wm_base + 30.0
    wm_g, _ = wordmark_group(WM_CAP_H, wm_fill, PAD + MARK + GAP - wx0 * (WM_CAP_H / WM_CAP), wm_base)
    tl_x = PAD + MARK + GAP + (wm_w - tl_w) / 2 if tl_w <= wm_w else PAD + MARK + GAP
    tl_g, _ = tagline_group(TL_CAP_H, tl_fill, tl_x - tx0 * (TL_CAP_H / TL_CAP), tl_base)
    tile_in = MARK * EMBLEM_INSET
    body = (squircle_at(PAD, PAD, MARK) + "\n"
            + emblem_group(PAD + tile_in, PAD + tile_in, MARK - 2 * tile_in)
            + "\n" + wm_g + "\n" + tl_g)
    return svg_wrap(f"0 0 {W:.1f} {H:.1f}", body,
                    "CULINA — taste, discover, plan, enjoy")
svgs["culina-lockup.svg"] = lockup_svg(CREAM, CREAM)
svgs["culina-lockup-light.svg"] = lockup_svg(MIDNIGHT, MIDNIGHT)

# logo — badge presentation (Panel A construction)
def logo_svg(mode):
    # mode: "card" (midnight ground), "dark" (transparent, cream text), "light"
    BADGE, INSET = 200.0, 0.11
    GAP, WM_CAP_H, TL_CAP_H, PAD = 36.0, 78.0, 14.4, 14.0
    wm_fill = MIDNIGHT if mode == "light" else CREAM
    wm_g, wm_w = wordmark_group(WM_CAP_H, wm_fill, 0, 0)
    tl_g, tl_w = tagline_group(TL_CAP_H, wm_fill, 0, 0)
    text_w = max(wm_w, tl_w)
    W = PAD + BADGE + GAP + text_w + PAD
    H = BADGE + 2 * PAD
    wm_base = PAD + BADGE * 0.5 + WM_CAP_H * 0.42
    tl_base = wm_base + 28.0
    wm_g, _ = wordmark_group(WM_CAP_H, wm_fill, PAD + BADGE + GAP - wx0 * (WM_CAP_H / WM_CAP), wm_base)
    tl_x = PAD + BADGE + GAP + (wm_w - tl_w) / 2 if tl_w <= wm_w else PAD + BADGE + GAP
    tl_g, _ = tagline_group(TL_CAP_H, wm_fill, tl_x - tx0 * (TL_CAP_H / TL_CAP), tl_base)

    keyline = ' stroke="#FFB703" stroke-width="4"' if mode == "light" else ""
    badge_inner = BADGE * (1 - 2 * INSET)
    badge = (f'<g transform="translate({PAD:.1f},{PAD:.1f})">'
             f'{squircle(BADGE, 0.19, CREAM, keyline)}'
             + emblem_group(PAD_IN := BADGE * INSET, PAD_IN, badge_inner)
             + "</g>")
    body = badge + "\n" + wm_g + "\n" + tl_g
    if mode == "card":
        card = squircle(H, 0.10, MIDNIGHT)
        body = card + "\n" + body
        W = H  # square presentation card
        PAD2 = (W - (PAD + BADGE + GAP + text_w + PAD)) / 2
        # re-compose centered horizontally inside the square card
        wm_g2, _ = wordmark_group(WM_CAP_H, wm_fill, PAD2 + BADGE + GAP - wx0 * (WM_CAP_H / WM_CAP), wm_base)
        tl_x2 = PAD2 + BADGE + GAP + (wm_w - tl_w) / 2 if tl_w <= wm_w else PAD2 + BADGE + GAP
        tl_g2, _ = tagline_group(TL_CAP_H, wm_fill, tl_x2 - tx0 * (TL_CAP_H / TL_CAP), tl_base)
        badge2 = (f'<g transform="translate({(W - BADGE) / 2:.1f},{PAD:.1f})">'
                  f'{squircle(BADGE, 0.19, CREAM)}'
                  + emblem_group(BADGE * INSET, BADGE * INSET, badge_inner)
                  + "</g>")
        body = card + "\n" + badge2 + "\n" + wm_g2 + "\n" + tl_g2
    return svg_wrap(f"0 0 {W:.1f} {H:.1f}", body, "CULINA — taste, discover, plan, enjoy"), W, H

svgs["culina-logo.svg"], _, _ = logo_svg("card")
svgs["culina-logo-dark.svg"], LOGO_W, LOGO_H = logo_svg("dark")
svgs["culina-logo-light.svg"], _, _ = logo_svg("light")

# mark-tile — favicon-style tile (cream squircle + monogram, board mockup)
TILE = 64
tile_body = squircle(TILE, 0.19, CREAM) + "\n" + mono_group(TILE, MIDNIGHT, GREEN, inset=0.13)
svgs["culina-mark-tile.svg"] = svg_wrap(
    f"0 0 {TILE} {TILE}", tile_body, "CULINA", width=TILE, height=TILE)

# write vector family (canonical + mirror)
for name, content in svgs.items():
    (AB / "vector" / name).write_text(content)
    (PUBLIC / "brand" / name).write_text(content)

# favicon.svg — midnight squircle + simplified cream monogram (no sprigs)
fav_body = squircle(64, 0.20, MIDNIGHT) + "\n" + mono_group(
    64, CREAM, GREEN, include_green=False, stroke=5.5, inset=0.135)
favicon_svg = svg_wrap("0 0 64 64", fav_body, "CULINA", width=64, height=64)
(AB / "favicon" / "favicon.svg").write_text(favicon_svg)
(PUBLIC / "icons" / "favicon.svg").write_text(favicon_svg)

# ------------------------------------------------------------------ raster plan
def icon_svg(size, small=False):
    if small:  # §13 deliberate small-size variant: no sprigs, bolder strokes
        body = squircle(size, 0.19, CREAM) + "\n" + mono_group(
            size, MIDNIGHT, GREEN, include_green=False,
            stroke=size * 0.085, inset=0.16)
    else:
        body = squircle(size, 0.19, CREAM) + "\n" + mono_group(
            size, MIDNIGHT, GREEN, inset=0.13)
    return svg_wrap(f"0 0 {size} {size}", body, "CULINA")


def maskable_svg(size):
    body = squircle(size, 0.0, CREAM) + "\n" + mono_group(size, MIDNIGHT, GREEN, inset=0.21)
    return svg_wrap(f"0 0 {size} {size}", body, "CULINA")


def apple_touch_svg():
    body = squircle(180, 0.0, CREAM) + "\n" + mono_group(180, MIDNIGHT, GREEN, inset=0.145)
    return svg_wrap("0 0 180 180", body, "CULINA")


ICON_BIG = [512, 384, 256, 192, 180, 152, 144, 128, 96, 72, 64]
ICON_SMALL = [48, 32, 16]

# social cards (all text as vector outlines — no font dependency)
def og_svg(W, H):
    glow = (f'<radialGradient id="glow" cx="50%" cy="34%" r="62%">'
            f'<stop offset="0" stop-color="{GOLD}" stop-opacity="0.10"/>'
            f'<stop offset="1" stop-color="{GOLD}" stop-opacity="0"/></radialGradient>')
    body = [f"<defs>{glow}</defs>",
            f'<rect width="{W}" height="{H}" fill="{MIDNIGHT}"/>',
            f'<rect width="{W}" height="{H}" fill="url(#glow)"/>',
            f'<rect x="24" y="24" width="{W-48}" height="{H-48}" fill="none" '
            f'stroke="{GOLD}" stroke-opacity="0.35" stroke-width="2" rx="18"/>']
    EM, TOP = 250, 66
    tile_in = EM * EMBLEM_INSET
    body.append(squircle_at((W - EM) / 2, TOP, EM))
    body.append(emblem_group((W - EM) / 2 + tile_in, TOP + tile_in, EM - 2 * tile_in))
    wm_g, wm_w = wordmark_group(84, CREAM, 0, 0)
    wm_base = TOP + EM + 96
    body.append(svg_text_group(PF700I, "CULINA", WM_TRACK, CREAM, wm_base,
                               84 / WM_CAP, x_origin=(W - wm_w) / 2 - wx0 * (84 / WM_CAP)))
    tl_g, tl_w = tagline_group(19, GOLD, 0, 0)
    tl_base = wm_base + 40
    body.append(svg_text_group(PF500I, TAGLINE, TL_TRACK, GOLD, tl_base,
                               19 / TL_CAP, x_origin=(W - tl_w) / 2 - tx0 * (19 / TL_CAP)))
    ds_g, ds_w = description_group(17, CREAM_70, 0, 0)
    body.append(svg_text_group(INTER400, DESCRIPTION, 0.0, CREAM_70, tl_base + 36,
                               17 / DS_CAP, x_origin=(W - ds_w) / 2 - dx0 * (17 / DS_CAP)))
    return svg_wrap(f"0 0 {W} {H}", "\n".join(body), "CULINA — taste, discover, plan, enjoy")


targets = []
def tgt(svg, out, w, h):
    targets.append({"kind": "svg", "svg": svg, "out": out, "w": w, "h": h})

# favicon pngs (public root)
for s in (16, 32, 48):
    tgt(favicon_svg, f"favicon-{s}.png", s, s)
# pwa icons
for s in (192, 512):
    tgt(icon_svg(s), f"icons/icon-{s}.png", s, s)
    tgt(maskable_svg(s), f"icons/icon-maskable-{s}.png", s, s)
tgt(apple_touch_svg(), "icons/apple-touch-icon.png", 180, 180)
# social
tgt(og_svg(1200, 630), "social/og-image.png", 1200, 630)
tgt(og_svg(1200, 628), "social/twitter-card.png", 1200, 628)
# public logo pngs (spec: culina-logo-{dark,light}.{svg,png})
for mode, nm in (("dark", "culina-logo-dark"), ("light", "culina-logo-light")):
    s, W, H = logo_svg(mode)
    tgt(s, f"brand/{nm}.png", 512, round(512 * H / W))
# asset-family rasters (public staging → mirrored into assets/brand/)
for s in (512, 256, 128):
    tgt(svgs["culina-mark.svg"], f"assets/brand/raster/culina-mark-{s}.png", s, s)
    tgt(svgs["culina-emblem.svg"], f"assets/brand/raster/culina-emblem-{s}.png", s, s)
    tgt(svgs["culina-monogram.svg"], f"assets/brand/raster/culina-monogram-{s}.png", s, s)
tgt(svgs["culina-mark-dark.svg"], "assets/brand/raster/culina-mark-dark-512.png", 512, 512)
tgt(svgs["culina-mark-light.svg"], "assets/brand/raster/culina-mark-light-512.png", 512, 512)
for nm in ("culina-logo-dark", "culina-logo-light"):
    for s in (512, 256, 128, 64):
        svg = svgs[f"{nm}.svg"]
        W = float(svg.split('viewBox="0 0 ')[1].split('"')[0].split()[0])
        H = float(svg.split('viewBox="0 0 ')[1].split('"')[0].split()[1])
        tgt(svg, f"assets/brand/raster/{nm}-{s}.png", s, round(s * H / W))
tgt(svgs["culina-lockup.svg"], "assets/brand/raster/culina-lockup-1200.png", 1200, 355)
tgt(svgs["culina-lockup-light.svg"], "assets/brand/raster/culina-lockup-light-1200.png", 1200, 355)
tgt(svgs["culina-wordmark.svg"], "assets/brand/raster/culina-wordmark-900.png", 900, 198)
# icon family
for s in ICON_BIG:
    tgt(icon_svg(s), f"assets/brand/icons/culina-icon-{s}.png", s, s)
for s in ICON_SMALL:
    tgt(icon_svg(s, small=True), f"assets/brand/icons/culina-icon-{s}.png", s, s)

(ROOT / "scripts" / "raster-manifest.json").write_text(
    json.dumps({"targets": targets}, indent=1))

# mark-tile.js (in-app module; mirrors culina-mark-tile.svg exactly)
tile_raw = svgs["culina-mark-tile.svg"].strip()
(ROOT / "js" / "components" / "mark-tile.js").write_text(
    "/**\n * GENERATED by scripts/generate-brand-assets.py — do not edit.\n"
    " * The canonical CULINA tile mark (mirrors assets/brand + public/brand).\n"
    " * Geometry traced from the approved brand board (Panel B monogram).\n"
    " */\nexport default `" + tile_raw + "`;\n")

# ---------------------------------------------------------------- masters/source
board = load_board()
extract(board, 871, 67, 1008, 222, 4).save(AB / "master" / "panelA-emblem-4x.png")
extract(board, 871, 243, 1007, 392, 4).save(AB / "master" / "panelB-monogram-4x.png")
extract(board, 208, 64, 484, 433, 3).save(AB / "master" / "hero-illustration-3x.png")
shutil.copy2(ROOT / "docs" / "brand" / "culina-brand-board.png",
             AB / "source" / "culina-brand-board.png")
(AB / "source" / "board-regions.json").write_text(json.dumps({
    "board": "1536x1024, midnight ground",
    "panelA_badge": [871, 67, 1008, 222],
    "panelA_interior": [889, 85, 1000, 205],
    "panelB_badge": [871, 243, 1007, 392],
    "hero_illustration": [208, 64, 484, 433],
    "palette_strip_y": [480, 538],
    "swatches": {"gold": [1034, 1089], "orange": [1113, 1167],
                 "green": [1192, 1246], "crimson": [1274, 1330],
                 "cream": [1438, 1494]},
    "tagline_TASTE_DISCOVER_PLAN_ENJOY": [100, 576, 587, 589],
    "app_icon_mockup": [1110, 780, 1170, 840],
    "badge_shape": "rounded square ~137x155, r~26",
}, indent=1))

# generation report
report = {
    "vector": sorted(svgs.keys()),
    "raster_targets": len(targets),
    "trace_iou": {"monogram": mono["iou"], "emblem": emblem["iou"]},
    "tokens": {"gold": GOLD, "orange": ORANGE, "green": GREEN,
               "crimson": CRIMSON, "midnight": MIDNIGHT, "cream": CREAM},
}
(BUILD / "generation-report.json").write_text(json.dumps(report, indent=1))
print(f"vector family: {len(svgs)} SVGs → assets/brand/vector + public/brand")
print(f"raster targets: {len(targets)} → scripts/raster-manifest.json")
print(f"trace IoU: monogram={mono['iou']['combined']:.4f} emblem={emblem['iou']['full']:.4f}")
print("next: node scripts/rasterize-brand.mjs && python3 scripts/generate-brand-assets.py --mirror-rasters")
