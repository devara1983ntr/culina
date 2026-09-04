#!/usr/bin/env python3
"""
CULINA — Brand asset generator (approved identity, docs/brand/culina-brand-board.png).

Reconstructs the approved mark from the brand-board specification:
a golden/orange C incorporating a chef hat, fork, spoon, fresh green leaf,
cocktail element and a culinary flame — on the Midnight ground the board
presents. Geometry lives ONLY in this file (single source of truth):
the emitted SVGs and the in-app mark (js/components/brand.js, which imports
public/brand/culina-mark-tile.svg with vite's ?raw loader) never restate it.

Outputs (under public/):
  brand/culina-mark.svg           bare multicolor mark (transparent ground)
  brand/culina-mark-tile.svg      mark on a Midnight rounded tile
  brand/culina-wordmark.svg       CULINA in Playfair Display 600, vector outlines
  brand/culina-logo.svg           tile mark + wordmark + tagline (dark ground lockup)
  brand/culina-logo-dark.svg      same as culina-logo.svg (explicit dark-context name)
  brand/culina-logo-light.svg     lockup with Midnight wordmark for light grounds
  icons/favicon.svg               tile mark (scalable favicon)
  social/og-image.png *           1200x630 Open Graph card (via rasterize-brand.mjs)
  social/twitter-card.png *       1200x628 X/Twitter card (via rasterize-brand.mjs)
  icons/*.png, favicon-*.png *    raster icons (via rasterize-brand.mjs)

* raster targets are emitted by scripts/rasterize-brand.mjs from the SVGs and
  HTML templates this script writes (raster-manifest.json).

Typography: Playfair Display (display) + Inter (UI) — self-hosted via
@fontsource (OFL). Wordmarks are converted to vector outlines with fontTools so
the files render identically without any font dependency.
"""

import base64
import json
import os

from fontTools.ttLib import TTFont

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
PUBLIC = os.path.join(ROOT, "public")
BRAND = os.path.join(PUBLIC, "brand")
ASSETS_BRAND = os.path.join(ROOT, "assets", "brand")  # canonical, importable by the app
ICONS = os.path.join(PUBLIC, "icons")
SOCIAL = os.path.join(PUBLIC, "social")
for d in (BRAND, ASSETS_BRAND, ICONS, SOCIAL):
    os.makedirs(d, exist_ok=True)

# --- Approved brand palette (brand board) --------------------------------
GOLD = "#FFB703"      # Ember Gold
ORANGE = "#FB5607"    # Spicy Orange
GREEN = "#2ECC71"     # Fresh Green
CRIMSON = "#E63946"   # Deep Crimson
MIDNIGHT = "#0B0F19"  # Midnight
CREAM = "#FFF7E6"     # Cream
VEIN = "#0F5132"      # derived: deep green leaf vein

FONT_DIR = os.path.join(ROOT, "node_modules", "@fontsource")
PLAYFAIR_600 = os.path.join(FONT_DIR, "playfair-display", "files", "playfair-display-latin-600-normal.woff2")
PLAYFAIR_500 = os.path.join(FONT_DIR, "playfair-display", "files", "playfair-display-latin-500-normal.woff2")
INTER_500 = os.path.join(FONT_DIR, "inter", "files", "inter-latin-500-normal.woff2")
INTER_600 = os.path.join(FONT_DIR, "inter", "files", "inter-latin-600-normal.woff2")

# --- The mark (viewBox 0 0 64 64) -----------------------------------------
# Geometry is FIXED here and must not be restated anywhere else.
GRAD_DEFS = (
    f'<linearGradient id="cg" x1="16%" y1="0%" x2="86%" y2="100%">'
    f'<stop offset="0" stop-color="{GOLD}"/><stop offset="1" stop-color="{ORANGE}"/>'
    f"</linearGradient>"
    f'<linearGradient id="fg" x1="20%" y1="0%" x2="80%" y2="100%">'
    f'<stop offset="0" stop-color="{ORANGE}"/><stop offset="1" stop-color="{CRIMSON}"/>'
    f"</linearGradient>"
)

MARK_BODY = f"""
  <defs>{GRAD_DEFS}</defs>
  <!-- The C: golden/orange arc, opening right -->
  <path d="M 46.73 20.28 A 20.5 20.5 0 1 0 46.73 47.72"
        fill="none" stroke="url(#cg)" stroke-width="6.5" stroke-linecap="round"/>
  <!-- Chef hat -->
  <g fill="{CREAM}">
    <circle cx="27.3" cy="7.2" r="3.0"/>
    <circle cx="31.5" cy="5.6" r="3.4"/>
    <circle cx="35.7" cy="7.2" r="3.0"/>
    <rect x="26.1" y="7.0" width="10.8" height="3.2" rx="1.2"/>
    <rect x="25.5" y="9.7" width="12" height="3.3" rx="1.45"/>
  </g>
  <!-- Fork -->
  <g stroke="{CREAM}" fill="none" stroke-linecap="round">
    <path d="M 21.3 22 V 26.8" stroke-width="1.7"/>
    <path d="M 23.5 22 V 26.8" stroke-width="1.7"/>
    <path d="M 25.7 22 V 26.8" stroke-width="1.7"/>
    <path d="M 21.4 27 Q 23.5 28.9 25.6 27" stroke-width="1.7"/>
    <path d="M 23.5 28.6 V 43" stroke-width="2.6"/>
  </g>
  <!-- Spoon -->
  <ellipse cx="31.5" cy="24.8" rx="3.2" ry="4.4" fill="{CREAM}"/>
  <path d="M 31.5 29.6 V 43" stroke="{CREAM}" stroke-width="2.6" stroke-linecap="round"/>
  <!-- Cocktail -->
  <g stroke="{CREAM}" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M 46.9 24.3 L 52.5 32.3 L 58.1 24.3"/>
    <path d="M 52.5 32.3 V 38.6"/>
    <path d="M 49.4 39.6 H 55.6"/>
  </g>
  <circle cx="52.5" cy="27.9" r="1.7" fill="{CRIMSON}"/>
  <!-- Fresh leaf -->
  <path d="M 36.2 49.3 C 36.0 44.6 38.9 40.9 43.7 40.4 C 44.0 45.3 41.0 49.0 36.2 49.3 Z" fill="{GREEN}"/>
  <path d="M 37.7 47.7 L 42.7 42.3" stroke="{VEIN}" stroke-width="1.1" stroke-linecap="round"/>
  <!-- Culinary flame flowing from the lower terminal -->
  <path d="M 46.6 49.4 C 42.6 50.4 39.4 53.6 40.4 56.7 C 43.5 55.6 46.2 53.0 46.6 49.4 Z" fill="url(#fg)"/>
"""


def svg_doc(body, width, height, vb="0 0 64 64"):
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" '
        f'viewBox="{vb}" role="img" aria-label="CULINA">{body}</svg>'
    )


def tile_body(mark_scale=0.78, rx=14, bleed=False):
    inset = 64 * (1 - mark_scale) / 2
    rect = (
        f'<rect x="0" y="0" width="64" height="64" fill="{MIDNIGHT}"/>' if bleed
        else f'<rect x="0" y="0" width="64" height="64" rx="{rx}" fill="{MIDNIGHT}"/>'
    )
    return f'{rect}<g transform="translate({inset:.2f} {inset:.2f}) scale({mark_scale})">{MARK_BODY}</g>'


def write(path, content):
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print("wrote", os.path.relpath(path, ROOT), f"({len(content)} bytes)")


def write_brand(name, content):
    """Brand SVGs are written identically to assets/brand (canonical source,
    imported by the app) and public/brand (served at /brand/ for direct use)."""
    write(os.path.join(ASSETS_BRAND, name), content)
    write(os.path.join(BRAND, name), content)


# --- Vector wordmarks (fontTools outlines — render anywhere, no fonts needed)
_font_cache = {}


def load_font(path):
    if path not in _font_cache:
        _font_cache[path] = TTFont(path)
    return _font_cache[path]


def text_paths(font_path, text, size, letter_spacing=0.0):
    """Return (svg_group, advance_width) with glyphs as pure vector paths."""
    font = load_font(font_path)
    upem = font["head"].unitsPerEm
    cmap = font.getBestCmap()
    glyphs = font.getGlyphSet()
    scale = size / upem
    x = 0.0
    parts = []
    for ch in text:
        gname = cmap.get(ord(ch))
        if gname is None:
            raise ValueError(f"font {os.path.basename(font_path)} lacks U+{ord(ch):04X} ({ch!r})")
        glyph = glyphs[gname]
        # record advance first
        adv = glyph.width * scale
        pen_path = export_glyph_path(font, gname)
        if pen_path:
            parts.append(f'<path transform="translate({x:.2f} 0) scale({scale:.6f} {-scale:.6f})" d="{pen_path}"/>')
        x += adv + letter_spacing
    return "\n    ".join(parts), x - letter_spacing if text else 0.0


_pen_cache = {}


def export_glyph_path(font, gname):
    """Glyph outline as SVG path data (font units, y-up)."""
    from fontTools.pens.svgPathPen import SVGPathPen

    key = (id(font), gname)
    if key in _pen_cache:
        return _pen_cache[key]
    pen = SVGPathPen(font.getGlyphSet())
    font.getGlyphSet()[gname].draw(pen)
    d = pen.getCommands()
    _pen_cache[key] = d
    return d


def cap_height(font_path):
    font = load_font(font_path)
    return font["OS/2"].sCapHeight * (1.0 / font["head"].unitsPerEm)


def wordmark_svg(font_path, fill, size=64, letter_spacing=0.5, pad=2):
    body, w = text_paths(font_path, "CULINA", size, letter_spacing)
    cap = cap_height(font_path) * size
    h = cap + 2 * pad
    vb = f"{-pad} {-pad} {w + 2 * pad:.1f} {h:.1f}"
    doc = (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}" role="img" aria-label="CULINA">\n'
        f'  <g fill="{fill}" transform="translate(0 {cap + pad:.1f})">\n    {body}\n  </g>\n</svg>\n'
    )
    return doc, w, cap


TAGLINE = "TASTE • DISCOVER • PLAN • ENJOY"


def tagline_svg(font_path, fill, size, letter_spacing):
    body, w = text_paths(font_path, TAGLINE, size, letter_spacing)
    cap = cap_height(font_path) * size
    return body, w, cap


def lockup_svg(word_fill, tag_fill, name):
    """Tile mark + wordmark + tagline; height 96, tile 64 at y 16."""
    tile = tile_body(0.78, 14)
    wm_body, wm_w, wm_cap = wordmark_svg(PLAYFAIR_600, word_fill, size=47, letter_spacing=0.6)
    tg_body, tg_w, tg_cap = tagline_svg(INTER_500, tag_fill, size=13.2, letter_spacing=2.7)
    x0 = 82.0
    # optical alignment: wordmark cap-center ~40, tagline baseline 76
    wm_baseline = 16 + 14 + wm_cap + 14  # = 44 + cap(≈33) → ≈ 77? compute simple: 22 + cap
    wm_baseline = 22 + wm_cap
    tg_baseline = 78.0
    total_w = x0 + max(wm_w, tg_w) + 6
    doc = (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {total_w:.1f} 96" role="img" aria-label="CULINA — {TAGLINE}">\n'
        f'  <g>{tile}</g>\n'
        f'  <g fill="{word_fill}" transform="translate({x0} {wm_baseline:.1f})">\n    {wm_body}\n  </g>\n'
        f'  <g fill="{tag_fill}" transform="translate({x0 + 1.2} {tg_baseline:.1f})">\n    {tg_body}\n  </g>\n'
        f"</svg>\n"
    )
    write_brand(name, doc)
    return doc


def main():
    # 1. The mark + tiles ---------------------------------------------------
    tile = svg_doc(tile_body(0.78, 14), 64, 64)
    write_brand("culina-mark.svg", svg_doc(MARK_BODY, 64, 64))
    write_brand("culina-mark-tile.svg", tile)

    # 1b. In-app module: the tile as a plain JS string module (keeps a single
    # source of truth; importable by node tests and bundleable by vite).
    assert "`" not in tile and "${" not in tile
    module = (
        "/**\n"
        " * GENERATED by scripts/generate-brand-assets.py — do not edit.\n"
        " * The canonical CULINA tile mark (mirrors assets/brand + public/brand).\n"
        " */\n"
        f"export default `{tile}`;\n"
    )
    write(os.path.join(ROOT, "js", "components", "mark-tile.js"), module)
    write(os.path.join(ICONS, "favicon.svg"), svg_doc(tile_body(0.78, 14), 64, 64))

    # 2. Wordmark + lockups -------------------------------------------------
    wm_doc, wm_w, wm_cap = wordmark_svg(PLAYFAIR_600, MIDNIGHT)
    write_brand("culina-wordmark.svg", wm_doc)
    lockup_svg(CREAM, GOLD, "culina-logo.svg")
    lockup_svg(CREAM, GOLD, "culina-logo-dark.svg")
    lockup_svg(MIDNIGHT, "#C2410C", "culina-logo-light.svg")

    # 3. Social templates (rasterized by scripts/rasterize-brand.mjs) --------
    def b64(path):
        return base64.b64encode(open(path, "rb").read()).decode()

    og_html = f"""<!doctype html><html><head><meta charset="utf-8"><style>
      @font-face {{ font-family:'Playfair Display'; font-weight:600;
        src:url(data:font/woff2;base64,{b64(PLAYFAIR_600)}) format('woff2'); }}
      @font-face {{ font-family:'Inter'; font-weight:500;
        src:url(data:font/woff2;base64,{b64(INTER_500)}) format('woff2'); }}
      * {{ margin:0; padding:0; box-sizing:border-box; }}
      html,body {{ width:1200px; height:630px; overflow:hidden; }}
      body {{ background:{MIDNIGHT}; font-family:'Inter',sans-serif; position:relative; }}
      .mark {{ position:absolute; left:92px; top:198px; width:234px; height:234px; }}
      .title {{ position:absolute; left:382px; top:212px; font-family:'Playfair Display',serif;
        font-weight:600; font-size:150px; line-height:1; color:{CREAM}; letter-spacing:2px; }}
      .tag {{ position:absolute; left:386px; top:402px; font-weight:500; font-size:33px;
        letter-spacing:9px; color:{GOLD}; }}
      .rule {{ position:absolute; left:386px; top:468px; width:64px; height:3px; background:{ORANGE}; }}
      .sub {{ position:absolute; left:386px; top:498px; font-weight:500; font-size:30px;
        color:#C9C3B4; }}
      .foot {{ position:absolute; left:386px; bottom:56px; font-weight:500; font-size:22px;
        letter-spacing:1.5px; color:#8E897D; }}
      .foot b {{ color:{CREAM}; font-weight:500; }}
    </style></head><body>
      <img class="mark" src="../brand/culina-mark-tile.svg">
      <div class="title">CULINA</div>
      <div class="tag">{TAGLINE}</div>
      <div class="rule"></div>
      <div class="sub">Discover food. Understand it. Make it yours.</div>
      <div class="foot"><b>Recipes</b> · <b>Ingredients</b> · <b>Nutrition</b> · <b>Drinks</b> · <b>Meal planner</b> — one intelligent search</div>
    </body></html>"""
    write(os.path.join(SOCIAL, "og-image.src.html"), og_html)

    tw_html = f"""<!doctype html><html><head><meta charset="utf-8"><style>
      @font-face {{ font-family:'Playfair Display'; font-weight:600;
        src:url(data:font/woff2;base64,{b64(PLAYFAIR_600)}) format('woff2'); }}
      @font-face {{ font-family:'Inter'; font-weight:500;
        src:url(data:font/woff2;base64,{b64(INTER_500)}) format('woff2'); }}
      * {{ margin:0; padding:0; box-sizing:border-box; }}
      html,body {{ width:1200px; height:628px; overflow:hidden; }}
      body {{ background:{MIDNIGHT}; font-family:'Inter',sans-serif; position:relative;
        text-align:center; }}
      .mark {{ position:absolute; left:50%; top:66px; width:186px; height:186px;
        transform:translateX(-50%); }}
      .title {{ position:absolute; left:0; right:0; top:284px; font-family:'Playfair Display',serif;
        font-weight:600; font-size:118px; line-height:1; color:{CREAM}; letter-spacing:2px; }}
      .tag {{ position:absolute; left:0; right:0; top:436px; font-weight:500; font-size:28px;
        letter-spacing:8px; color:{GOLD}; }}
      .sub {{ position:absolute; left:0; right:0; top:500px; font-weight:500; font-size:24px;
        color:#C9C3B4; }}
    </style></head><body>
      <img class="mark" src="../brand/culina-mark-tile.svg">
      <div class="title">CULINA</div>
      <div class="tag">{TAGLINE}</div>
      <div class="sub">Discover food. Understand it. Make it yours.</div>
    </body></html>"""
    write(os.path.join(SOCIAL, "twitter-card.src.html"), tw_html)

    # 4. Raster manifest for scripts/rasterize-brand.mjs ----------------------
    def tile_svg_str(scale, bleed):
        return svg_doc(tile_body(scale, 0 if bleed else 14), 64, 64)

    manifest = {
        "targets": [
            {"kind": "svg", "svg": tile_svg_str(0.78, False), "out": "favicon-16.png", "w": 16, "h": 16},
            {"kind": "svg", "svg": tile_svg_str(0.78, False), "out": "favicon-32.png", "w": 32, "h": 32},
            {"kind": "svg", "svg": tile_svg_str(0.78, False), "out": "favicon-64.png", "w": 64, "h": 64},
            {"kind": "svg", "svg": tile_svg_str(0.78, False), "out": "icons/icon-192.png", "w": 192, "h": 192},
            {"kind": "svg", "svg": tile_svg_str(0.78, False), "out": "icons/icon-512.png", "w": 512, "h": 512},
            {"kind": "svg", "svg": tile_svg_str(0.56, True), "out": "icons/icon-maskable-512.png", "w": 512, "h": 512},
            {"kind": "svg", "svg": tile_svg_str(0.72, True), "out": "icons/apple-touch-icon.png", "w": 180, "h": 180},
            {"kind": "html", "src": "social/og-image.src.html", "out": "social/og-image.png", "w": 1200, "h": 630},
            {"kind": "html", "src": "social/twitter-card.src.html", "out": "social/twitter-card.png", "w": 1200, "h": 628},
        ]
    }
    write(os.path.join(ROOT, "scripts", "raster-manifest.json"), json.dumps(manifest, indent=2))
    print("\nBrand SVGs + templates generated. Run scripts/rasterize-brand.mjs for PNGs.")


if __name__ == "__main__":
    main()
