# Contributing to CULINA

Thanks for considering a contribution! CULINA is a deliberately vanilla,
local-first food intelligence platform — please read this document before
opening a PR.

## Ground rules

1. **No fake data, ever.** If a provider does not supply a value, it is `null`
   and the UI shows an honest "not available" state. Never invent ratings,
   times, nutrition or images. Never simulate success, loading or security.
2. **No secrets in the client.** Key-requiring providers stay disabled unless
   wired through the gateway with server-side configuration.
3. **Keep the architecture.** UI → services → API client → adapters →
   providers. Pages never see provider field names. A new provider is exactly
   one registry entry + one adapter + one normalizer.
4. **Accessibility is not optional.** WCAG 2.2 AA: keyboard operability,
   visible focus, ≥44 px touch targets, 4.5:1 contrast in both themes,
   `prefers-reduced-motion` respected. Design tokens only — no hardcoded
   colors outside `css/tokens.css`.
5. **The approved brand identity** (`docs/brand/culina-brand-board.png`) is
   the visual source of truth. Brand geometry is generated — run
   `python3 scripts/generate-brand-assets.py` (see its header for the
   rasterizer) rather than editing SVGs by hand.

## Development setup

```bash
npm ci            # install dependencies
npm run dev       # dev server with the provider proxy (http://localhost:5173)
```

## Before you open a PR — all gates must be green

```bash
npm test                                  # unit + integration (node:test)
npm run audit                             # imports, CSS classes, icons, routes
npm run build                             # production build
node scripts/gateway-test.mjs             # gateway contract (boots its own server)
python3 scripts/verify-contrast.py        # WCAG 2.2 AA token contrast
npm run test:ui                           # browser E2E, Chromium + Firefox
```

The browser E2E needs playwright-core and a browser build (see README →
Testing). CI runs the same gates on every push and pull request — a red gate
blocks the PR; nothing is configured to ignore failures.

## Commit style

Short, imperative subject line, optional body explaining *why*. Examples:

```
Add unit-aware quantity merging to planner shopping list
Rebrand tokens to approved board palette (AA-verified shades)
Fix provider outage state never clearing after recovery
```

## Reporting bugs

Open an issue with: what you did, what you expected, what happened, the
route/URL, browser + version, and whether the provider involved was reachable.
Check `/health` (the in-app API health center) first — a failing provider is
usually the answer, and the UI should already be telling you so honestly.
