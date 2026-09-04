#!/usr/bin/env python3
"""Trace the Panel A full-color emblem → layered Bézier SVG + IoU report.

Panel A construction (verified): cream squircle badge (≈137×155 src, r≈26)
+ organic dark ground mass + full-color emblem elements painted on it.

Outputs (assets/brand/build/):
  emblem.svg        transparent full-color emblem (elements only), 512 viewBox
  emblem-full.svg   elements + dark ground layer (for logo builder)
  emblem-geom.json  layers + colors + IoU + badge geometry
"""
from __future__ import annotations
import json
import pathlib
import sys
import numpy as np
from PIL import Image
from scipy import ndimage
from scipy.cluster.vq import kmeans2

sys.path.insert(0, str(pathlib.Path(__file__).parent))
from trace_lib import (  # noqa: E402
    load_board, extract, rgb, lum, clean, mask_contour_paths,
    iou_paths_vs_mask, iou, polyline_to_bezier_path,
)

SCALE = 6
# Panel A badge outer squircle in board coords (measured):
# x 870..1007, y 66..221 (137×155), corner radius ≈ 26
BADGE = dict(x0=870, y0=66, x1=1007, y1=221, r=26)
X0, Y0 = BADGE["x0"] - 4, BADGE["y0"] - 4
X1, Y1 = BADGE["x1"] + 4, BADGE["y1"] + 4

im = load_board()
big = extract(im, X0, Y0, X1, Y1, SCALE)
arr = np.asarray(big).astype(int)
H, W = arr.shape[:2]
r_, g_, b_ = rgb(arr)
L = lum(arr)

# --- badge squircle mask (6x coords) ------------------------------------
bx0, by0 = (BADGE["x0"] - X0) * SCALE, (BADGE["y0"] - Y0) * SCALE
bx1, by1 = (BADGE["x1"] - X0) * SCALE, (BADGE["y1"] - Y0) * SCALE
R6 = BADGE["r"] * SCALE
yy, xx = np.mgrid[0:H, 0:W]
badge = ((xx >= bx0 + R6) | (yy >= by0 + R6) | (((xx - (bx1 - R6)).clip(0, 1e9) ** 2 + (yy - (by1 - R6)).clip(0, 1e9) ** 2) <= R6**2) |
         (((xx - (bx0 + R6) - 1).clip(-1e9, 0).astype(float)) ** 2 + ((yy - (by1 - R6) - 1).clip(-1e9, 0).astype(float)) ** 2 <= R6**2) |
         (((xx - (bx1 - R6) - 1).clip(-1e9, 0).astype(float)) ** 2 + ((yy - (by0 + R6) - 1).clip(-1e9, 0).astype(float)) ** 2 <= R6**2))
badge &= ((xx >= bx0) & (xx <= bx1) & (yy >= by0) & (yy <= by1))
# interior = badge inset by ~14 src px
inset = 8 * SCALE
ix0, iy0, ix1, iy1, ir = bx0 + inset, by0 + inset, bx1 - inset, by1 - inset, R6 - inset * 0.7
interior = ((xx >= ix0 + ir) | (yy >= iy0 + ir) | (((xx - (ix1 - ir)).clip(0, 1e9) ** 2 + (yy - (iy1 - ir)).clip(0, 1e9) ** 2) <= ir**2) |
            (((xx - (ix0 + ir) - 1).clip(-1e9, 0).astype(float)) ** 2 + ((yy - (iy1 - ir) - 1).clip(-1e9, 0).astype(float)) ** 2 <= ir**2) |
            (((xx - (ix1 - ir) - 1).clip(-1e9, 0).astype(float)) ** 2 + ((yy - (iy0 + ir) - 1).clip(-1e9, 0).astype(float)) ** 2 <= ir**2))
interior &= ((xx >= ix0) & (xx <= ix1) & (yy >= iy0) & (yy <= iy1))
print(f"badge 6x: ({bx0},{by0})-({bx1},{by1}) r={R6}  interior px={interior.sum()}")

# --- quantization over interior -----------------------------------------
px = arr[interior].astype(float)
SEEDS = np.array([
    [255, 183, 3], [254, 212, 65], [253, 240, 187], [239, 208, 138],
    [251, 86, 7], [244, 71, 0], [254, 138, 18], [230, 57, 70], [197, 2, 1],
    [254, 248, 234], [210, 195, 182], [47, 190, 113], [112, 154, 112],
    [44, 47, 51], [16, 18, 24], [92, 78, 60],
], dtype=float)
centroids, labels = kmeans2(px, SEEDS, iter=30, minit="matrix")
lab_img = np.full((H, W), -1, dtype=int)
lab_img[interior] = labels

# --- ground separation --------------------------------------------------
def cluster_lum(i):
    c = centroids[i]
    return 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]

dark_ids = [i for i in range(len(centroids)) if cluster_lum(i) < 95]
darkmask = np.isin(lab_img, dark_ids) & interior
lab_d, n_d = ndimage.label(darkmask)
sizes_d = ndimage.sum(darkmask, lab_d, range(1, n_d + 1))
# ground = largest dark component (organic mass)
gi = int(np.argmax(sizes_d)) + 1
ground = (lab_d == gi)
print(f"ground px={ground.sum()} ({100*ground.sum()/interior.sum():.1f}% of interior), "
      f"dark clusters={dark_ids}, dark comps={n_d}")

# --- badge chrome cream (border-connected cream = badge surface) --------
cream_ids = [i for i in range(len(centroids))
             if cluster_lum(i) > 195
             and abs(centroids[i][0] - centroids[i][2]) > 15]
creammask = np.isin(lab_img, cream_ids) & interior
lab_c, n_c = ndimage.label(creammask)
edge_band = interior & ~ndimage.binary_erosion(interior, iterations=8)
border_c = set(lab_c[edge_band][lab_c[edge_band] > 0].tolist())
chrome = np.isin(lab_c, list(border_c)) if border_c else np.zeros_like(creammask)
print(f"chrome cream px={chrome.sum()} ({100*chrome.sum()/interior.sum():.1f}%) cream clusters={cream_ids}")

# --- element layers -----------------------------------------------------
layers = []
for i in range(len(centroids)):
    m = (lab_img == i) & interior & ~ground & ~chrome
    if m.sum() < 250:
        continue
    m2 = clean(m, min_area=90, close_iters=1)
    if m2.sum() < 200:
        continue
    layers.append((i, m2))
# enclosed dark detail patches (shading inside elements)
enc_dark = darkmask & ~ground & ~chrome
enc_dark = clean(enc_dark, min_area=120, close_iters=0)
if enc_dark.sum() > 200:
    # assign to nearest centroid color of its own pixels
    layers.append(("dark", enc_dark))
layers.sort(key=lambda t: -t[1].sum())
print("layers (id, px, color):")
for i, m in layers:
    if i == "dark":
        print(f"  dark-detail {m.sum():7d}")
    else:
        c = centroids[i].astype(int)
        print(f"  #{i:2d} {m.sum():7d}  #{c[0]:02X}{c[1]:02X}{c[2]:02X}")

# --- trace --------------------------------------------------------------
all_paths, ious = {}, {}
chrome_dilated = ndimage.binary_dilation(chrome, iterations=10)
union_src = np.zeros((H, W), bool)
union_vec = np.zeros((H, W), bool)
for i, m in layers:
    comps = mask_contour_paths(m, s_factor=1.1, dp_eps=1.0, min_area=120)
    if not comps:
        continue
    vec = iou_paths_vs_mask(comps, m.shape)
    all_paths[i] = comps
    ious[str(i)] = round(iou(vec, m), 4)
    union_src |= m
    union_vec |= vec
    print(f"  layer {i}: {len(comps)} paths IoU={ious[str(i)]:.3f}")

# ground trace
gcomps = mask_contour_paths(ground, s_factor=1.3, dp_eps=1.1, min_area=200)
gvec = iou_paths_vs_mask(gcomps, ground.shape)
giou = iou(gvec, ground)
print(f"ground: {len(gcomps)} paths IoU={giou:.3f}")
full_src = union_src | ground
full_vec = union_vec | gvec
print(f"UNION IoU elements={iou(union_vec, union_src):.4f} full={iou(full_vec, full_src):.4f}")

# --- normalize to 512 over ELEMENTS+ground ------------------------------
els = [c for (i, m) in layers for c in all_paths.get(i, [])] + gcomps
bx0e = min(c["bbox"][0] for c in els); bx1e = max(c["bbox"][2] for c in els)
by0e = min(c["bbox"][1] for c in els); by1e = max(c["bbox"][3] for c in els)
bw, bh = bx1e - bx0e, by1e - by0e
TS = 512.0
M = TS * 0.04
k = (TS - 2 * M) / max(bw, bh)
ox = bx0e - (TS - bw * k) / 2
oy = by0e - (TS - bh * k) / 2

def to_svg_path(comps):
    d = []
    for c in comps:
        d.append(polyline_to_bezier_path(c["outer"], offset=(ox, oy), scale=k))
        for h in c["holes"]:
            d.append(polyline_to_bezier_path(h, offset=(ox, oy), scale=k))
    return " ".join(d)

def col_of(i):
    if i == "dark":
        return "#23262C"
    c = centroids[i]
    return f"#{int(round(c[0])):02X}{int(round(c[1])):02X}{int(round(c[2])):02X}"

layer_records = []
def build(elements_only):
    body = []
    recs = []
    if not elements_only:
        d = to_svg_path(gcomps)
        gc = "#2A2D33"
        body.append(f'<path fill="{gc}" fill-rule="evenodd" d="{d}"/>')
        recs.append({"color": gc, "role": "ground", "d": d})
    for i, m in layers:
        comps = all_paths.get(i)
        if not comps:
            continue
        d = to_svg_path(comps)
        col = col_of(i)
        body.append(f'<path fill="{col}" fill-rule="evenodd" d="{d}"/>')
        recs.append({"color": col, "role": "element" if i != "dark" else "detail", "d": d})
    lbl = "CULINA emblem" if elements_only else "CULINA emblem with ground"
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" '
            f'aria-label="{lbl}">\n' + "\n".join(body) + "\n</svg>\n"), recs

svg_elem, recs_elem = build(True)
svg_full, recs_full = build(False)

out = pathlib.Path("/home/user/culina/assets/brand/build")
out.mkdir(parents=True, exist_ok=True)
(out / "emblem.svg").write_text(svg_elem)
(out / "emblem-full.svg").write_text(svg_full)
(out / "emblem-geom.json").write_text(json.dumps({
    "viewBox": 512,
    "layers_elements": recs_elem,
    "layers_full": recs_full,
    "ground_color": "#2A2D33",
    "iou": {"elements": round(iou(union_vec, union_src), 4),
            "full": round(iou(full_vec, full_src), 4),
            "ground": round(giou, 4), "per_layer": ious},
    "badge_src": BADGE,
}, indent=1))
print(f"wrote emblem.svg ({len(svg_elem)} B), emblem-full.svg ({len(svg_full)} B)")

prev = np.asarray(Image.fromarray((full_vec * 255).astype(np.uint8)).resize((96, 48), Image.LANCZOS)) > 100
for y in range(0, 48, 2):
    print("  " + "".join("#" if prev[y, x] else " " for x in range(96)))
