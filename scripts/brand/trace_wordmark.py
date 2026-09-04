#!/usr/bin/env python3
"""CULINA — trace the approved wordmark (v1.3.0 artwork).

Source of truth: assets/brand/source/culina-logo-board.png (full logo
presentation). The CULINA wordmark is dimensional gold lettering (gold body,
white bevel highlights, deep-gold shadow accents) at ~176 px cap height —
artwork, not a typeface. Traced as three color layers.

Pipeline: 4× LANCZOS upscale → three color masks (gold / white / deep) →
cleanup → contours → B-spline → DP → cubic Bézier. IoU measured per layer.

Output: assets/brand/build/wordmark-geom.json (generator input).
"""
from __future__ import annotations
import json
import pathlib
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from trace_lib import (SRC_LOGO_BOARD, clean, mask_contour_paths,
                       iou_paths_vs_mask, iou, polyline_to_bezier_path)

ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
OUT = ROOT / "assets" / "brand" / "build" / "wordmark-geom.json"

REGION = (170, 830, 1156, 1022)   # wordmark + margin, source px
UPSCALE = 4
PARAMS = dict(s_factor=1.5, dp_eps=1.8, min_area=300, min_len=30)

# layer thresholds on the upscaled crop (RGB ints)
def mask_gold(r, g, b, L):
    return (r > 120) & (g > 70) & (g < 215) & (b < 130) & (L > 70)

def mask_white(r, g, b, L):
    return (r > 195) & (g > 190) & (b > 175)

def mask_deep(r, g, b, L):
    return (r > 90) & (r < 190) & (g > 40) & (g < 120) & (b < 80) & (L > 35)

LAYERS = [
    ("gold",  "#FAB625", mask_gold,  1600),
    ("deep",  "#A66003", mask_deep,  1000),
    ("white", "#FFFFFF", mask_white,  700),
]


def main():
    im = Image.open(SRC_LOGO_BOARD).convert("RGB")
    crop = im.crop(REGION).resize(
        ((REGION[2]-REGION[0])*UPSCALE, (REGION[3]-REGION[1])*UPSCALE), Image.LANCZOS)
    a = np.asarray(crop).astype(int)
    H, W = a.shape[:2]
    r, g, b = a[:, :, 0], a[:, :, 1], a[:, :, 2]
    L = a.sum(2) / 3

    ink = (L > 55)
    ys, xs = np.where(ink)
    ink_bbox = [float(xs.min())/UPSCALE + REGION[0], float(ys.min())/UPSCALE + REGION[1],
                float(xs.max())/UPSCALE + REGION[0], float(ys.max())/UPSCALE + REGION[1]]

    out_layers = []
    for name, color, fn, min_px in LAYERS:
        m = fn(r, g, b, L)
        m = clean(m, min_area=25*UPSCALE, close_iters=2)
        if m.sum() < min_px * UPSCALE:
            print(f"  layer {name}: only {m.sum()} px — skipped")
            continue
        comps = mask_contour_paths(m, **PARAMS)
        vec = iou_paths_vs_mask(comps, m.shape)
        ij = iou(vec, m)
        paths = []
        for comp in comps:
            d = polyline_to_bezier_path(comp["outer"])
            if not d:
                continue
            holes = [polyline_to_bezier_path(h) for h in comp["holes"]]
            paths.append({"d": d, "area": round(comp["area"], 1),
                          "bbox": [round(v, 1) for v in comp["bbox"]], "holes": holes})
        out_layers.append({"name": name, "color": color, "px": int(m.sum()),
                           "iou": round(ij, 4), "paths": paths})
        print(f"  {name:>5} {color}: {m.sum():>7,} px, {len(paths):>3} comps, IoU {ij:.4f}")

    geom = {
        "source": "assets/brand/source/culina-logo-board.png",
        "region": list(REGION), "upscale": UPSCALE,
        "ink_bbox": [round(v, 1) for v in ink_bbox],
        "cap_height": round(ink_bbox[3] - ink_bbox[1], 1),
        "layers": out_layers,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(geom))
    print(f"wordmark: {len(out_layers)} layers, ink bbox {[round(v,1) for v in ink_bbox]}, "
          f"cap {geom['cap_height']}px")


if __name__ == "__main__":
    main()
