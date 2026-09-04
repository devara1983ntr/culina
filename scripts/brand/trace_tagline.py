#!/usr/bin/env python3
"""CULINA — trace the approved tagline + ornament (v1.3.0 artwork).

Source of truth: assets/brand/source/culina-logo-board.png. The tagline
"TASTE • DISCOVER • PLAN • ENJOY" is hand-lettered small caps (~26 px) in
gold; beneath it sits an ornamental rule (tapered double line with a small
central flourish). Both are traced as single-layer silhouettes (4× LANCZOS
upscale recovers the letterform edges; the gold fill is flat — the source
bevel at 26 px is sub-pixel detail, documented as a simplification).

Output: assets/brand/build/tagline-geom.json (generator input).
"""
from __future__ import annotations
import json
import pathlib
import sys

import numpy as np
from PIL import Image
from collections import Counter

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from trace_lib import (SRC_LOGO_BOARD, clean, mask_contour_paths,
                       iou_paths_vs_mask, iou, polyline_to_bezier_path)

ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
OUT = ROOT / "assets" / "brand" / "build" / "tagline-geom.json"

UPSCALE = 4
PARAMS = dict(s_factor=1.0, dp_eps=0.8, min_area=48, min_len=16)

def trace_zone(im, region, label):
    crop = im.crop(region).resize(
        ((region[2]-region[0])*UPSCALE, (region[3]-region[1])*UPSCALE), Image.LANCZOS)
    a = np.asarray(crop).astype(int)
    L = a.sum(2) / 3
    m = clean(L > 55, min_area=8*UPSCALE, close_iters=1)
    ink = (L > 55)
    ys, xs = np.where(m)
    ink_bbox = ([float(xs.min())/UPSCALE + region[0], float(ys.min())/UPSCALE + region[1],
                 float(xs.max())/UPSCALE + region[0], float(ys.max())/UPSCALE + region[1]]
                if len(xs) else None)
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
    # dominant ink color (reference for the flat fill)
    cnt = Counter(map(tuple, a[ink]))
    top = cnt.most_common(1)[0][0] if cnt else (222, 162, 43)
    print(f"  {label}: {len(paths)} comps, {m.sum():,} px @{UPSCALE}x, IoU {ij:.4f}, "
          f"ink #{top[0]:02X}{top[1]:02X}{top[2]:02X}")
    return {
        "region": list(region), "upscale": UPSCALE,
        "ink_bbox": [round(v, 1) for v in ink_bbox] if ink_bbox else None,
        "ink_color": f"#{top[0]:02X}{top[1]:02X}{top[2]:02X}",
        "iou": round(ij, 4), "paths": paths,
    }


def main():
    im = Image.open(SRC_LOGO_BOARD).convert("RGB")
    tagline = trace_zone(im, (226, 1066, 1106, 1100), "tagline")
    ornament = trace_zone(im, (398, 1112, 942, 1150), "ornament")
    geom = {
        "source": "assets/brand/source/culina-logo-board.png",
        "tagline": tagline,
        "ornament": ornament,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(geom))
    print("tagline + ornament →", OUT.relative_to(ROOT))


if __name__ == "__main__":
    main()
