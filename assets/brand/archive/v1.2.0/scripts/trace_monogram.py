#!/usr/bin/env python3
"""Final Panel B monogram trace → culina-mark vector geometry + IoU report.

Outputs (assets/brand/build/):
  monogram.svg        512 viewBox, token colors (midnight + fresh green)
  monogram-artwork.svg same geometry, artwork-true colors (deep green-black + sage)
  monogram-geom.json  normalized paths + roundel geometry for downstream assets
"""
from __future__ import annotations
import json
import pathlib
import sys
import numpy as np
from PIL import Image
from scipy import ndimage

sys.path.insert(0, str(pathlib.Path(__file__).parent))
from trace_lib import (  # noqa: E402
    load_board, extract, rgb, lum, mask_green, clean, mask_contour_paths,
    iou_paths_vs_mask, iou, polyline_to_bezier_path,
)

SCALE = 4
X0, Y0, X1, Y1 = 871, 243, 1007, 392          # Panel B badge bbox on board
TOKENS = {"midnight": "#0B0F19", "green": "#2ECC71",
          "art_dark": "#06361D", "art_green": "#709A70"}

im = load_board()
big = extract(im, X0, Y0, X1, Y1, SCALE)
arr = np.asarray(big).astype(int)
H, W = arr.shape[:2]

# roundel geometry
r_, g_, b_ = rgb(arr)
L = lum(arr)
creamish = (L > 175) & (r_ >= g_ - 12) & (g_ >= b_ - 14)
ys, xs = np.where(creamish)
cx, cy = xs.mean(), ys.mean()
R = float(np.percentile(np.hypot(xs - cx, ys - cy), 97))
yy, xx = np.mgrid[0:H, 0:W]
dist = np.hypot(xx - cx, yy - cy)
interior = dist < (R - 30)

# layers
dark = (L < 128) & interior
dark = clean(dark, min_area=40, close_iters=1)
green = mask_green(arr) & interior & (L > 60)
green = clean(green, min_area=200, close_iters=0)

lab, n = ndimage.label(dark)
dsz = sorted(ndimage.sum(dark, lab, range(1, n + 1)).tolist(), reverse=True)
lab2, n2 = ndimage.label(green)
gsz = sorted(ndimage.sum(green, lab2, range(1, n2 + 1)).tolist(), reverse=True)
print(f"dark comps: {dsz[:6]}  green comps: {gsz[:8]}")

# trace (crisper than first pass)
comps = mask_contour_paths(dark, s_factor=1.1, dp_eps=1.05, min_area=60)
gcomps = mask_contour_paths(green, s_factor=1.0, dp_eps=0.9, min_area=190)
print(f"paths: dark={len(comps)} green={len(gcomps)}")

vec_dark = iou_paths_vs_mask(comps, dark.shape)
vec_green = iou_paths_vs_mask(gcomps, green.shape)
iou_dark = iou(vec_dark, dark)
iou_green = iou(vec_green, green) if green.any() else 1.0
iou_all = iou(np.logical_or(vec_dark, vec_green), np.logical_or(dark, green))
print(f"IoU: dark={iou_dark:.4f} green={iou_green:.4f} combined={iou_all:.4f}")

# --- normalize to 512 square, centered on monogram bbox ---
allx0 = min(c["bbox"][0] for c in comps); allx1 = max(c["bbox"][2] for c in comps)
ally0 = min(c["bbox"][1] for c in comps); ally1 = max(c["bbox"][3] for c in comps)
bw, bh = allx1 - allx0, ally1 - ally0
TS = 512.0
M = TS * 0.06                                   # 6% margin
k = (TS - 2 * M) / max(bw, bh)
ox = allx0 - (TS - bw * k) / 2
oy = ally0 - (TS - bh * k) / 2

def svg_path(clist):
    d = []
    for c in clist:
        d.append(polyline_to_bezier_path(c["outer"], offset=(ox, oy), scale=k))
        for h in c["holes"]:
            d.append(polyline_to_bezier_path(h, offset=(ox, oy), scale=k))
    return " ".join(d)

pd, pg = svg_path(comps), svg_path(gcomps)

def build_svg(dark_fill, green_fill, label):
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" '
        f'aria-label="{label}">\n'
        f'<path fill="{dark_fill}" fill-rule="evenodd" d="{pd}"/>\n'
        f'<path fill="{green_fill}" fill-rule="evenodd" d="{pg}"/>\n'
        f'</svg>\n'
    )

out = pathlib.Path("/home/user/culina/assets/brand/build")
out.mkdir(parents=True, exist_ok=True)
svg_tok = build_svg(TOKENS["midnight"], TOKENS["green"], "CULINA monogram mark")
svg_art = build_svg(TOKENS["art_dark"], TOKENS["art_green"], "CULINA monogram mark (artwork colors)")
(out / "monogram.svg").write_text(svg_tok)
(out / "monogram-artwork.svg").write_text(svg_art)

# geometry JSON for downstream builders (mark in 512 space; roundel in 4x crop space)
(out / "monogram-geom.json").write_text(json.dumps({
    "viewBox": 512,
    "dark_path": pd,
    "green_path": pg,
    "iou": {"dark": iou_dark, "green": iou_green, "combined": iou_all},
    "roundel_4x": {"cx": cx, "cy": cy, "R": R,
                   "crop": [X0, Y0, X1, Y1], "scale": SCALE},
    "dark_area_4x": float(dark.sum()),
}, indent=1))

print(f"wrote monogram.svg ({len(svg_tok)} B), monogram-artwork.svg ({len(svg_art)} B)")
print(f"geom: bbox4x=({allx0:.0f},{ally0:.0f})-({allx1:.0f},{ally1:.0f}) k={k:.3f}")

# ascii preview of final vector fill
prev = np.asarray(Image.fromarray((vec_dark * 255).astype(np.uint8)).resize((100, 50), Image.LANCZOS)) > 100
for y in range(0, 50, 2):
    print("  " + "".join("#" if prev[y, x] else " " for x in range(100)))
