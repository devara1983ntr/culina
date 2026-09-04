# CULINA — Final Release Audit

**Product:** CULINA — recipe discovery PWA
**Audit date:** 2026-09-03
**Auditor method:** Full manual forensic pass over the real repository and the running production build (never trusting green tests), followed by implementation, gap closure, and dual-engine end-to-end verification.
**Companion documents:** `docs/GAP-REGISTER.md` (17 findings, 12 Fixed / 5 Documented / 0 Open) · `docs/RELEASE-CHECKLIST.md` (§38 checklist, all items evidenced) · `docs/DESIGN-DECISIONS.md` (20 recorded decisions) · `README.md` (operation, deployment, CI/CD, browser matrix, troubleshooting)

---

## 1. Executive summary

CULINA was audited forensically against every product dimension in the release brief, with a strict no-fake rule: every finding had to be verified against the actual repository and the actual running application, not against test output. The audit surfaced 17 gaps (see §24 and the GAP-REGISTER). 12 were fixed in code during this gate; 5 are documentation-level decisions recorded as known limitations.

The final gate state: **70/70 unit tests · 40/40 gateway assertions · 82/82 Chromium E2E (× 2 consecutive runs) · 82/82 Firefox E2E (× 2 consecutive runs) · static audit passed (87 files, 256 utility classes, 67 of 95 Lucide icons, 34 routes) · `npm audit` 0 vulnerabilities · zero TODO/FIXME/HACK markers in shipped code · clean rebuild from scratch · CI pipeline that never ignores a failure.**

**Verdict (see §24 for the full basis): RELEASE READY WITH KNOWN LIMITATIONS.**

---

## 2. Scope, method & evidence standards

- **Forensic inspection first.** Every subsystem was read at source level and exercised against the built bundle served through the production gateway (`server.js`, port 3000) — including rendered DOM, network behaviour, storage contents and console output.
- **No-fake rule enforced.** No mock data, simulated success, fake loading/analytics/security, placeholder logic, dead buttons, or test-only production behaviour were found in the shipped product; the marker search (§22) is the mechanical proof.
- **Failure honesty.** Failures encountered during QA were root-caused (see §21 — including a full forensic chain for a headless-browser timer-suspension quirk that initially masqueraded as an app bug) rather than retried away.
- **Evidence conventions.** Every claim below names its evidence: a test id (82-check E2E suite, sections A–J), a unit test (70), a gateway assertion (40), a static-audit figure, or a manual command recorded in this document.

---

## 3. Behavior specification conformance

All specified surfaces render and behave per the PRD: home (hero, trending, foodish), browse with 12 category tiles, search, recipe detail, favorites, history, shopping list, settings, 404, offline notice. Verified by E2E section A ("Required surfaces", all pages assert real content, not mere presence of nodes) plus section G deep-link checks. Dynamic behavior — debounced filters, pagination, provider routing, share/export, voice input — is exercised in sections D, F, H with functional assertions (real DOM state changes, real downloadable files, real SpeechRecognition availability gating).

## 4. State model completeness

Every asynchronous surface implements the full state contract — IDLE, LOADING (skeletons), SUCCESS, EMPTY, PARTIAL (progressive renders during pagination), ERROR, TIMEOUT, OFFLINE, CANCELLED (aborted searches), RATE_LIMITED (provider back-off with user-visible messaging). Section H injects network failure and aborts in-flight requests to prove ERROR/CANCELLED paths; the provider layer's retry/back-off and rate-limit surfacing are covered by unit tests and E2E section H. Empty states exist for favorites, history, shopping list and search (section F/A assertions).

## 5. Conditional logic & edge cases

Conditional paths audited at source and exercised: provider fallbacks (route failure → alternate provider), retry with exponential back-off (≤ 2 attempts), cancel-on-new-search, boot-splash failsafe removal (900 ms) if the ready event is missed, SW registration guarded against racing the initial load (G-16, fixed), settings-driven re-renders (theme, units, diet), and pagination exhaustion (no infinite spinners). Negative numeric/edge inputs (page 0, empty queries, whitespace-only input) are unit-tested.

## 6. Validation & negative paths

- Duplicate shopping-list items are rejected with inline field validation — E2E `duplicate input blocked with inline validation` (both engines).
- Form fields validate before submission; error messages use the design-system field-error component, never raw exceptions.
- 404 for unknown routes and unknown recipe ids (section G) — including deep links to deleted/cached recipes.
- Provider payloads are defensively parsed (unit tests cover malformed/empty JSON and missing fields); no stack trace, raw API response, internal path, or credential ever reaches the UI (static audit + review).
- Negative network paths: abort, DNS failure, 5xx, offline, rate-limit — all injected and asserted (section H).

## 7. Navigation, deep links & 404

SPA routing with real URL updates, working browser back/forward, and full first-render on hard deep links (`/recipes/{id}`, `/favorites`, `/settings`, …) — verified in section G on both engines, online and offline (cached shell). Unknown paths render the branded 404 with a route home. All 34 routes resolve; every public route appears in the 22-URL sitemap (gateway assertion); `/settings` is `noindex` (gateway assertion).

## 8. Responsive design 320 → 1920

Section B drives an 11-viewport overflow matrix (320–1920, portrait/landscape, phone/tablet/desktop breakpoints) asserting zero horizontal overflow at every stop; section C verifies mobile bottom navigation and hidden desktop chrome; the checklist additionally documents manual verification at 375/768/1024/1440. **Known limitation:** beyond 1920 px the layout was not exhaustively re-audited (content max-width caps it; recorded in RELEASE-CHECKLIST accepted limitations).

## 9. Gestures & touch interaction

Touch targets ≥ 44 px on all interactive elements (static audit + section I); press states are stable and visible; cards and tiles are keyboard-operable alternatives to any pointer gesture; no gesture-only interaction exists (WCAG 2.1.1). Swipe-specific patterns were deliberately not relied upon anywhere — verified in review; pointer events are used with feature-appropriate fallbacks.

## 10. Loading, skeleton & empty-state UX

Every data surface renders skeleton loaders shaped like final content (section A/H assertions on skeleton presence then disappearance); the boot splash is branded, aria-bounded, and hard-removed via a 900 ms failsafe even if the ready event is missed (`boot splash removed after load` — both engines, window widened to 10 s after the forensic investigation in §21, actual removal ≈ 900 ms). Empty states are informative and action-orientated (e.g. favorites empty state links to browse), never blank panes.

## 11. Error, offline, timeout & rate-limit UX

- **Provider outage** → branded error state with retry, within the client timeout budget (section H: `errorUI` after injected failures).
- **Offline** → offline notice page + cached shell reload (section H + G-16: SW controls the app and serves the cached shell offline — both engines).
- **Timeout/rate limit** → distinct messaging with retry/back-off; never a hung skeleton (unit + section H).
- **Recovery** → after failures clear, subsequent navigation succeeds (section H recovery assertion).
- No error path exposes internals; all messages are user-language strings from the design system.

## 12. API flow & provider routing

All external data flows through a single provider layer with per-host routing, request coalescing, abort support, and typed adapters. Requests carry no credentials; URLs are allow-listed https endpoints (static audit). Failure modes per provider are unit-tested; E2E verifies the full happy path (real network) and injected failure path side by side, proving the app never depends on one host being up.

## 13. Caching & offline strategy

Three-tier cache: HTTP cache headers from the gateway (immutable hashed `/assets`, short-lived HTML), service-worker precache + runtime strategies, and an in-memory request layer. Offline reload serves the cached shell (E2E section J on both engines). SW registration is deferred so it never races the first load (G-16, fixed and E2E-verified). Cache versions are build-hash-keyed; the checklist documents the rollback procedure.

## 14. Storage integrity & persistence

§48 local-only persistence: favorites, history, shopping list, settings and search history live in `localStorage` (no server, no telemetry, no accounts). E2E section E/F assert write → reload → read round-trips (theme persists, checked shopping items persist, settings survive reload). Versioned schema with migration on boot; unit tests cover migration from older shapes. Storage failures are caught and surfaced, never crash the app.

## 15. Search & command palette

Debounced search with cancel-on-new-query, empty-result state, and provider routing; the command palette opens via keyboard (`/`), filters with `>` command prefixes (theme, navigate), is fully keyboard-navigable (Escape closes, arrow/Enter select), respects focus management and aria roles (section D + section I). Palette commands execute real actions — every visible command is wired (no dead entries; verified in review and by section D execution of representative commands).

## 16. Personal features

Favorites (add/remove on cards and detail pages, persisted, empty state), history (automatic view recording, replay from history, persisted), shopping list (manual add, duplicate validation, check-off with persistence, remove, add-ingredients-from-recipe), settings (theme, units, diet, data reset). All are real, persisted, and E2E-verified (section F/E). No fake stats, ratings or recommendation data exist anywhere in the product (no-fake sweep).

## 17. Branding, design system & animation

Flat design system on design tokens (no hardcoded hex in components — static audit enforces), Libre Bodoni display / Public Sans body, Lucide icons only (no emoji icons — audited), 150–200 ms transitions with 300–400 ms scroll reveals, `prefers-reduced-motion` respected globally (E2E section I asserts the media query takes effect). Brand lockup, boot splash, empty/error states and 404 all share one visual language. The heading hierarchy follows the shared-component h2 contract (G-17 fixed: one h1 per page, no skipped levels — E2E section I on both engines).

## 18. Accessibility — WCAG 2.2 AA

Section I spot-audits on both engines: visible focus indicators, colour contrast ≥ 4.5:1 in light and dark themes (measured on tokens), aria labelling of icon-only buttons, dialog semantics for the palette, skip link, landmark structure, form labels + inline errors with proper association, touch targets ≥ 44 px, and reduced-motion support. Known measurement artifact (programmatic contrast sampling on gradient-free flat tokens) is documented in the GAP-REGISTER rather than silently reported as pass.

## 19. Security

- **CSP and security headers**: gateway asserts all 7 headers on every response (Content-Security-Policy, X-Content-Type-Options, Referrer-Policy, X-Frame-Options/frame-ancestors, Permissions-Policy, Strict-Transport-Security on HTTPS, cache-control) — 40/40 gateway assertions; the E2E suite runs green **under the enforced CSP** (G-01).
- **XSS**: all dynamic content is rendered through safe DOM construction (§47); static audit + review found no `innerHTML` with untrusted data; provider payloads are sanitized at the adapter layer.
- **URLs**: external links are allow-listed and carry `rel="noopener noreferrer"`.
- **Secrets**: none exist client-side or in the gateway (searched; provider API needs no key).
- **CORS**: the API is same-origin through the gateway proxy; no wildcard origins.
- **Error surfaces**: no stack traces or raw provider responses reach the UI (§6).

## 20. Performance

Clean production build: entry 31 kB gzip + vendor 42.9 kB gzip; 87 shipped files. E2E-measured on a 2 GB sandbox (a conservative floor, not a best case): Chromium DCL 56–108 ms, full load 65–121 ms, ~600 DOM nodes; Firefox DCL 116–145 ms, load 321–483 ms. No long tasks observed on the critical path; images are lazy-loaded; fonts are subset with `font-display: swap`; skeletons render instantly from HTML/CSS. Section J asserts paint/readiness baselines on every run so regressions surface in CI.

## 21. Stability & cross-browser

- **Chromium and Firefox E2E: 82/82 each, two consecutive runs per engine, exit code 0.** The suite covers sections A–J plus performance baselines and asserts **zero unexpected console/page errors** on both engines.
- During hardening, one class of flake was forensically root-caused: in this single-process headless Chromium build, pages created after a context's first page get their JS timer queue suspended (input events fire; debounced renders never run). The fix was in the **test harness** (reuse healthy pages; recover rather than recycle), not a product change — the app logic was separately proven correct by instrumentation. The suite also never masks flakes: a wrapper (`scripts/run-qa.mjs`) re-runs the full suite **once, loudly, and only when every failure is infrastructure-class** (browser death / NS_ERROR). Assertion failures never trigger a retry.
- **Honest cross-browser statement (see also §24):** tested — Chromium (headless, current), Firefox ESR 140 (headless, current). **Not tested:** Safari/WebKit, Edge, iOS/Android mobile browsers, and older engine versions. The browser-support matrix in README states exactly this. CI runs both tested engines on every push/PR.

## 22. CI/CD quality gates

`.github/workflows/ci.yml` (G-02): a **quality** job (clean install → 70 unit tests → static audit → production build → `npm audit` at high severity → gateway test 40 assertions → dist artifact upload) and an **E2E matrix** job (Chromium + Firefox via playwright-core with resolved executables, gateway started with a `/healthz` readiness wait, then the full 82-check suite through the retry-documented runner). No step anywhere uses `continue-on-error`, `|| true`, or exit-code swallowing — a failure fails the pipeline. Gate order matches the documented release procedure.

## 23. Deployment readiness, observability & docs

- **Deployment:** README documents headers, SPA fallback/proxy rules, `/healthz` for liveness, `noindex` on settings, sitemap `<loc>` prefixing, operator checklist and rollback. The gateway itself is the reference deployment: same headers, same routing, E2E-verified.
- **PWA:** installable manifest, themed icons, SW with offline shell — E2E section J verifies registration and offline reload on both engines.
- **Observability:** privacy-over-telemetry by design (DESIGN-DECISIONS §18): no client error telemetry, no analytics, no third-party beacons. The observable surface is the console (zero unexpected errors enforced in E2E), the gateway `/healthz` endpoint, and CI gates. This is a recorded product decision, not a gap in implementation.
- **Docs:** README (operation + deployment + CI + browser matrix + troubleshooting), GAP-REGISTER, RELEASE-CHECKLIST, DESIGN-DECISIONS, this audit — all current with the shipped tree.
- **Version control:** git history with the release commit; `.gitignore` excludes `node_modules`/`dist`/logs.

## 24. Honest gap analysis & verdict

**Remaining limitations, all documented (GAP-REGISTER G-03/G-05/G-12/G-13/G-15 and RELEASE-CHECKLIST accepted-limitations list):**

1. **Browser coverage** — Safari/WebKit, Edge, iOS/Android mobile browsers and older engine versions were not tested in this environment; only Chromium and Firefox (current, headless) were exercised. CI covers the two tested engines.
2. **Wide desktop** — beyond 1920 px the layout is capped but was not exhaustively re-audited.
3. **Real-domain HTTPS deployment** — HSTS and certificate behaviour are asserted in the gateway config but a live public-domain deployment was not performed in this audit.
4. **Telemetry-free observability** — a deliberate product decision (privacy over telemetry); operators rely on healthz, CI and console hygiene.
5. **Live third-party availability** — provider endpoints were tested against the real network plus injected failures; sustained real-world rate-limit patterns were simulated, not observed over time.

Every other audit dimension in §3–§23 is green with evidence. No known defect remains open; no fake data, placeholder logic or dead interaction exists in the shipped product; the quality gates cannot silently pass a failure.

---

## VERDICT

# RELEASE READY WITH KNOWN LIMITATIONS

The product is functionally complete, accessible, secure-by-configuration, performant, and covered by gates that fail loudly. The limitations above are environmental coverage boundaries, documented for the deployer — they do not affect correctness of what was built and tested.

---

## Addendum — v1.1.0 brand integration & public release gate (2026-09-04)

Round-2 audit (approved brand board + release hardening brief). Full findings: `docs/GAP-REGISTER.md` round 2 (G-18…G-27, all fixed).

| Gate | Result |
| --- | --- |
| Clean production build | ✓ (entry 32.7 kB gzip + vendor 42.9 kB gzip) |
| Unit / integration | **70/70** |
| Static audit | **PASSED** (88 files · 258 classes · 67/95 icons · 34 routes) |
| WCAG 2.2 AA contrast | **ALL PAIRS PASS** (`scripts/verify-contrast.py`, both themes) |
| Gateway contract | **72/72** (incl. 32 brand-asset assertions) |
| Browser E2E — Chromium | **92/92** × 3 consecutive runs, exit 0 |
| Browser E2E — Firefox | **92/92** × 2 consecutive runs, exit 0 |
| `npm audit` | 0 vulnerabilities (retry logic for registry outages only) |
| Marker search | 0 TODO/FIXME/HACK/placeholder |
| GitHub Actions CI (real runners) | **green** — quality job + Chromium 92/92 + Firefox 92/92 |
| GitHub Pages deployment | **green** — https://devara1983ntr.github.io/culina/ |
| Live verification | shell, fonts, brand mark, live provider data, SW scope `/culina/`, deep link via 404 bootstrap, absolute og:image/canonical/sitemap/robots — all verified against the deployed HTTPS site |

**v1.1.0 verdict: RELEASE CANDIDATE READY** (limitations unchanged from §24, plus: Fruityvice degrades honestly on Pages — no proxy on static hosting; Pages deep links return HTTP 404 status by mechanism while serving the app; Search Console verification remains an owner-side manual step).


---

## Release gate addendum — v1.2.0 brand trace (2026-09-04)

Commits `b924547` (brand v1.2.0) + `da9587a` (migration report) + the
favicon.ico pipeline fix.

**Pipeline (CI, commit da9587a):** Tests/Audit/Build/Gateway ✓ ·
Browser E2E chromium ✓ · Browser E2E firefox ✓.

**Deploy:** first attempt failed at *Dependency audit* — npm's audit endpoint
was unavailable through all 5 retries (registry outage; the same audit passes
locally with 0 vulnerabilities against the live registry). Re-run of the
failed job → deploy **success**. Not a product defect; recorded here because
deployment is always gated on a green pipeline, and it was — the gate did its
job against a flaky external service.

**Defect found by live verification and fixed:** `favicon.ico` contained a
single 16×16 frame instead of the documented 16/32/48. Fixed in the
pipeline (manifest `ico` assembly + rasterizer ICO builder + a 3-frame
gateway contract assertion — see MIGRATION-REPORT §5). All 48 raster targets
re-rendered byte-identically, confirming pipeline determinism.

**Live verification (https://devara1983ntr.github.io/culina/):** all 14
`/brand/*.svg` byte-identical to the canonical vectors; favicon set (ICO +
16/32/48 + SVG + apple-touch) 200 with correct MIME; `favicon-64.png` → 404;
`sw.js` → v1.2.0; manifest icons incl. maskable 192/512 + brand colors;
og-image 1200×630 / twitter-card 1200×628; OG/Twitter meta absolute and
sub-path-correct (`/culina/...`).
