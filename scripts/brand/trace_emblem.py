#!/usr/bin/env python3
"""CULINA — trace the approved emblem (v1.3.0 artwork).

Source of truth: assets/brand/source/culina-emblem-master.png (1254×1254,
the standalone emblem presentation on black). The emblem is painted
illustrative artwork: a thick gold→orange→red C-ring whose opening cradles a
cream chef's hat, a gold fork at center, a gold/white flame and red cocktail
at right, green herb sprigs flanking left/right.

Pipeline: 2× LANCZOS upscale → seeded k-means (14 colors) on bright pixels →
per-layer binary masks (morphological cleanup) → skimage contours →
B-spline smoothing → Douglas-Peucker → cubic Bézier paths. Fidelity is
measured per layer and as a weighted union IoU. No raster-in-SVG.

Output: assets/brand/build/emblem-geom.json (generator input).
"""
from __future__ import annotations
import json
import pathlib
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from trace_lib import (SRC_EMBLEM_MASTER, clean, mask_contour_paths,
                       iou_paths_vs_mask, iou, polyline_to_bezier_path)

ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
OUT = ROOT / "assets" / "brand" / "build" / "emblem-geom.json"

REGION = (60, 40, 1190, 1140)   # emblem + margin, source px
UPSCALE = 2
K = 14
MIN_LAYER_PX = 8000             # native-scale minimum for a kept layer
PARAMS = dict(s_factor=1.0, dp_eps=1.5, min_area=500, min_len=30)
SIMPLE_PARAMS = dict(s_factor=2.4, dp_eps=3.4, min_area=2500, min_len=40)

# §13 small-size color families: 14 painted tones → 6 separable hues
FAMILIES = [
    ("#F7B728", (0xF6A614, 0xFACB31, 0xFBE25F, 0xFCEE96), "gold"),
    ("#DC7307", (0xE17C08, 0xB15907), "orange"),
    ("#DE2A05", (0xE61F03, 0x8C2303), "red"),
    ("#567F06", (0x437503, 0x83B50B), "green"),
    ("#F6F0E7", (0xFBF9F3, 0xEEE4D2), "cream"),
    ("#C9AF92", (0xD2BBA4, 0xB49069), "beige"),
]
SEED = 11


def main():
    im = Image.open(SRC_EMBLEM_MASTER).convert("RGB")
    crop = im.crop(REGION).resize(
        ((REGION[2]-REGION[0])*UPSCALE, (REGION[3]-REGION[1])*UPSCALE), Image.LANCZOS)
    a = np.asarray(crop).astype(float)
    H, W = a.shape[:2]

    # seeded k-means on bright pixels
    rng = np.random.default_rng(SEED)
    lum = a.sum(2) / 3
    bright = lum > 45
    px = a[bright]
    idx = rng.choice(len(px), size=min(120000, len(px)), replace=False)
    X = px[idx]
    cent = X[rng.choice(len(X), K, replace=False)]
    for _ in range(24):
        d = ((X[:, None, :] - cent[None, :, :]) ** 2).sum(2)
        lab = d.argmin(1)
        for j in range(K):
            sel = X[lab == j]
            if len(sel):
                cent[j] = sel.mean(0)

    # full-resolution assignment (chunked)
    flat = a.reshape(-1, 3)
    fl = np.empty(len(flat), dtype=np.int8)
    for s in range(0, len(flat), 500000):
        chunk = flat[s:s+500000]
        d = ((chunk[:, None, :] - cent[None, :, :]) ** 2).sum(2)
        fl[s:s+len(chunk)] = d.argmin(1).astype(np.int8)
    full_lab = fl.reshape(H, W)

    # ink bbox (native source px) for composing
    ink = bright
    ys, xs = np.where(ink)
    ink_bbox = [float(xs.min())/UPSCALE + REGION[0], float(ys.min())/UPSCALE + REGION[1],
                float(xs.max())/UPSCALE + REGION[0], float(ys.max())/UPSCALE + REGION[1]]

    layers, num, den = [], 0, 0
    for j in range(K):
        m = (full_lab == j) & bright
        if m.sum() < MIN_LAYER_PX * UPSCALE * UPSCALE / 4:
            continue
        m = clean(m, min_area=800, close_iters=2)
        if m.sum() < MIN_LAYER_PX * UPSCALE * UPSCALE / 4:
            continue
        comps = mask_contour_paths(m, **PARAMS)
        vec = iou_paths_vs_mask(comps, m.shape)
        ij = iou(vec, m)
        c = cent[j].round().astype(int)
        paths = []
        for comp in comps:
            # store in upscaled crop coords; generator rescales
            d = polyline_to_bezier_path(comp["outer"])
            if not d:
                continue
            holes = [polyline_to_bezier_path(h) for h in comp["holes"]]
            paths.append({"d": d, "area": round(comp["area"], 1),
                          "bbox": [round(v, 1) for v in comp["bbox"]], "holes": holes})
        if not paths:
            continue
        layers.append({
            "color": f"#{c[0]:02X}{c[1]:02X}{c[2]:02X}",
            "px": int(m.sum()), "iou": round(ij, 4), "paths": paths,
        })
        num += ij * m.sum(); den += m.sum()

    layers.sort(key=lambda L: -L["px"])
    geom = {
        "source": "assets/brand/source/culina-emblem-master.png",
        "region": list(REGION), "upscale": UPSCALE,
        "ink_bbox": [round(v, 1) for v in ink_bbox],
        "layers": layers,
        "union_iou": round(num / den, 4),
        "palette": [L["color"] for L in layers],
    }
    OUT.write_text(json.dumps(geom))
    print(f"emblem: {len(layers)} layers, union IoU {geom['union_iou']:.4f}")
    for L in layers:
        print(f"  {L['color']}  {L['px']:>8,} px  {len(L['paths']):>3} comps  IoU {L['iou']:.4f}")
    print(f"ink bbox (source px): {[round(v,1) for v in ink_bbox]}")

    # ---------------- §13 small-size variant: 6 merged families, aggressive
    fam_layers = {}
    for fc, members, _name in FAMILIES:
        mm = np.zeros((H, W), dtype=bool)
        for j in range(K):
            c = tuple(cent[j].round().astype(int))
            rgb_int = (c[0] << 16) | (c[1] << 8) | c[2]
            if rgb_int in members:
                mm |= (full_lab == j) & bright
        if not mm.any():
            continue
        mm = clean(mm, min_area=2000, close_iters=2)
        if not mm.any():
            continue
        comps = mask_contour_paths(mm, **SIMPLE_PARAMS)
        vec = iou_paths_vs_mask(comps, mm.shape)
        ij = iou(vec, mm)
        paths = []
        for comp in comps:
            d = polyline_to_bezier_path(comp["outer"])
            if not d:
                continue
            holes = [polyline_to_bezier_path(h) for h in comp["holes"]]
            paths.append({"d": d, "area": round(comp["area"], 1),
                          "bbox": [round(v, 1) for v in comp["bbox"]], "holes": holes})
        fam_layers[fc] = {"color": fc, "px": int(mm.sum()), "iou": round(ij, 4),
                          "paths": paths}
        print(f"  simple {fc}: {mm.sum():>8,} px, {len(paths):>3} comps, IoU {ij:.4f}")
    simple = {
        "source": geom["source"], "region": list(REGION), "upscale": UPSCALE,
        "ink_bbox": geom["ink_bbox"],
        "layers": sorted(fam_layers.values(), key=lambda L: -L["px"]),
        "note": "small-size variant (§13): 6 color families, aggressive simplification",
    }
    (OUT.parent / "emblem-geom-simple.json").write_text(json.dumps(simple))


if __name__ == "__main__":
    main()
