#!/usr/bin/env python3
"""
CULINA — App icon generator.
Renders the brand mark (open-ring plate + garnish dot) with PIL, supersampled
for crisp edges, and emits every icon size the PWA needs:
  public/icons/icon-192.png, icon-512.png, icon-maskable-512.png,
  public/icons/apple-touch-icon.png, public/favicon-64.png
"""
from PIL import Image, ImageDraw
import math
import os

BASE = os.path.join(os.path.dirname(__file__), "..", "public")
ICONS = os.path.join(BASE, "icons")
os.makedirs(ICONS, exist_ok=True)

BG = (24, 17, 9, 255)        # deep espresso
EMBER = (240, 116, 60, 255)  # accent ember
CREAM = (246, 239, 230, 255) # garnish dot

SS = 4  # supersample factor


def rounded_bg(size, radius_ratio, color=BG):
    img = Image.new("RGBA", (size * SS, size * SS), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([0, 0, size * SS - 1, size * SS - 1], radius=int(size * SS * radius_ratio), fill=color)
    return img


def draw_mark(d, cx, cy, r, width, arc_color=EMBER, dot_color=CREAM):
    """The CULINA mark: an open ring (the plate) with a garnish dot in the opening."""
    bbox = [cx - r, cy - r, cx + r, cy + r]
    # PIL angles: 0° = 3 o'clock, increasing clockwise.
    # arc(50 → 310) sweeps through bottom-left-top = the "C"; gap faces right.
    d.arc(bbox, start=50, end=310, fill=arc_color, width=width)
    # Garnish dot at 3 o'clock, centered in the ring stroke.
    dr = width * 0.58
    d.ellipse([cx + r - dr, cy - dr, cx + r + dr, cy + dr], fill=dot_color)


def render_icon(size, radius_ratio, mark_ratio, path):
    canvas = rounded_bg(size, radius_ratio)
    d = ImageDraw.Draw(canvas)
    s = size * SS
    r = int(s * mark_ratio)
    draw_mark(d, s / 2, s / 2, r, width=max(8, int(r * 0.24)))
    img = canvas.resize((size, size), Image.LANCZOS)
    img.save(path)
    print(f"  {path} ({size}x{size})")


def render_favicon(size, path):
    """Rounded-square favicon on transparent background (uses theme bg)."""
    canvas = rounded_bg(size, 0.24)
    d = ImageDraw.Draw(canvas)
    s = size * SS
    r = int(s * 0.30)
    draw_mark(d, s / 2, s / 2, r, width=max(6, int(r * 0.24)))
    img = canvas.resize((size, size), Image.LANCZOS)
    img.save(path)
    print(f"  {path} ({size}x{size})")


print("Generating CULINA icons…")
# Standard icons — rounded square, mark sized for balance
render_icon(512, 0.225, 0.30, os.path.join(ICONS, "icon-512.png"))
render_icon(192, 0.225, 0.30, os.path.join(ICONS, "icon-192.png"))
# Maskable — full-bleed square, mark inside the 80% safe zone
render_icon(512, 0.0, 0.26, os.path.join(ICONS, "icon-maskable-512.png"))
# Apple touch — full-bleed (iOS applies its own mask), mark slightly larger
render_icon(180, 0.0, 0.30, os.path.join(ICONS, "apple-touch-icon.png"))
# Favicon
render_favicon(64, os.path.join(BASE, "favicon-64.png"))
print("Done.")
