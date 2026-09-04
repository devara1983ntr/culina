# CULINA — Design Decisions

Rationale for the consequential choices, in the order a reader usually asks about them. References are to the master PRD sections where applicable.

## 1. No framework — vanilla ES modules + Vite

**Decision:** HTML5/CSS3/modern JS (ES2022), ES modules, Vite for bundling/code-splitting. Zero runtime framework.

**Why:** The PRD explicitly forbids React/Vue/Angular "merely for convenience". CULINA's UI is page-oriented with modest shared state — a hand-rolled router (~80 lines), a 30-line subscribe/set store, and DOM helpers (`el()`, `icon()`) cover everything a framework would provide here, without a virtual DOM, hydration or framework churn. Each route lazy-loads as its own chunk (see `dist/assets/` — 21 page chunks), keeping the entry bundle small.

**Trade-off accepted:** no declarative reactivity. Mitigated by structuring pages as `render → await → renderInto` pipelines and versioned store signals (`favoritesVersion`, `plannerVersion`) for cross-page reactivity (header badge, planner re-render).

## 2. Libraries: motion, lucide, sortablejs — nothing else

- **motion** (Framer Motion's vanilla engine) — `revealGrid` scroll reveals, per the user's explicit instruction to use Framer Motion; the vanilla package avoids a React dependency.
- **lucide** — iconography (the design system's "no emoji as icons" rule); verified: all 49 used names exist in the installed version.
- **sortablejs** — planner drag & drop. Every drag affordance has a button alternative (remove/duplicate), so the feature is not pointer-only.

## 3. Design system: generated, then honored

The UI/UX Pro Max skill generated a design system (`design-system/culina/MASTER.md`): **Flat Design**, light+dark, **Libre Bodoni / Public Sans**, "no gradients/shadows, simple hover, 150–200 ms transitions", scroll-reveal 300–400 ms `power1.out`, semantic color tokens (`--color-primary`, `--color-on-primary`, …). Every stylesheet is token-driven (no hardcoded hex outside token definitions), spacing follows the 4/8 rhythm with section tiers 16/24/32/48, and the checklist (contrast ≥ 4.5:1 in both themes, ≥ 44 px targets, visible focus, reduced-motion, 375/768/1024/1440 breakpoints) is encoded in `css/responsive.css` and `css/utilities.css`.

## 4. Provider architecture: registry + adapters + pure normalizers

- **The UI never sees provider fields** (`strMeal`, `nutritions.calories`, …). Normalizers are pure functions producing unified models with `source`/`sourceId` composite ids (`mealdb:52772`).
- **Unknown → `null`, never `0`.** A missing fiber value is absent, not zero — this is asserted in tests for every normalizer.
- **Adding a provider = 1 registry entry + 1 adapter + 1 normalizer.** The adapter map in `adapters/index.js` is static (dynamic `import(template)` breaks Vite analysis — an early dead end documented in tests/notes).
- **Adapters own their quirks** (MealDB ingredient columns, OFF 503 retries, SampleAPIs' `image: "no"`, OBD's missing `/random`), so quirks never leak into pages.

## 5. Central API client: one code path for every request

`apiRequest()` gives every provider: TTL cache → in-flight dedupe → timeout (AbortController, composable with navigation aborts) → retry with backoff (GET only; 429/5xx retryable, 404/401 never) → JSON validation → health telemetry → normalized `ApiError`s with stable types.

**Bugs the test suite caught here** (worth remembering):
1. `ErrorType.HTTP_ERROR` (nonexistent key) instead of `ErrorType.HTTP` — every HTTP error silently collapsed to `UNKNOWN_ERROR`.
2. The catch block re-wrapped already-normalized errors through `normalizeError`, losing the type (and double-recording telemetry).
Both are now regression-tested.

## 6. Gateway for CORS-restricted providers only

Fruityvice serves no ACAO header. Rather than dropping the provider, CULINA routes it through a same-origin, strictly-allowlisted reverse proxy (`/api/fruityvice/api/fruit/(all|\d+)`) implemented twice: vite dev/preview proxy and the zero-dependency production `server.js`. This is also the pattern a key-requiring provider would use (secrets server-side only) — demonstrated without any actual secrets, since no key-requiring provider is enabled.

## 7. Search: allSettled + deterministic scoring

`unifiedSearch` fans out to 7 providers with `Promise.allSettled`; failures are collected with labels and surfaced as a partial-failure notice while successful groups render. Scoring is documented and deterministic (exact 100 / starts-with 60 / contains 35 / token +8; image +3 and description +1 only for textually relevant items), ties break alphabetically — no "provider quality" bias. AbortErrors from navigation are not failures.

## 8. Local-first persistence

Favorites, planner, theme and health telemetry are versioned (`culina:v1:*`) in `localStorage` with migration support and an in-memory fallback (private mode). No accounts, no sync, no server-side state. This shaped the whole UX: the favorites page works offline from envelopes (title/image/route stored at save time — no re-fetch needed), and the planner's shopping list re-hydrates recipes on demand.

## 9. Shopping-list merging: conservative math

Quantities merge only when the normalized ingredient name matches **and** units are identical or simple plural forms ("1 cup" + "2 cups" → "3 cups"). Mismatched units (tbsp + g) and partially unspecified quantities are reported honestly ("Quantity varies by recipe", "3 cloves+ (some recipes unspecified)") — never silently summed.

## 10. Kitchen match states exact overlap

"What can I cook?" ranks recipes by how many of *your* ingredients each uses and badges every card with `n/m match`. The UI states explicitly that recipes may require additional items — the match count is a floor, not a completeness claim.

## 11. PWA & offline strategy

Service worker: network-first navigations (cached page → cached shell → `offline.html`), immutable cache for `/assets/*`, stale-while-revalidate for other same-origin files, and a **10-minute TTL, 120-entry-capped** cache for provider data (food data changes; it is never cached forever). Registration only in production over https/localhost. Offline support is honest: live data pages degrade to clear states, not stale lies.

## 12. Honesty as a UI principle

- Every result carries a source badge; detail pages include a full source panel (license, rate limit, attribution).
- The beer page explains the SampleAPIs fallback and exactly which fields the source cannot provide.
- The health page shows all 28 providers — including the 20 that are *not* enabled, with reasons.
- About lists verified-but-disabled providers publicly.

This is the direct implementation of the PRD's "never fabricate data / never claim an API works unverified" rules, extended from data to UI copy.

## 13. Testing strategy

`node:test` (zero extra dev dependencies): normalizer fixtures captured from real responses; client behavior via mocked `fetch` (timeout uses a real abortable promise); services via injected implementations (`unifiedSearch`) and a `localStorage` mock. A separate optional browser E2E script covers what unit tests can't (routing, overlays, live providers, layout). The storage test helper (`tests/helpers/setup-storage.js`) exists because `health.js` restores telemetry during module evaluation — a subtle ESM import-order lesson worth keeping documented.

## 14. First-paint boot skeleton

The boot splash used to dismiss only after `boot()` resolved — which waits for the first route's *provider data*. A slow or hung provider meant seconds of logo-only screen. Now `renderRoute()` attaches a generic skeleton grid on the very first navigation and dispatches `culina:app-ready`; `main.js` dismisses the splash on that event (with `boot()` completion as an idempotent backstop). Users see the shell + skeleton within milliseconds; slow providers then resolve into content or an honest error state — never a frozen splash.

## 15. Provider-qualified detail ids

Detail links use `provider:sourceId` refs (`/recipe/mealdb:52772`). Providers only understand the `sourceId` half, so `recipe.js`/`cocktail.js` strip the prefix before calling the adapter (`lookup.php?i=mealdb:52772` → `Invalid ID` — caught by E2E deep-link tests). Beer detail resolves by scanning fetched lists (its API has no lookup endpoint), which is why it never had this bug.

## 16. Touch-gesture scope: swipe on shopping list only

Swipe-to-delete is implemented on shopping-list rows. Planner items deliberately do **not** get swipe: they use SortableJS drag & drop (touch-drag), and a horizontal swipe gesture on the same element would conflict with drag initiation. One gesture per surface — the planner already has explicit remove/duplicate buttons as the non-drag alternative.

## 17. Icon registry is part of the build contract

`js/utils/icons.js` holds a tree-shaken lucide subset; `refreshIcons()` silently skips any `data-lucide` name not in that set (console warning only). The static audit therefore checks two things: the name exists in lucide **and** it is registered in the set. This caught 13 used-but-unregistered icons (sun-moon, house, mic, palette, …) that rendered as invisible gaps.

## 18. Observability: privacy over telemetry

CULINA ships **no client-side error or performance telemetry**. This is deliberate, not an omission: the product promise is that nothing leaves the device (PRD §48), and any third-party analytics beacon would break it. The operational signal is layered instead: `/healthz` for uptime, the in-app provider health center (per-provider latency/success telemetry kept locally), and DEV-gated console diagnostics in the API client that vanish in production. Field-error visibility is traded away consciously; operators watch the gateway and provider status.

## 19. Heading-level contract

Shared content components own their heading level: **card titles, hub tiles, state-block titles, footer column titles and the surprise stage are all `h2`**. Rationale: these appear directly under a page's `h1` on listing pages, and a page-level `h3` would skip an outline level (WCAG heading navigation). `sectionHead` remains `h2` and deeper structures (`h3` facts, list items) stay below. The E2E accessibility section enforces "one `h1`, no skipped levels" across representative routes on both browser engines — a regression here fails CI.

## 20. Service-worker registration must not race `load`

Registration originally attached a `window.addEventListener('load', …)` from inside `boot().then()`. On a fast load with slow provider data, `load` fires first and the listener is never called — silently losing offline support for that visit. The registration now lives at module scope with a `document.readyState === 'complete'` guard. The bug was invisible until the E2E suite ran with raster images blocked (fast `load`) and found zero registrations; it is exactly the kind of race the QA environment should be tuned to expose.


## 21. The approved brand board is the visual source of truth (v1.1.0)

The product's first identity ("open-ring plate", espresso/ember palette, Libre Bodoni + Public Sans) was a placeholder system generated before the approved brand board existed. As of 1.1.0 the board (`docs/brand/culina-brand-board.png`) supersedes it:

- **Palette mapping.** Brand primitives (Ember Gold `#FFB703`, Spicy Orange `#FB5607`, Fresh Green `#2ECC71`, Deep Crimson `#E63946`, Midnight `#0B0F19`, Cream `#FFF7E6`) map to the existing semantic token names, values only — components were untouched. The **dark theme carries the board's vivid hues directly** (all AA on Midnight), while the **light theme uses deepened shades of the same hues** (deep orange `#C2410C`, deep green `#1E7A45`, deep gold `#8A6400`, deep crimson `#B3241E`) because the vivid values cannot pass 4.5:1 as text on Cream. Every critical pairing is computed and asserted by `scripts/verify-contrast.py` (17.96:1 body text, 4.86–6.18:1 semantic text, 10.97:1 gold-on-Midnight buttons, 5.09/9.83:1 focus indicators).
- **Borders are decorative separators** (subtle by intent, ~1.5–1.9:1); WCAG 1.4.11 state information is carried by the ≥3:1 focus ring, labels and text — the same interpretation the shipped accessibility audits used.
- **Typography.** Playfair Display (display) + Inter (UI/body) via Fontsource, same weights as before (400/500/600/700 + display italic; Inter 300–700).
- **The mark is generated, never hand-copied.** One geometry source (`scripts/generate-brand-assets.py`) emits the SVG assets, the favicon/PWA/social rasters (via `scripts/rasterize-brand.mjs`) and `js/components/mark-tile.js` (the in-app module). The gateway test asserts the mirrors are byte-identical, so drift is structurally impossible.
- **The mark always sits on its Midnight tile.** Cream/gold/green/crimson elements of the mark are invisible on a Cream ground, so the tiled form is the only in-app variant — matching how the board itself presents the mark.
- **Tagline usage.** `TASTE • DISCOVER • PLAN • ENJOY` (board tagline) appears in the footer, About page and lockup assets; `Discover food. Understand it. Make it yours.` remains the product descriptor (title/OG/README).
- **Honest limitation:** the emblem is reconstructed from the board's written specification and a programmatic palette/layout analysis of the image (this environment has no human visual review of the board); it is a faithful rendering of the specified elements, not a pixel trace. The geometry is generated code in the repository, so any fine-tuning is a one-file change.

### §22 — Brand assets are traced, not redrawn (v1.2.0)

The v1.1.0 mark was generated from the *written* brand specification. v1.2.0
replaces it with geometry **measured from the approved board artwork**:
forensics (`docs/brand/BOARD-FORENSICS.md`) located the emblem (Panel A
badge), the monogram (Panel B badge) and the tagline, and proved the earlier
source-region assumption wrong. The monogram is contour-traced (IoU 0.97
against its source mask); the emblem is quantized into 16 traced color
layers (union IoU 0.92); painted/photorealistic shading is preserved as
LANCZOS raster masters (the spec's high-res-raster branch). The board has no
CULINA lettering and its painted tagline matches no real typeface (measured),
so wordmark typography uses Playfair Display Italic outlines — a documented
derivation, not a claimed trace. The full inventory, fidelity numbers, safe
areas and minimum sizes live in `docs/BRAND-ASSET-MANIFEST.md`.
