# CULINA — Release Checklist

Evidence references: `docs/FINAL-RELEASE-AUDIT.md`, `docs/GAP-REGISTER.md`, CI logs.

## Product

- [x] Every intended feature works — 34 routes verified live (E2E section A, both engines)
- [x] No fake functionality — repo-wide marker sweep clean (38 matches, all legitimate: input `placeholder` attrs, honest-copy comments, the real "BaconMockup" API name)
- [x] No unfinished functionality — no TODO/FIXME/HACK/dead branches; the single `innerHTML` sink in `dom.js` has zero call sites
- [x] No dead buttons — voice search is real (feature-detected), share has clipboard fallback, every action bar button wired and E2E-exercised
- [x] No dead routes — 34 routes ↔ 34 loaders, all static internal links resolve (static audit)

## UX

- [x] Complete navigation — header, drawer, bottom nav (mobile), footer, breadcrumbs-by-context, 404 view
- [x] Complete interaction behavior — every async surface has loading/empty/error/offline states (E2E sections A/H/J)
- [x] Loading states — skeletons per surface, first-paint boot skeleton, button spinner in palette
- [x] Empty states — favorites/history/planner/shopping-list/kitchen/no-results all explain themselves with next actions
- [x] Error states — friendly copy for all 9 error types; provider failures degrade per-section
- [x] Offline states — offline detection toast, `/offline` route, SW-cached shell on hard reload, honest stale-data fallback with TTL
- [x] Validation — input limits, clean text, quantity parsing, duplicate/case/diacritic-insensitive checks (22 expansion unit tests + inline field errors)
- [x] Recovery — retry buttons, provider recovery after outage (E2E), online restore

## Responsive

- [x] Mobile 320–430 px — no horizontal overflow (7-viewport × 6-page matrix, both engines)
- [x] Tablet 768–1024 px — verified in matrix
- [x] Desktop 1280–1440+ — verified in matrix
- [ ] Wide desktop >1920 px — not separately audited (max-width containers cap line lengths; low risk)

## Accessibility

- [x] Keyboard — skip link first-Tab, focus ring visible, dialogs focus-trapped via native `<dialog>`, Escape handlers
- [x] Screen-reader semantics — landmarks, one `h1` + no skipped levels (E2E-enforced), aria-current nav, aria-hidden decorative icons
- [x] Focus management — focus restored after dialogs/drawers; route changes move focus to `main`
- [x] Contrast — spot-checks ≥ 4.5:1 light + dark (composited backgrounds, both engines)
- [x] Reduced motion — honored centrally in `motion.js` + CSS
- [x] Touch targets — bottom nav ≥ 44×44 px (measured)

## Security

- [x] No exposed secrets — sweep clean; proxied provider is keyless by design
- [x] Safe DOM rendering — text-node-only insertion; `safeUrl()` protocol allowlist; no `eval`/`new Function`/`document.write`
- [x] Safe URLs — all external links `rel="noopener noreferrer"`
- [x] API security — gateway proxy path regex allowlist, GET-only, method guard 405, upstream timeout
- [x] Storage security — versioned keys, corruption-safe reads, quota degradation, no PII leaves device
- [x] Security headers — CSP (hashed inline script), nosniff, DENY, Referrer-Policy, Permissions-Policy, COOP, HSTS-on-HTTPS (40 gateway assertions)

## Performance

- [x] Build optimized — 31 kB gzip entry + 42 kB vendor; code-split routes
- [x] Images — lazy loading, async decoding, no-referrer, monogram fallback
- [x] Requests controlled — 9 s timeout, in-flight dedupe, GET-only retry with backoff, route-change aborts
- [x] No obvious memory leaks — route cleanups run per navigation (E2E long-run stable)
- [x] Baseline measured — DCL ~110–145 ms, load ~120–420 ms, ~620 DOM nodes (both engines)

## Reliability

- [x] API failures/timeout/rate-limits/malformed — handled with typed errors + honest UI (unit + E2E injection)
- [x] Offline handled — toast, cached shell, TTL data fallback, recovery
- [x] Cache validated — 3 layers documented; injection tests isolate from all of them
- [x] Storage corruption handled — JSON.parse guards + memory fallback (unit-tested)

## Testing

- [x] Unit tests — 70/70
- [x] Static audit — imports/CSS/icons-including-registry/routes/links: PASSED
- [x] Gateway tests — 40/40
- [x] E2E — 82/82 Chromium, 82/82 Firefox
- [x] Negative-path testing — invalid input, malformed JSON, provider outage, offline reload, duplicates, rapid actions (SPA token guard)
- [x] Browser testing — Chromium + Firefox (see browser-support matrix for untested targets)
- [x] Accessibility testing — E2E section I
- [x] Production smoke test — gateway serves shell + CSP + healthz (CI post-run step)

## Deployment

- [x] Production build — clean, reproducible
- [x] CI/CD green path defined — GitHub Actions quality + dual-engine E2E matrix
- [x] Deployment configuration — zero-dependency gateway, $PORT, /healthz
- [x] Routing — SPA fallback verified; asset 404s correct
- [x] PWA — manifest complete, SW strategies verified incl. offline reload
- [x] Monitoring — /healthz (operator-side uptime check)
- [x] Rollback — immutable hashed assets; redeploy previous dist/
- [ ] Real-domain HTTPS deployment — outside this environment (documented for the operator)

## Known limitations (accepted for release)

1. Safari/iOS/Edge/Android-device browsers not tested (matrix documented).
2. Sitemap ships origin-relative `<loc>` — operator prefixes at deploy.
3. Two `window.confirm()` destructive-action dialogs (native, accessible; kept deliberately).
4. No client telemetry by privacy design — field errors invisible to operators.
