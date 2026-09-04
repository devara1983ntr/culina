#!/usr/bin/env python3
"""Build culina-wordmark.svg + culina-lockup.svg from true Playfair Display
Italic outlines (fontTools SVGPathPen — real Bézier paths, no font dependency
at runtime). Board has no CULINA lettering; typography follows the board's
tagline language (high-contrast italic serif) and the site's display font.

Outputs (assets/brand/build/): wordmark.svg, wordmark-midnight.svg,
lockup.svg, wordmark-geom.json
"""
from __future__ import annotations
import json
import pathlib
from fontTools.ttLib import TTFont
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.svgPathPen import SVGPathPen

ROOT = pathlib.Path("/home/user/culina")
WM_FONT = ROOT / "node_modules/@fontsource/playfair-display/files/playfair-display-latin-700-italic.woff"
TL_FONT = ROOT / "node_modules/@fontsource/playfair-display/files/playfair-display-latin-500-italic.woff"

CREAM = "#FFF7E6"
MIDNIGHT = "#0B0F19"
GOLD = "#FFB703"


def load_font(path):
    f = TTFont(str(path))
    return f, f.getGlyphSet(), f.getBestCmap(), f["head"].unitsPerEm


def compose_text(font_path, text, tracking_em=0.0):
    """Return list of (glyph_svg_path, x_offset) in font units + total width."""
    font, gs, cmap, upem = load_font(font_path)
    x = 0.0
    out = []
    for ch in text:
        if ch == " ":
            x += gs[cmap[0x20]].width * (1 + tracking_em)
            continue
        gname = cmap.get(ord(ch))
        if gname is None:
            raise KeyError(f"missing glyph {ch!r}")
        g = gs[gname]
        pen = SVGPathPen(gs, ntos=lambda v: f"{v:.1f}")
        g.draw(pen)
        out.append((pen.getCommands(), x))
        x += g.width * (1 + tracking_em)
    return out, x, upem


def text_bbox(composed):
    font, gs, cmap, upem = None, None, None, None
    return None


def bounds(font_path, text, tracking_em=0.0):
    font, gs, cmap, upem = load_font(font_path)
    x = 0.0
    x0 = y0 = 1e9
    x1 = y1 = -1e9
    for ch in text:
        if ch == " ":
            x += gs[cmap[0x20]].width * (1 + tracking_em)
            continue
        g = gs[cmap[ord(ch)]]
        bp = BoundsPen(gs)
        g.draw(bp)
        if bp.bounds:
            bx0, by0, bx1, by1 = bp.bounds
            x0 = min(x0, x + bx0); y0 = min(y0, by0)
            x1 = max(x1, x + bx1); y1 = max(y1, by1)
        x += g.width * (1 + tracking_em)
    return x0, y0, x1, y1, upem


def svg_text_group(font_path, text, tracking_em, fill, baseline_y, scale, x_origin=0.0):
    """Emit <g> with glyph paths; y-down SVG, baseline at baseline_y*scale."""
    composed, total, upem = compose_text(font_path, text, tracking_em)
    parts = [f'<g fill="{fill}">']
    for d, gx in composed:
        if not d:
            continue
        parts.append(
            f'<path transform="translate({x_origin + gx*scale:.2f},{baseline_y:.2f}) '
            f'scale({scale:.6f},{-scale:.6f})" d="{d}"/>'
        )
    parts.append("</g>")
    return "\n".join(parts), total * scale


def build_wordmark():
    text = "CULINA"
    tr = 0.045
    x0, y0, x1, y1, upem = bounds(WM_FONT, text, tr)
    # normalize: cap-height box → viewBox height 100
    cap_h = y1 - y0
    S = 100.0 / cap_h
    W = (x1 - x0) * S
    MAR = 2.0
    g, _ = svg_text_group(WM_FONT, text, tr, CREAM, 100 + y0 * S, S, x_origin=-x0 * S + MAR)
    vb = f"0 0 {W + 2*MAR:.1f} 104"
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}" role="img" '
           f'aria-label="CULINA wordmark">\n{g}\n</svg>\n')
    # midnight variant
    gm, _ = svg_text_group(WM_FONT, text, tr, MIDNIGHT, 100 + y0 * S, S, x_origin=-x0 * S + MAR)
    svgm = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}" role="img" '
            f'aria-label="CULINA wordmark">\n{gm}\n</svg>\n')
    return svg, svgm, W + 2 * MAR


def build_lockup():
    # sizes: mark 168h, wordmark cap 84, tagline cap 15.6 (tracked widely)
    tagline = "TASTE • DISCOVER • PLAN • ENJOY"
    tl_tr = 0.30
    # tagline bounds
    tx0, ty0, tx1, ty1, tupem = bounds(TL_FONT, tagline, tl_tr)
    tl_cap = ty1 - ty0
    wx0, wy0, wx1, wy1, wupem = bounds(WM_FONT, "CULINA", 0.045)
    w_cap = wy1 - wy0

    MARK_H = 168.0
    GAP = 34.0
    WM_CAP = 84.0
    TL_CAP = 15.6
    PAD = 6.0

    wm_S = WM_CAP / w_cap
    wm_W = (wx1 - wx0) * wm_S
    tl_S = TL_CAP / tl_cap
    tl_W = (tx1 - tx0) * tl_S

    text_W = max(wm_W, tl_W)
    W = PAD + MARK_H + GAP + text_W + PAD
    H = MARK_H + 2 * PAD

    mark_x, mark_y = PAD, PAD
    wm_x = PAD + MARK_H + GAP
    wm_baseline = mark_y + MARK_H * 0.5 + WM_CAP * 0.42   # optical centering
    tl_x = wm_x + (wm_W - tl_W) / 2 if tl_W <= wm_W else wm_x
    tl_baseline = wm_baseline + 30.0

    # inline the full-color emblem geometry (primary mark)
    eg = json.loads((ROOT / "assets/brand/build/emblem-geom.json").read_text())
    k = MARK_H / 512.0
    def mark_body_fn(fill_wm, fill_tl):
        layers = "".join(
            f'<path fill="{L["color"]}" fill-rule="evenodd" d="{L["d"]}"/>'
            for L in eg["layers_full"]
        )
        mark = (f'<g transform="translate({mark_x:.2f},{mark_y:.2f}) scale({k:.6f})">'
                f"{layers}</g>")
        wm_g, _ = svg_text_group(WM_FONT, "CULINA", 0.045, fill_wm, wm_baseline, wm_S,
                                 x_origin=wm_x - wx0 * wm_S)
        tl_g, _ = svg_text_group(TL_FONT, tagline, tl_tr, fill_tl, tl_baseline, tl_S,
                                 x_origin=tl_x - tx0 * tl_S)
        return f"{mark}\n{wm_g}\n{tl_g}"
    dark_bg = mark_body_fn(CREAM, CREAM)
    light_bg = mark_body_fn(MIDNIGHT, MIDNIGHT)

    def wrap(body, label):
        return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W:.1f} {H:.1f}" '
                f'role="img" aria-label="{label}">\n{body}\n</svg>\n')

    svg = wrap(dark_bg, "CULINA — taste, discover, plan, enjoy")
    svg_light = wrap(light_bg, "CULINA — taste, discover, plan, enjoy")
    return svg, svg_light, W, H, wm_W, tl_W


out = ROOT / "assets/brand/build"
svg_wm, svg_wm_mid, wm_W = build_wordmark()
(out / "wordmark.svg").write_text(svg_wm)
(out / "wordmark-midnight.svg").write_text(svg_wm_mid)

svg_lu, svg_lu_light, W, H, wmW, tlW = build_lockup()
(out / "lockup.svg").write_text(svg_lu)
(out / "lockup-light.svg").write_text(svg_lu_light)

(out / "wordmark-geom.json").write_text(json.dumps({
    "wordmark_width_at_100h": round(wm_W, 2),
    "lockup": {"W": round(W, 1), "H": round(H, 1), "wm_W": round(wmW, 1), "tl_W": round(tlW, 1)},
}, indent=1))
print(f"wordmark.svg ({len(svg_wm)} B, w={wm_W:.1f} @ h=100)")
print(f"lockup.svg ({len(svg_lu)} B, {W:.0f}x{H:.0f})")
