#!/usr/bin/env python3
"""CULINA — brand asset generator (v1.3.0, traced from the approved artwork).

Source of truth (supplied by the brand owner — the approved identity):
  assets/brand/source/culina-emblem-master.png   standalone emblem (1254²)
  assets/brand/source/culina-logo-board.png      full logo presentation

Everything in the vector family is REAL traced geometry from those two files
(scripts/brand/trace_{emblem,wordmark,tagline}.py → assets/brand/build/*.json):
the emblem is 14 quantized color layers (k-means, union IoU ≈ 0.92), the
CULINA wordmark is 3 traced layers (gold/deep/white, IoU 0.93), the tagline
and ornament are traced silhouettes (IoU 0.91/0.88). No raster-in-SVG, no
renamed PNGs. The only non-traced text is the OG description line, set in
Inter via fontTools outlines (metadata text, not the wordmark).

Outputs
  assets/brand/vector/*.svg   canonical vector family (14 SVGs)
  public/brand/*.svg          byte-identical mirrors
  scripts/raster-manifest.json  raster targets + favicon.ico assembly
  run `--mirror-rasters` after rasterizing to copy public/ rasters into
  assets/brand/{favicon,pwa,social}.

Identity rules (brand task spec):
  §12 app icon   square midnight canvas + emblem, safe area, no text
  §13 small size deliberate simplified variant ≤48 px (component pruning,
                 never a blind downscale), color separation preserved
  §14 favicon    midnight tile + simplified emblem, no text
  §18 light mode midnight badge carries the emblem on light surfaces
"""
from __future__ import annotations
import json
import pathlib
import shutil
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
AB = ROOT / "assets" / "brand"
BUILD = AB / "build"
sys.path.insert(0, str(ROOT / "scripts" / "brand"))

# ---------------------------------------------------------------- tokens
MIDNIGHT = "#0B0F19"
CREAM = "#FFF7E6"
GOLD = "#FFB703"
CREAM_70 = "#D9D2BF"

# light-surface recolors (§8/§18: contrast adjustment only)
WM_LIGHT = {"gold": "#B0690A", "deep": "#8A5402", "white": "#E3B95F"}
TL_GOLD = "#D8921E"        # tagline ink on midnight (measured)
TL_LIGHT = "#8A5402"       # tagline ink on light
ORN_GOLD = "#9A6A10"       # ornament on midnight
ORN_LIGHT = "#8A5402"

# ------------------------------------------------------------- geometry
E = json.loads((BUILD / "emblem-geom.json").read_text())
ES = json.loads((BUILD / "emblem-geom-simple.json").read_text())
W = json.loads((BUILD / "wordmark-geom.json").read_text())
T = json.loads((BUILD / "tagline-geom.json").read_text())

E_REG, E_U, E_IB = E["region"], E["upscale"], E["ink_bbox"]
E_W, E_H = E_IB[2] - E_IB[0], E_IB[3] - E_IB[1]
W_REG, W_U, W_IB = W["region"], W["upscale"], W["ink_bbox"]
W_W, W_H = W_IB[2] - W_IB[0], W_IB[3] - W_IB[1]


def _fit_group(region, upscale, ink_bbox, box, layers, extra_filter=None):
    """Aspect-fit a traced zone into box=(x,y,w,h); return (transform, paths)."""
    iw, ih = ink_bbox[2] - ink_bbox[0], ink_bbox[3] - ink_bbox[1]
    k = min(box[2] / iw, box[3] / ih)
    su = k / upscale
    tx = box[0] + (box[2] - iw * k) / 2 - (region[0] - ink_bbox[0]) * k
    ty = box[1] + (box[3] - ih * k) / 2 - (region[1] - ink_bbox[1]) * k
    parts = []
    for layer in layers:
        if extra_filter and not extra_filter(layer):
            continue
        d = " ".join(p["d"] + " " + " ".join(p["holes"]) for p in layer["paths"])
        color = layer.get("fill_override", layer["color"])
        parts.append(f'<path fill="{color}" fill-rule="evenodd" d="{d}"/>')
    return f'translate({tx:.2f},{ty:.2f}) scale({su:.6f})', "".join(parts)


def emblem_group(box, min_src_area=0, force_colors=(), simple=False):
    """Emblem layers aspect-fit into box. min_src_area prunes small components
    (source px²) for the §13 small-size variant; force_colors keeps the
    largest component of each named color family for color separation.
    simple=True uses the §13 small-size geometry (6 color families)."""
    src = ES if simple else E
    layers = []
    for L in src["layers"]:
        paths = []
        for p in L["paths"]:
            src_area = p["area"] / (E_U * E_U)
            if src_area >= min_src_area:
                paths.append(p)
        if not paths and force_colors and L["color"] in force_colors:
            biggest = max(L["paths"], key=lambda p: p["area"])
            paths = [biggest]
        if paths:
            layers.append({**L, "paths": paths})
    return _fit_group(E_REG, E_U, E_IB, box, layers)


def wordmark_group(box, light=False):
    layers = []
    for L in W["layers"]:  # paint order: deep → gold → white
        layers.append({**L, "fill_override": WM_LIGHT[L["name"]] if light else L["color"]})
    return _fit_group(W_REG, W_U, W_IB, box, layers)


def tagline_group(scale=1.0, light=False):
    """Tagline traced silhouette at natural size × scale (source px units).
    Returns (svg_group, width, height)."""
    z = T["tagline"]
    ib = z["ink_bbox"]
    reg = z["region"]
    w, h = (ib[2] - ib[0]) * scale, (ib[3] - ib[1]) * scale
    d = " ".join(p["d"] + " " + " ".join(p["holes"]) for p in z["paths"])
    fill = TL_LIGHT if light else TL_GOLD
    tx = (reg[0] - ib[0]) * scale
    ty = (reg[1] - ib[1]) * scale
    g = (f'<g transform="translate({tx:.2f},{ty:.2f}) scale({scale / z["upscale"]:.6f})">'
         f'<path fill="{fill}" fill-rule="evenodd" d="{d}"/></g>')
    return g, w, h


def ornament_group(scale=1.0, light=False):
    z = T["ornament"]
    ib = z["ink_bbox"]
    reg = z["region"]
    w, h = (ib[2] - ib[0]) * scale, (ib[3] - ib[1]) * scale
    d = " ".join(p["d"] + " " + " ".join(p["holes"]) for p in z["paths"])
    fill = ORN_LIGHT if light else ORN_GOLD
    tx, ty = (reg[0] - ib[0]) * scale, (reg[1] - ib[1]) * scale
    g = (f'<g transform="translate({tx:.2f},{ty:.2f}) scale({scale / z["upscale"]:.6f})">'
         f'<path fill="{fill}" fill-rule="evenodd" d="{d}"/></g>')
    return g, w, h


def svg_wrap(view_box, body, title, desc=None):
    d = f"<desc>{desc}</desc>" if desc else ""
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{view_box}" '
            f'role="img" aria-labelledby="t"><title id="t">{title}</title>{d}'
            f"{body}</svg>")


def layer_paths_svg(layers):
    return "".join(
        f'<path fill="{l["color"]}" fill-rule="evenodd" '
        f'd="{" ".join(p["d"] + " " + " ".join(p["holes"]) for p in l["paths"])}"/>'
        for l in layers)


# ------------------------------------------------------------ family
svgs = {}

# 1 · culina-mark — the approved emblem, transparent (§9)
tr, body = emblem_group((0, 0, 512, 512))
svgs["culina-mark.svg"] = svg_wrap("0 0 512 512", f'<g transform="{tr}">{body}</g>',
                                   "CULINA mark — golden C emblem with chef hat, "
                                   "fork, flame, cocktail and herbs")

# 2 · culina-mark-dark — emblem + subtle midnight glow for dark surfaces (§9/§17)
tr, body = emblem_group((36, 36, 440, 440))
svgs["culina-mark-dark.svg"] = svg_wrap(
    "0 0 512 512",
    '<defs><radialGradient id="halo" cx="50%" cy="50%" r="50%">'
    f'<stop offset="55%" stop-color="{MIDNIGHT}" stop-opacity="0.55"/>'
    '<stop offset="100%" stop-color="#0B0F19" stop-opacity="0"/></radialGradient></defs>'
    f'<circle cx="256" cy="256" r="256" fill="url(#halo)"/>'
    f'<g transform="{tr}">{body}</g>',
    "CULINA mark for dark surfaces — emblem with midnight glow")

# 3 · culina-mark-light — midnight squircle badge (§9/§18: light surfaces)
tr, body = emblem_group((46, 46, 420, 420))
svgs["culina-mark-light.svg"] = svg_wrap(
    "0 0 512 512",
    f'<rect width="512" height="512" rx="97" fill="{MIDNIGHT}"/>'
    f'<g transform="{tr}">{body}</g>',
    "CULINA mark on midnight badge — for light surfaces")

# 4 · culina-emblem — roundel (avatar-like placements, §9)
tr, body = emblem_group((56, 56, 400, 400))
svgs["culina-emblem.svg"] = svg_wrap(
    "0 0 512 512",
    f'<circle cx="256" cy="256" r="256" fill="{MIDNIGHT}"/>'
    f'<g transform="{tr}">{body}</g>',
    "CULINA emblem roundel on midnight")

# 5/6 · wordmark (§10) — traced letterforms, natural size 967×192
wtr, wm_dark = wordmark_group((0, 0, W_W, W_H))
svgs["culina-wordmark.svg"] = svg_wrap(f"0 0 {W_W:.0f} {W_H:.0f}",
                                       f'<g transform="{wtr}">{wm_dark}</g>',
                                       "CULINA wordmark — traced gold lettering")
wtr, wm_light = wordmark_group((0, 0, W_W, W_H), light=True)
svgs["culina-wordmark-light.svg"] = svg_wrap(f"0 0 {W_W:.0f} {W_H:.0f}",
                                             f'<g transform="{wtr}">{wm_light}</g>',
                                             "CULINA wordmark for light surfaces")


def stacked_lockup(light=False):
    """[MARK] / CULINA / tagline — §11 formal lockup, transparent."""
    Wc = 760
    # mark badge
    badge = 348 if light else 388
    y = 0
    parts = []
    if light:
        tr, body = emblem_group((badge * 0.09,) * 2 + (badge * 0.82,) * 2)
        parts.append(f'<g transform="translate({(Wc-badge)/2:.0f},{y})">'
                     f'<rect width="{badge}" height="{badge}" rx="{badge*0.19:.0f}" fill="{MIDNIGHT}"/>'
                     f'<g transform="{tr}">{body}</g></g>')
    else:
        tr, body = emblem_group((0, y, badge, badge))
        parts.append(f'<g transform="{tr}">{body}</g>')
    y += badge + 34
    # wordmark
    wm_w = 620
    wm_h = wm_w * W_H / W_W
    tr, body = wordmark_group(((Wc - wm_w) / 2, y, wm_w, wm_h), light=light)
    parts.append(f'<g transform="{tr}">{body}</g>')
    y += wm_h + 26
    # tagline
    tg, tw, th = tagline_group(scale=0.72, light=light)
    parts.append(f'<g transform="translate({(Wc - tw) / 2:.1f},{y:.1f})">{tg}</g>')
    y += th + 8
    return svg_wrap(f"0 0 {Wc} {y:.0f}", "".join(parts),
                    "CULINA — mark, wordmark and tagline lockup"), Wc, y


# 7/8 · lockups (§11)
lk, LW, LH = stacked_lockup(light=False)
svgs["culina-lockup.svg"] = lk
lkl, _, _ = stacked_lockup(light=True)
svgs["culina-lockup-light.svg"] = lkl

# 9 · culina-logo — the full approved presentation on midnight (§8 primary).
# Layout mirrors the source board exactly (identity transforms).
LOGO_W, LOGO_H = 1329, 1183
def _identity_group(region, upscale, ink_bbox, layers):
    su = 1.0 / upscale
    tx = (region[0] - ink_bbox[0])
    ty = (region[1] - ink_bbox[1])
    parts = []
    for L in layers:
        d = " ".join(p["d"] + " " + " ".join(p["holes"]) for p in L["paths"])
        parts.append(f'<path fill="{L["color"]}" fill-rule="evenodd" d="{d}"/>')
    return (f'translate({tx:.2f},{ty:.2f}) scale({su:.6f})', "".join(parts))

etr, ebody = _identity_group(E_REG, E_U, E_IB, E["layers"])
wtr, wbody = _identity_group(W_REG, W_U, W_IB, W["layers"])
tg, _, _ = tagline_group(scale=1.0)
og, ow, oh = ornament_group(scale=1.0)
# tagline/ornament groups are ink-relative → place at their source position
tib, oib = T["tagline"]["ink_bbox"], T["ornament"]["ink_bbox"]
tg_place = f'<g transform="translate({tib[0]:.1f},{tib[1]:.1f})">{tg}</g>'
og_place = f'<g transform="translate({oib[0]:.1f},{oib[1]:.1f})">{og}</g>'
svgs["culina-logo.svg"] = svg_wrap(
    f"0 0 {LOGO_W} {LOGO_H}",
    f'<rect width="{LOGO_W}" height="{LOGO_H}" fill="{MIDNIGHT}"/>'
    f'<g transform="{etr}">{ebody}</g>'
    f'<g transform="{wtr}">{wbody}</g>'
    f'{tg_place}{og_place}',
    "CULINA — the approved logo presentation",
    "Emblem, wordmark, tagline and ornament exactly as approved")

# 10 · culina-logo-dark — same composition, transparent (dark surfaces)
svgs["culina-logo-dark.svg"] = svg_wrap(
    f"0 0 {LOGO_W} {LOGO_H}",
    f'<g transform="{etr}">{ebody}</g>'
    f'<g transform="{wtr}">{wbody}</g>'
    f'{tg_place}{og_place}',
    "CULINA logo for dark surfaces")

# 11 · culina-logo-light — light-surface composition (§18)
Wl = 780
parts = []
b = 400
tr, body = emblem_group((b * 0.09,) * 2 + (b * 0.82,) * 2)
parts.append(f'<g transform="translate({(Wl-b)/2:.0f},0)">'
             f'<rect width="{b}" height="{b}" rx="{b*0.19:.0f}" fill="{MIDNIGHT}"/>'
             f'<g transform="{tr}">{body}</g></g>')
y = b + 40
wm_w, wm_h = 640, 640 * W_H / W_W
tr, body = wordmark_group(((Wl - wm_w) / 2, y, wm_w, wm_h), light=True)
parts.append(f'<g transform="{tr}">{body}</g>')
y += wm_h + 26
tg, tw, th = tagline_group(scale=0.72, light=True)
parts.append(f'<g transform="translate({(Wl - tw) / 2:.1f},{y:.1f})">{tg}</g>')
y += th + 18
og, ow, oh = ornament_group(scale=0.62, light=True)
parts.append(f'<g transform="translate({(Wl - ow) / 2:.1f},{y:.1f})">{og}</g>')
y += oh
svgs["culina-logo-light.svg"] = svg_wrap(f"0 0 {Wl} {y:.0f}", "".join(parts),
                                         "CULINA logo for light surfaces")

# 12 · culina-mark-tile — 64px favicon-style tile (§14): midnight squircle +
# §13 simplified emblem (component-pruned, color separation kept)
def tile_svg(view=64, inset=0.10, min_area=700):
    """§14 favicon tile — §13 simplified emblem (small-size geometry)."""
    rx = view * 0.19
    m = view * inset
    tr, body = emblem_group((m, m, view - 2 * m, view - 2 * m),
                            min_src_area=min_area, simple=True,
                            force_colors=("#DE2A05", "#567F06"))
    return svg_wrap(
        f"0 0 {view} {view}",
        f'<rect width="{view}" height="{view}" rx="{rx:.1f}" fill="{MIDNIGHT}"/>'
        f'<g transform="{tr}">{body}</g>',
        "CULINA")

svgs["culina-mark-tile.svg"] = tile_svg()

# 13 · culina-icon — §12 app-icon master: square midnight canvas, safe area
tr, body = emblem_group((66, 66, 380, 380))
svgs["culina-icon.svg"] = svg_wrap(
    "0 0 512 512",
    f'<rect width="512" height="512" fill="{MIDNIGHT}"/>'
    f'<g transform="{tr}">{body}</g>',
    "CULINA app icon")

# ---------------------------------------------------------------- write
VECTOR = AB / "vector"
VECTOR.mkdir(parents=True, exist_ok=True)
PUB = ROOT / "public" / "brand"
PUB.mkdir(parents=True, exist_ok=True)
for name, svg in svgs.items():
    (VECTOR / name).write_text(svg)
    (PUB / name).write_text(svg)
# favicon.svg (§14) = the 64px tile, served from /icons/
(ROOT / "public" / "icons" / "favicon.svg").write_text(svgs["culina-mark-tile.svg"])
# mark-tile.js — the app-embedded tile module (header/splash mark)
tile = svgs["culina-mark-tile.svg"].replace('role="img" aria-labelledby="t"><title id="t">CULINA</title>',
                                            'width="64" height="64" role="img" aria-label="CULINA">')
module = ('/**\n'
          ' * GENERATED by scripts/generate-brand-assets.py — do not edit.\n'
          ' * The canonical CULINA tile mark (mirrors assets/brand/vector +\n'
          ' * public/brand). Geometry traced from the approved artwork\n'
          ' * (assets/brand/source/culina-emblem-master.png), §13 simplified.\n'
          ' */\n'
          'export default `' + tile + '`;\n')
(ROOT / "js" / "components" / "mark-tile.js").write_text(module)
print(f"vector family: {len(svgs)} SVGs → assets/brand/vector + public/brand + /icons/favicon.svg + mark-tile.js")

# ------------------------------------------------------------ rasters
targets = []
def tgt(svg, out, w, h):
    targets.append({"kind": "svg", "svg": svg, "out": out, "w": w, "h": h})

ICON_SIZES = [512, 384, 256, 192, 180, 152, 144, 128, 96, 72, 64, 48, 32, 16]

# favicon set (public root) — simplified small-size variant (§13/§14)
tile = tile_svg()
for s in (16, 32, 48):
    tgt(tile, f"favicon-{s}.png", s, s)

# PWA icons (§12/§16)
for s in (192, 512):
    tgt(svgs["culina-icon.svg"], f"icons/icon-{s}.png", s, s)
for s in (192, 512):  # maskable: emblem within the central 80%
    m = s * 0.21
    tr, body = emblem_group((m, m, s - 2 * m, s - 2 * m))
    maskable = svg_wrap(f"0 0 {s} {s}",
                        f'<rect width="{s}" height="{s}" fill="{MIDNIGHT}"/>'
                        f'<g transform="{tr}">{body}</g>', "CULINA")
    tgt(maskable, f"icons/icon-maskable-{s}.png", s, s)
# apple-touch (§15): standalone emblem, generous padding, no wordmark
tr, body = emblem_group((26, 26, 128, 128))
at = svg_wrap("0 0 180 180", f'<rect width="180" height="180" fill="{MIDNIGHT}"/>'
              f'<g transform="{tr}">{body}</g>', "CULINA")
tgt(at, "icons/apple-touch-icon.png", 180, 180)

# social cards (§21) — traced paths only; description set in Inter outlines
# (metadata text, not the wordmark: §27)
from wordmark_lib import svg_text_group, bounds  # noqa: E402

INTER400 = ROOT / "node_modules" / "@fontsource" / "inter" / "files" / "inter-latin-400-normal.woff"
DESCRIPTION = "Discover food. Understand it. Make it yours."

def description_group(canvas_w, ink_top, ink_h):
    """Inter 400 description line, ink-height ink_h, horizontally centered."""
    fp = str(INTER400)
    x0, y0, x1, y1, upem = bounds(fp, DESCRIPTION, 0.0)
    s = ink_h / (y1 - y0)
    wpx = (x1 - x0) * s
    x_origin = (canvas_w - wpx) / 2 - x0 * s
    baseline = ink_top + y1 * s
    return svg_text_group(fp, DESCRIPTION, 0.0, CREAM_70, baseline, s,
                          x_origin=x_origin)

def social_svg(w, h):
    parts = [f'<rect width="{w}" height="{h}" fill="{MIDNIGHT}"/>']
    em = 244
    tr, body = emblem_group(((w - em) / 2, 38, em, em))
    parts.append(f'<g transform="{tr}">{body}</g>')
    y = 38 + em + 32
    wm_w = 646
    wm_h = wm_w * W_H / W_W
    tr, body = wordmark_group(((w - wm_w) / 2, y, wm_w, wm_h))
    parts.append(f'<g transform="{tr}">{body}</g>')
    y += wm_h + 24
    tg, tw, th = tagline_group(scale=0.80)
    parts.append(f'<g transform="translate({(w - tw) / 2:.1f},{y:.1f})">{tg}</g>')
    y += th + 8
    og, ow, oh = ornament_group(scale=0.56)
    parts.append(f'<g transform="translate({(w - ow) / 2:.1f},{y:.1f})">{og}</g>')
    y += oh + 26
    parts.append(description_group(w, y, 24))
    return svg_wrap(f"0 0 {w} {h}", "".join(parts), "CULINA — food intelligence & discovery")

tgt(social_svg(1200, 630), "social/og-image.png", 1200, 630)
tgt(social_svg(1200, 628), "social/twitter-card.png", 1200, 628)

# public logo pngs (§8) — transparent lockups at natural aspect
import re as _re
logo_dark_svg = (VECTOR / "culina-logo-dark.svg").read_text()
logo_light_svg = (VECTOR / "culina-logo-light.svg").read_text()
m = _re.search(r'viewBox="0 0 (\d+) (\d+)"', logo_light_svg)
LWL, LHL = int(m.group(1)), int(m.group(2))
tgt(logo_dark_svg, "brand/culina-logo-dark.png", 512, round(512 * LOGO_H / LOGO_W))
tgt(logo_light_svg, "brand/culina-logo-light.png", 512, round(512 * LHL / LWL))

# canonical rasters (assets/brand/raster)
mark_svg = (VECTOR / "culina-mark.svg").read_text()
mark_dark_svg = (VECTOR / "culina-mark-dark.svg").read_text()
mark_light_svg = (VECTOR / "culina-mark-light.svg").read_text()
emblem_svg = (VECTOR / "culina-emblem.svg").read_text()
wm_svg = (VECTOR / "culina-wordmark.svg").read_text()
wm_light_svg = (VECTOR / "culina-wordmark-light.svg").read_text()
lockup_svg = (VECTOR / "culina-lockup.svg").read_text()
lockup_light_svg = (VECTOR / "culina-lockup-light.svg").read_text()
for s in (512, 256, 128):
    tgt(mark_svg, f"assets/brand/raster/culina-mark-{s}.png", s, s)
    tgt(emblem_svg, f"assets/brand/raster/culina-emblem-{s}.png", s, s)
tgt(mark_dark_svg, "assets/brand/raster/culina-mark-dark-512.png", 512, 512)
tgt(mark_light_svg, "assets/brand/raster/culina-mark-light-512.png", 512, 512)
tgt(mark_svg, "assets/brand/raster/culina-mark-transparent-512.png", 512, 512)  # §19
for s, wpx in ((900, 900), (450, 450)):
    tgt(wm_svg, f"assets/brand/raster/culina-wordmark-{wpx}.png", wpx, round(wpx * W_H / W_W))
    tgt(wm_light_svg, f"assets/brand/raster/culina-wordmark-light-{wpx}.png", wpx, round(wpx * W_H / W_W))
for s in (512, 256, 128, 64):
    tgt(logo_dark_svg, f"assets/brand/raster/culina-logo-dark-{s}.png", s, round(s * LOGO_H / LOGO_W))
    tgt(logo_light_svg, f"assets/brand/raster/culina-logo-light-{s}.png", s, round(s * LHL / LWL))
tgt(logo_dark_svg, "assets/brand/raster/culina-logo-transparent-512.png", 512, round(512 * LOGO_H / LOGO_W))  # §19
tgt(lockup_svg, "assets/brand/raster/culina-lockup-1200.png", 1200, round(1200 * LH / LW))
tgt(lockup_light_svg, "assets/brand/raster/culina-lockup-light-1200.png", 1200, round(1200 * LHL / LWL))

# app icon family (assets/brand/icons) — simplified ≤48 (§13)
for s in ICON_SIZES:
    if s >= 64:
        svg_i = (VECTOR / "culina-icon.svg").read_text()
    else:
        m = 512 * 0.10
        # §13: prune components that would render sub-pixel at this size;
        # keep the dominant red/green components for color separation.
        thr = 0 if s >= 48 else (4000 if s >= 32 else 12000)
        tr, body = emblem_group((m, m, 512 - 2 * m, 512 - 2 * m), min_src_area=thr,
                                simple=True,
                                force_colors=("#DE2A05", "#567F06"))
        svg_i = svg_wrap("0 0 512 512",
                         f'<rect width="512" height="512" fill="{MIDNIGHT}"/>'
                         f'<g transform="{tr}">{body}</g>', "CULINA")
    tgt(svg_i, f"assets/brand/icons/culina-icon-{s}.png", s, s)

ICO_ASSEMBLIES = [{
    "out": "favicon.ico",
    "sources": ["favicon-16.png", "favicon-32.png", "favicon-48.png"],
}]

(ROOT / "scripts" / "raster-manifest.json").write_text(
    json.dumps({"targets": targets, "ico": ICO_ASSEMBLIES}, indent=1))

# ------------------------------------------------------------ report
report = {
    "vector": sorted(p.name for p in VECTOR.glob("*.svg")),
    "raster_targets": len(targets),
    "trace_iou": {"emblem_union": E["union_iou"],
                  "emblem_layers": {L["color"]: L["iou"] for L in E["layers"]},
                  "wordmark": {L["name"]: L["iou"] for L in W["layers"]},
                  "tagline": T["tagline"]["iou"], "ornament": T["ornament"]["iou"]},
    "sources": {"emblem": E["source"], "wordmark_tagline": W["source"]},
    "tokens": {"midnight": MIDNIGHT, "cream": CREAM, "gold": GOLD},
}
(BUILD / "generation-report.json").write_text(json.dumps(report, indent=1))
print(f"raster targets: {len(targets)} → scripts/raster-manifest.json")
print(f"trace IoU: emblem={E['union_iou']:.4f} wordmark={W['layers'][0]['iou']:.4f} "
      f"tagline={T['tagline']['iou']:.4f} ornament={T['ornament']['iou']:.4f}")
print("next: node scripts/rasterize-brand.mjs && python3 scripts/generate-brand-assets.py --mirror-rasters")


# ------------------------------------------------------------------ mirrors
def mirror_rasters():
    """Copy the rasterized public/ outputs into the canonical assets/brand
    layout (favicon/, pwa/, social/) so every shipped raster exists exactly
    once as a canonical file + serving mirror (asserted by gateway-test)."""
    pairs = []
    for s in (16, 32, 48):
        pairs.append((ROOT / "public" / f"favicon-{s}.png", AB / "favicon" / f"favicon-{s}.png"))
    pairs += [
        (ROOT / "public" / "favicon.ico", AB / "favicon" / "favicon.ico"),
        (ROOT / "public" / "icons" / "favicon.svg", AB / "favicon" / "favicon.svg"),
        (ROOT / "public" / "social" / "og-image.png", AB / "social" / "og-image.png"),
        (ROOT / "public" / "social" / "twitter-card.png", AB / "social" / "twitter-card.png"),
    ]
    for name in ("icon-192.png", "icon-512.png", "icon-maskable-192.png",
                 "icon-maskable-512.png", "apple-touch-icon.png"):
        pairs.append((ROOT / "public" / "icons" / name, AB / "pwa" / name))
    for src, dst in pairs:
        if not src.exists():
            sys.exit(f"mirror: missing {src} — run node scripts/rasterize-brand.mjs first")
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(src, dst)
    print(f"mirrored {len(pairs)} rasters → assets/brand/{{favicon,pwa,social}}")


if "--mirror-rasters" in sys.argv:
    mirror_rasters()
    sys.exit(0)
