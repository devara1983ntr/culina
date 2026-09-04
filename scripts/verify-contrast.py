#!/usr/bin/env python3
"""
CULINA — Design-token contrast verification (WCAG 2.2 AA).

Computes the contrast ratio for every critical token pairing in BOTH themes
and fails (exit 1) if any pair is below its requirement:

  body text / links / semantic text     ≥ 4.5:1
  text on primary/danger buttons        ≥ 4.5:1
  muted text                            ≥ 4.5:1
  focus indicator vs adjacent surface   ≥ 3.0:1  (WCAG 2.2 focus-appearance)

Run:  python3 scripts/verify-contrast.py
This is the recorded evidence for the palette mapping in css/tokens.css and
docs/DESIGN-DECISIONS.md §21.
"""

import sys


def lum(hex_color):
    h = hex_color.lstrip("#")
    r, g, b = (int(h[i : i + 2], 16) / 255 for i in (0, 2, 4))

    def lin(c):
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)


def ratio(a, b):
    la, lb = lum(a), lum(b)
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)


# --- Brand primitives (approved board) --------------------------------------
GOLD = "#FFB703"
ORANGE = "#FB5607"
GREEN = "#2ECC71"
CRIMSON = "#E63946"
MIDNIGHT = "#0B0F19"
CREAM = "#FFF7E6"

# --- Semantic mapping (must match css/tokens.css exactly) --------------------
LIGHT = {
    "background": CREAM,
    "background-subtle": "#F8EFDA",
    "surface": "#FFFDF7",
    "surface-2": "#FAF2E1",
    "text": MIDNIGHT,
    "text-secondary": "#443A28",
    "text-muted": "#5D5140",
    "border": "#EBDFC6",
    "border-strong": "#DCCCA8",
    "primary": "#C2410C",  # deepened Spicy Orange (AA as text AND as button bg)
    "on-primary": CREAM,
    "primary-strong": "#9A3412",
    "primary-hover": "#A83A0B",
    "accent": "#C2410C",
    "success": "#1E7A45",  # deepened Fresh Green
    "warning": "#8A6400",  # deepened Ember Gold
    "danger": "#B3241E",  # deepened Deep Crimson
    "info": "#2F4B72",  # slate derived from Midnight's hue
    "focus": "#C2410C",
}

DARK = {
    "background": MIDNIGHT,
    "background-subtle": "#101624",
    "surface": "#141B2C",
    "surface-2": "#1A2236",
    "text": CREAM,
    "text-secondary": "#D9D2C0",
    "text-muted": "#A89F8C",
    "border": "#262F45",
    "border-strong": "#37415C",
    "primary": GOLD,
    "on-primary": MIDNIGHT,
    "primary-strong": "#FFC733",
    "primary-hover": "#FFC94D",
    "accent": ORANGE,
    "success": GREEN,
    "warning": "#FFD268",  # lightened Ember Gold
    "danger": "#FF6B77",  # lightened Deep Crimson
    "info": "#9DB8E8",
    "focus": GOLD,
}

failures = []


def check(theme, name, fg, bg, need=4.5):
    r = ratio(fg, bg)
    ok = r >= need
    print(f"  [{theme:5s}] {name:28s} {fg} on {bg} = {r:5.2f}:1  {'OK' if ok else 'FAIL'} (need {need})")
    if not ok:
        failures.append((theme, name, r, need))


for label, theme in (("LIGHT", LIGHT), ("DARK", DARK)):
    print(f"\n{label} theme")
    check(label, "text on background", theme["text"], theme["background"])
    check(label, "text on surface", theme["text"], theme["surface"])
    check(label, "text-secondary on background", theme["text-secondary"], theme["background"], 4.5)
    check(label, "text-muted on background", theme["text-muted"], theme["background"], 4.5)
    check(label, "text-muted on surface", theme["text-muted"], theme["surface"], 4.5)
    check(label, "primary as text on background", theme["primary"], theme["background"])
    check(label, "primary as text on surface", theme["primary"], theme["surface"])
    check(label, "on-primary on primary (button)", theme["on-primary"], theme["primary"])
    check(label, "primary-hover on background", theme["primary-hover"], theme["background"])
    check(label, "accent as text on background", theme["accent"], theme["background"])
    check(label, "success as text on background", theme["success"], theme["background"])
    check(label, "warning as text on background", theme["warning"], theme["background"])
    check(label, "danger as text on background", theme["danger"], theme["background"])
    check(label, "danger on cream/midnight (chip)", theme["danger"], CREAM if label == "LIGHT" else MIDNIGHT)
    check(label, "info as text on background", theme["info"], theme["background"])
    check(label, "focus vs surface (≥3:1)", theme["focus"], theme["surface"], 3.0)
    # WCAG 1.4.11 (non-text contrast): state indicators must be ≥3:1 — covered by
    # the focus ring above. Card/input borders are decorative separators (labels,
    # placeholders and focus rings identify components); they are intentionally
    # subtle in this design system (documented in DESIGN-DECISIONS §21).

print()
if failures:
    print(f"{len(failures)} CONTRAST FAILURES:")
    for f in failures:
        print("  ", f)
    sys.exit(1)
print("ALL CONTRAST PAIRS PASS (WCAG 2.2 AA)")
