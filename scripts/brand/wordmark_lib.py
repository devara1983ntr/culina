#!/usr/bin/env python3
"""Shared font-outline composition (fontTools → SVG path groups).

Converts text to true vector outlines (no runtime font dependency). Used by
the brand asset generator for the wordmark, tagline and supporting lines.
"""
from __future__ import annotations
from fontTools.ttLib import TTFont
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.svgPathPen import SVGPathPen


def load_font(path):
    f = TTFont(str(path))
    return f, f.getGlyphSet(), f.getBestCmap(), f["head"].unitsPerEm


def compose(font_path, text, tracking_em=0.0):
    """→ ([(svg_path_d, x_offset_fontunits)], total_advance, upem)."""
    font, gs, cmap, upem = load_font(font_path)
    x = 0.0
    out = []
    for ch in text:
        if ch == " ":
            x += gs[cmap[0x20]].width * (1 + tracking_em)
            continue
        gname = cmap.get(ord(ch))
        if gname is None:
            raise KeyError(f"missing glyph {ch!r} in {font_path}")
        g = gs[gname]
        pen = SVGPathPen(gs, ntos=lambda v: f"{v:.1f}")
        g.draw(pen)
        out.append((pen.getCommands(), x))
        x += g.width * (1 + tracking_em)
    return out, x, upem


def bounds(font_path, text, tracking_em=0.0):
    font, gs, cmap, upem = load_font(font_path)
    x = 0.0
    x0 = y0 = 1e9
    x1 = y1 = -1e9
    for ch in text:
        if ch == " ":
            x += gs[cmap[0x20]].width * (1 + tracking_em)
            continue
        g = gs[cmap.get(ord(ch))]
        if g is None:
            continue
        bp = BoundsPen(gs)
        g.draw(bp)
        if bp.bounds:
            bx0, by0, bx1, by1 = bp.bounds
            x0 = min(x0, x + bx0)
            y0 = min(y0, by0)
            x1 = max(x1, x + bx1)
            y1 = max(y1, by1)
        x += g.width * (1 + tracking_em)
    return x0, y0, x1, y1, upem


def svg_text_group(font_path, text, tracking_em, fill, baseline_y, scale, x_origin=0.0):
    """Emit a <g> of glyph paths (y-down SVG, baseline at baseline_y)."""
    composed, _total, _upem = compose(font_path, text, tracking_em)
    parts = [f'<g fill="{fill}">']
    for d, gx in composed:
        if not d:
            continue
        parts.append(
            f'<path transform="translate({x_origin + gx * scale:.2f},{baseline_y:.2f}) '
            f'scale({scale:.6f},{-scale:.6f})" d="{d}"/>'
        )
    parts.append("</g>")
    return "\n".join(parts)
