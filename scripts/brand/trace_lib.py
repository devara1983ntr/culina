#!/usr/bin/env python3
"""CULINA brand tracing library — real vectorization pipeline.

Turns raster artwork regions of the approved brand board into genuine
cubic-Bézier SVG paths:

  crop → LANCZOS upscale → color-layer masks → contour extraction
  (skimage find_contours) → B-spline smoothing (scipy splprep)
  → Douglas-Peucker reduction → Catmull-Rom → cubic Bézier SVG path

Fidelity is measured as IoU between the rasterized vector fill and the
source layer mask. No raster-in-SVG, no PNG-renamed-SVG.
"""
from __future__ import annotations
import math
import numpy as np
from PIL import Image
from scipy import ndimage
from scipy.interpolate import splprep, splev
from skimage import measure

BOARD = "/home/user/culina/docs/brand/culina-brand-board.png"


def load_board() -> Image.Image:
    return Image.open(BOARD).convert("RGB")


def extract(im: Image.Image, x0, y0, x1, y1, scale=4) -> Image.Image:
    """Crop + high-quality upscale (no invented detail; LANCZOS only)."""
    return im.crop((x0, y0, x1, y1)).resize(
        ((x1 - x0) * scale, (y1 - y0) * scale), Image.LANCZOS
    )


# ---------------------------------------------------------------- masks

def rgb(arr):
    return arr[:, :, 0].astype(int), arr[:, :, 1].astype(int), arr[:, :, 2].astype(int)


def lum(arr):
    r, g, b = rgb(arr)
    return 0.299 * r + 0.587 * g + 0.114 * b


def mask_dark(arr, thr=110):
    return lum(arr) < thr


def mask_green(arr):
    r, g, b = rgb(arr)
    return (g > 95) & (g > r - 5) & (g > b + 25) & (lum(arr) < 235)


def clean(mask, min_area=6, close_iters=1):
    """Morphological cleanup + drop specks."""
    m = mask.copy()
    if close_iters:
        m = ndimage.binary_closing(m, iterations=close_iters)
        m = ndimage.binary_opening(m, iterations=1)
    lab, n = ndimage.label(m)
    if n:
        sizes = ndimage.sum(m, lab, range(1, n + 1))
        keep = np.isin(lab, np.where(sizes >= min_area)[0] + 1)
        m = keep
    return m


def largest_component(mask):
    lab, n = ndimage.label(mask)
    if n == 0:
        return mask, []
    sizes = ndimage.sum(mask, lab, range(1, n + 1))
    order = np.argsort(sizes)[::-1]
    comps = []
    for i in order:
        if sizes[i] <= 0:
            break
        comps.append(lab == i + 1)
    return comps[0], comps


# ------------------------------------------------------- contour → bezier

def douglas_peucker(pts, eps):
    """Iterative DP simplification of an Nx2 closed/inline point list."""
    if len(pts) < 3:
        return pts
    n = len(pts)
    keep = np.zeros(n, dtype=bool)
    keep[0] = keep[-1] = True
    stack = [(0, n - 1)]
    while stack:
        i, j = stack.pop()
        if j <= i + 1:
            continue
        p0, p1 = pts[i], pts[j]
        seg = p1 - p0
        L = math.hypot(*seg)
        sub = pts[i + 1:j]
        if L == 0:
            d = np.hypot(*(sub - p0).T)
        else:
            d = np.abs(np.cross(seg, sub - p0)) / L
        k = np.argmax(d)
        if d[k] > eps:
            k += i + 1
            keep[k] = True
            stack.append((i, k))
            stack.append((k, j))
    return pts[keep]


def smooth_contour(contour, s_factor=2.0, dp_eps=0.9, min_len=24):
    """(row,col) contour → smoothed, reduced (x,y) polyline (y = row, down)."""
    pts = np.column_stack([contour[:, 1], contour[:, 0]]).astype(float)
    if len(pts) < min_len:
        return None
    try:
        tck, _ = splprep([pts[:, 0], pts[:, 1]], s=s_factor * len(pts), k=3, per=1)
    except Exception:
        return None
    dense = np.column_stack(splev(np.linspace(0, 1, max(400, 4 * len(pts))), tck))
    simp = douglas_peucker(dense, dp_eps)
    # ensure closed
    if (simp[0] != simp[-1]).any():
        simp = np.vstack([simp, simp[0]])
    if len(simp) < 5:
        return None
    return simp


def polyline_to_bezier_path(pts, offset=(0.0, 0.0), scale=1.0):
    """Closed polyline → SVG path of cubic Béziers (Catmull-Rom, tension 1)."""
    p = (np.asarray(pts, dtype=float) - np.asarray(offset)) * scale
    n = len(p) - 1  # last == first
    if n < 3:
        return ""
    d = [f"M {p[0,0]:.1f} {p[0,1]:.1f}"]
    for i in range(n):
        p0 = p[(i - 1) % n]
        p1 = p[i]
        p2 = p[(i + 1) % n]
        p3 = p[(i + 2) % n]
        c1 = p1 + (p2 - p0) / 6.0
        c2 = p2 - (p3 - p1) / 6.0
        d.append(
            f"C {c1[0]:.1f} {c1[1]:.1f} {c2[0]:.1f} {c2[1]:.1f} {p2[0]:.1f} {p2[1]:.1f}"
        )
    d.append("Z")
    return " ".join(d)


def bezier_path_points(pts):
    """Dense sampling of the Catmull-Rom Bézier path (for IoU rasterization)."""
    p = np.asarray(pts, dtype=float)
    n = len(p) - 1
    out = []
    for i in range(n):
        p0, p1, p2, p3 = p[(i - 1) % n], p[i], p[(i + 1) % n], p[(i + 2) % n]
        c1 = p1 + (p2 - p0) / 6.0
        c2 = p2 - (p3 - p1) / 6.0
        for t in np.linspace(0, 1, 12, endpoint=False):
            mt = 1 - t
            x = mt**3 * p1[0] + 3 * mt**2 * t * c1[0] + 3 * mt * t**2 * c2[0] + t**3 * p2[0]
            y = mt**3 * p1[1] + 3 * mt**2 * t * c1[1] + 3 * mt * t**2 * c2[1] + t**3 * p2[1]
            out.append((x, y))
    return out


def mask_contour_paths(mask, s_factor=2.0, dp_eps=0.9, min_area=20, min_len=24):
    """Binary mask → (outer, holes) smoothed polylines per component.

    Returns list of dicts {outer: pts, holes: [pts...], area, bbox} sorted by
    area descending. Holes smaller than min_area are ignored (filled).
    """
    pad = np.pad(mask, 1)
    contours = measure.find_contours(pad, 0.5)
    # find_contours gives both outers and holes; classify by orientation later.
    polys = []
    for c in contours:
        pts = np.column_stack([c[:, 1], c[:, 0]]) - 1.0  # back to unpadded coords
        # signed area (shoelace) — positive = outer (CCW in y-down), negative = hole
        a = 0.5 * np.sum(pts[:, 0] * np.roll(pts[:, 1], -1) - np.roll(pts[:, 0], -1) * pts[:, 1])
        polys.append((a, pts))
    outers = [p for a, p in polys if a > 0]
    holes = [p for a, p in polys if a < 0]
    comps = []
    for o in outers:
        oa = abs(shoelace(o))
        if oa < min_area:
            continue
        sm = smooth_contour(np.column_stack([o[:, 1], o[:, 0]]), s_factor, dp_eps, min_len)
        if sm is None:
            continue
        my_holes = []
        for h in holes:
            if abs(shoelace(h)) < min_area:
                continue
            # hole belongs if its first point is inside the outer polygon
            if point_in_poly(h[0], o):
                shm = smooth_contour(np.column_stack([h[:, 1], h[:, 0]]), s_factor, dp_eps, min_len)
                if shm is not None:
                    my_holes.append(shm)
        xs, ys = sm[:, 0], sm[:, 1]
        comps.append({
            "outer": sm, "holes": my_holes, "area": oa,
            "bbox": (xs.min(), ys.min(), xs.max(), ys.max()),
        })
    comps.sort(key=lambda c: -c["area"])
    return comps


def shoelace(pts):
    return 0.5 * np.sum(pts[:, 0] * np.roll(pts[:, 1], -1) - np.roll(pts[:, 0], -1) * pts[:, 1])


def point_in_poly(pt, poly):
    x, y = pt
    inside = False
    n = len(poly)
    j = n - 1
    for i in range(n):
        xi, yi = poly[i]
        xj, yj = poly[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi:
            inside = not inside
        j = i
    return inside


# ------------------------------------------------------------------ IoU

def iou_paths_vs_mask(comps, mask_shape):
    """Rasterize component fills (outer minus holes) and IoU vs mask."""
    H, W = mask_shape
    canvas = Image.new("L", (W, H), 0)
    from PIL import ImageDraw
    draw = ImageDraw.Draw(canvas)
    fill_acc = Image.new("L", (W, H), 0)
    for c in comps:
        tmp = Image.new("L", (W, H), 0)
        td = ImageDraw.Draw(tmp)
        td.polygon([tuple(p) for p in c["outer"]], fill=255)
        for h in c["holes"]:
            td.polygon([tuple(p) for p in h], fill=0)
        fill_acc = Image.fromarray(np.maximum(np.asarray(fill_acc), np.asarray(tmp)))
    vec = np.asarray(fill_acc) > 127
    return vec


def iou(a, b):
    inter = np.logical_and(a, b).sum()
    union = np.logical_or(a, b).sum()
    return inter / union if union else 1.0
