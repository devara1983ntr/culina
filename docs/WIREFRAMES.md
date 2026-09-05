# CULINA — Wireframes, Site Flow & Navigation Map (v1.4.0)

> Complete structural reference: sitemap → navigation system → per-screen
> wireframes → core user flows → state matrix. Matches the shipped DOM
> (audited 5 September 2026). ASCII frames are structural, not to scale.

---

## 1. Sitemap (34 routes)

```
/ ── Home
├── /discover ─────────────── Discovery engine (6 entity tabs × filters)
├── /search?q= ────────────── Unified search results (7 providers)
│
├── FOOD WORLD
│   ├── /recipes ──────────── Recipe index (A–Z, category, cuisine)
│   │   └── /recipe/:id ───── Recipe detail (ingredients, steps, related)
│   ├── /categories ───────── MealDB category index → /recipes?category=
│   ├── /cuisines ─────────── MealDB area index → /recipes?cuisine=
│   ├── /ingredients ──────── Pantry index ⇄ Fruits & nutrition (2 tabs)
│   │   └── /ingredient/:source/:id ── Ingredient / fruit detail
│   ├── /nutrition ────────── Nutrition explorer (fruits + products)
│   ├── /products ─────────── Open Food Facts search (+ barcode)
│   │   └── /product/:source/:id ──── Product detail (Nutri-Score/NOVA)
│   └── /kitchen ──────────── "What can I cook?" overlap ranking
│
├── DRINKS WORLD
│   ├── /drinks ───────────── Hub → 4 tiles + live teaser
│   ├── /cocktails ────────── Cocktail index (A–Z, glass, category)
│   │   └── /cocktail/:id ─── Cocktail detail (measures, glassware)
│   ├── /beer?style= ──────── Ales ⇄ Stouts
│   │   └── /beer/:style/:id ─ Beer detail
│   ├── /breweries ────────── Brewery search (country/type filters)
│   │   └── /brewery/:name ── Brewery detail (+ nearby)
│   └── /coffee?tab= ──────── Hot ⇄ Iced brewing guides
│
├── PERSONAL (local-first, noindex)
│   ├── /planner ──────────── Week grid (7 days × 4 meals, drag & drop)
│   ├── /shopping-list ────── Merged + manual items (swipe-to-remove)
│   ├── /favorites?tab= ───── 7 collections (grid/list, sort, swipe)
│   ├── /history ──────────── Recent searches + views (swipe-to-remove)
│   └── /settings ─────────── Theme, text size, history, export/import/reset
│
├── TRUST
│   ├── /health ───────────── API Health Center (28 providers)
│   ├── /about ────────────── Mission, providers, attribution, credit
│   ├── /privacy · /terms · /accessibility ── Policy docs
│   └── /offline ──────────── SW offline fallback
│
├── /food · /food/:source/:id ── Foodish imagery gallery (novelty)
└── (unmatched) ───────────── 404 empty-state → Home CTA
```

## 2. Navigation system (five layers, all synchronized)

| Layer | Viewport | Contents | Sync mechanism |
| --- | --- | --- | --- |
| **Header** | ≥769 px | Brand · Discover · Recipes · Ingredients · Drinks ▾ (Cocktails/Beer/Breweries/Coffee) · Planner · Search trigger (⌘K) · Theme cycler · Favorites + live badge · | `updateActiveNav(path)` maps detail routes to their world (`/recipe/*`→Recipes, all drinks→Drinks); `aria-current="page"` |
| **Drawer** | <769 px (menu button) | Explore (primary, incl. drinks children) + More (11 secondary) + theme + version | Same `data-nav-link` sync |
| **Bottom nav** | ≤768 px | Home · Discover · Search (opens overlay) · Planner · Saved | `updateBottomNav(path)` with "world" lighting (Discover stays active across all content routes) |
| **Command palette** | all (⌘K / Ctrl+K / `/`) | 12 commands + live grouped search + recents + suggestions | Overlay; Enter/arrow/Escape keyboard-complete |
| **Footer** | all | Explore (6) · Product (5) · live provider attribution · legal · credit line | Static links (intercepted → SPA nav) |

**URL-state contract:** every filter/tab/page state is reflected in the query
string via `replaceUrl()` (base-path safe, no history spam) → every view is
shareable and back-button-stable. Deep links: `/kitchen?add=Chicken`,
`/discover?entity=recipes&category=Starter`, `/favorites?tab=beers`,
`/search?q=…`.

## 3. Global chrome (all screens)

```
┌─────────────────────────────────────────────────────────────┐
│▓▓▓▓▓▓▓▓▓ scroll-progress (2px, ember→orange, scaleX) ▓▓▓▓▓▓│ ← v1.4
│ [🍳 CULINA]  Discover Recipes Ingredients Drinks▾ Planner   │
│                          [🔍 Search food, drinks… ⌘K] [☀] [♥ⁿ]│
├─────────────────────────────────────────────────────────────┤
│                          #main                               │
│                    (route content ↓)                         │
│                                                     (▲)      │ ← back-to-top
├─────────────────────────────────────────────────────────────┤   after 600px
│ footer: brand · Explore · Product · Data sources · © 2026    │
│         CULINA · v1.4.0 · Designed & developed by Roshan     │
├─────────────────────────────────────────────────────────────┤
│ mobile: [🏠 Home][🧭 Discover][🔍][📅 Planner][♥ Saved]      │ ← safe-area
└─────────────────────────────────────────────────────────────┘
 Overlays: toast-root (≤3, swipe-away) · dialog-root (modals,
 drawer, search palette, lightbox, quick-actions sheet)
 Boot: splash (mark + CULINA) → dismissed on first skeleton
 Pull-to-refresh: top-center glass pill, ring spins while working ← v1.4
```

## 4. Screen wireframes

### 4.1 Home `/`
```
┌ HERO ────────────────────────────┬──────────────────────────┐
│ ✦ THE FOOD INTELLIGENCE PLATFORM │  ┌────────────────────┐  │
│ Discover something delicious.    │  │  foodish photo      │  │
│ Search once across recipes, …    │  │  (eager, error→     │  │
│ [🔍 Search recipes, ingredients…🎙]│  │   caption fallback) │  │
│ (✦Surprise me)(👨‍🍳Kitchen)(🕐Quick) │  └────────────────────┘  │
└──────────────────────────────────┴──────────────────────────┘
 TODAY'S INSPIRATION            ← skeleton → featured card
┌──────────────┬───────────────────────┐   (photo → lightbox ✦1.4)
│  featured    │ ✦ TODAY'S INSPIRATION │
│  media       │ Recipe Title          │
│              │ [cuisine][category]   │
│              │ [View recipe →][♥][📅]│
└──────────────┴───────────────────────┘
 TRENDING DISCOVERIES      [Recipes|Cocktails|Beers] ⇄ swipe ✦1.4
┌────┐┌────┐┌────┐┌────┐   ← 4–8 cards, staggered reveal
 DISCOVER-ISH band: "What can I make right now?" [Open kitchen →]
 RECENTLY VIEWED (≤6 cards | hidden when empty)
 EXPLORE BY CATEGORY — 8 tiles (glow hover)
 QUICK DISCOVERY — 5 actions (Surprise/Kitchen/Quick bites/…)
 POWERED BY VERIFIED OPEN DATA — live status strip
```

### 4.2 List/explorer template — `/recipes` `/cocktails` `/products` `/breweries` `/ingredients` `/favorites` `/discover`
```
 overline · H1 · lead
 [A–Z letter chips | filters: chipRow + selects + switch + search]
 [grid ⇄ list toggle]                    "N results"
┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐
│ img♥ │ │ img♥ │ │ img♥ │ │ img♥ │   card = media(→detail)
│ Title│ │ Title│ │ Title│ │ Title│        + meta (entity-specific)
│ meta │ │ meta │ │ meta │ │ meta │        + provider badge
│[badge]│ └──────┘ └──────┘ └──────┘        + ♥ favorite
└──────┘                                 long-press → quick actions ✦1.4
 [Load more] / [1 2 3 … pager]           swipe ⇄ tabs where tabbed ✦1.4
 states: skeletonGrid → data | emptyState(CTA) | errorState(retry)
         | partialFailureNotice + partial data
```

### 4.3 Detail template — `/recipe/:id` `/cocktail/:id` `/beer/:style/:id` `/product/:source/:id` `/ingredient/:source/:id` `/brewery/:name`
```
 [← Back to results]
┌───────────────┬────────────────────────────────┐
│ hero media    │ overline (provider)             │
│ (tap → light- │ H1 Title                        │
│  box ✦1.4)    │ [badges: cuisine/category/…]    │
│               │ [♥ Save] [📅 Plan] [↗ Source]   │
├───────────────┴────────────────────────────────┤
│ INGREDIENTS (name + measure · checkable)        │
│ INSTRUCTIONS (parsed steps, ordered list)       │
│ NUTRITION panel (only real fields; else absent) │
│ SOURCE panel (provider docs + attribution)      │
│ RELATED grid (same provider)                    │
└─────────────────────────────────────────────────┘
 recipe: sticky bottom bar [♥][📅 Add to plan][View source]
 states: skeletonDetail → data | emptyState(404 copy) | errorState
 JSON-LD emitted · history.recordView() · scroll-progress ✦1.4
```

### 4.4 Kitchen match `/kitchen`
```
 H1 "What can I cook?" · lead
 [＋ ingredient input (validated, dedup)] [chips: suggestions]
 Your kitchen: [Chicken ✕][Rice ✕][Eggs ✕]  (N items) [Clear]
 ── ranked results ─────────────────────────────
 ┌ card: "Uses 5 of your 7 ingredients" (exact counts) ┐
 match bar ▓▓▓▓▓░░ + missing-ingredient list per card
 empty: "Add at least one ingredient" · error: retry
```

### 4.5 Planner `/planner` + Shopping list `/shopping-list`
```
 "N dishes planned this week" [🧺 Shopping list][🗑 Clear week]
 ┌Mon─┐┌Tue─┐┌Wed─┐┌Thu─┐┌Fri─┐┌Sat─┐┌Sun─┐
 │B: ⠿ item ✕ ⧉ │  … per meal slot (max 6)   │  drag & drop
 │L: ⠿ —empty—  │  (SortableJS + buttons)    │  (touch+mouse)
 │D: …          │                            │
 │S: …          │                            │
 empty week → emptyState("Build your week…" [Browse recipes])
 ── /shopping-list ──
 [merged from plan: item · qty (unit-aware math) ✓]
 [manual: ＋ add input (limits)] swipe ← remove ✕ (button too)
 checked rows: strike + pulse · [Clear checked][Clear all]
```

### 4.6 Favorites `/favorites` · History `/history`
```
 [Recipes¹²|Cocktails³|Beers|Fruits|Products|Coffees|Breweries] ⇄swipe
 "N saved"   [Sort: recent|A–Z] [grid⇄list]
 grid: standard card + ♥(pressed) + [Plan] (recipes)
 list: row [thumb|title·sub|provider|♥] ← swipe-left = un-save ✦1.4
 long-press anywhere → quick actions ✦1.4
 per-collection emptyState with targeted CTA
 ── history ──
 Recent searches: [🔍 query · 3h ago · ✕] ← swipe-left removes ✦1.4
 Recently viewed: card grid + relative time · [Clear] per section
 recording off → explanatory empty copy + Settings link
```

### 4.7 Search `/search` + palette (⌘K)
```
 /search: [🔍 input (autofocus, q from URL)]
 grouped: RECIPES n · COCKTAILS n · FRUITS n … (ranked, deduped)
 failures → "X unavailable — other sources shown" notice
 no results → emptyState (spelling/broader-term advice + Discover CTA)
 palette: modal → input + spinner → Quick actions (6) · Recents (≤6)
          · Suggestions (7 chips) · grouped live results (≤4/group)
          · "View all N results →" · ">" command mode (12 commands)
          keyboard: ↑↓ cycle · Enter open/run · Esc close
```

### 4.8 Health `/health` · Settings `/settings`
```
 summary: [Operational n][Degraded n][Config n][Offline n][Disabled n][Total 28]
 table: provider | status dot | latency ms | classification | last check
        ▸ row expand: endpoints, notes, [Run diagnostic] (on-demand only)
 ── settings ──
 Appearance: Theme (Light|Dark|System segmented) · Larger text (On/Off)
 Data: history toggle · stat blocks (favorites/plan/list/history)
       [⬇ Export JSON][⬆ Import (validated)][🗑 Reset (confirm dialog)]
 note: "Reduced motion follows your OS automatically"
```

### 4.9 Docs/404/offline
```
 /privacy /terms /accessibility /about: doc-page (narrow 680–780px,
   overline + H1 + "Last updated 5 September 2026" + sections + ✓ lists)
 404: emptyState(compass, "This page doesn't exist", path quoted, → Home)
 /offline: wifi-off art + "cached pages still work" + retry + Home
```

## 5. Core user flows

**F1 — Discover → Cook:** Home/Discover → filter or ⌘K search → card (tap)
→ recipe detail (hero → lightbox) → ♥ save (toast + badge bumps) → 📅 Plan
(day/meal dialog) → /planner (drag to rearrange) → 🧺 Shopping list
(unit-merged) → cook ✓ (check off items).

**F2 — Fridge-first:** /kitchen → add items (validated chips) → ranked
recipes with exact overlap counts → detail → plan/save.

**F3 — Mobile gesture loop:** pull ↓ refresh (glass pill, TTL-revalidated)
· swipe ⇄ tabs · long-press card → quick actions sheet (Open/♥/Plan/Copy
link/Share) · swipe ← rows to remove (always with a visible button twin) ·
back-to-top ▲ · bottom nav thumb-reach.

**F4 — Degradation:** provider fails → section skeleton → precise error/
partial-failure notice (named provider) + retry — rest of the page lives.
Offline → SW serves cached navigations + /offline fallback; online toast on
return. No fabrication anywhere: absent data stays visibly absent.

**F5 — Trust:** any card badge → provider docs (new tab, noopener) ·
/health → live telemetry + on-demand diagnostic · /about → full matrix
incl. the 20 registered-but-disabled providers with honest reasons.

## 6. State matrix (every async surface)

| Screen family | Loading | Empty | Error | Partial failure | Offline |
| --- | --- | --- | --- | --- | --- |
| Grids (recipes/cocktails/products/breweries/beer/coffee/ingredients/food) | skeletonGrid (layout-matched) | query-specific + CTA | errorState + retry | notice + remaining data | SW cache / toast |
| Detail pages | skeletonDetail | 404 copy + back CTA | errorState + retry | related-section isolated | cached if visited |
| Home sections | per-section skeletons | recently-viewed hidden; inspiration retry card | per-section retry | trending tabs independent | hero text works; media fallback caption |
| Search/palette | spinner + "searching…" copy | no-results coaching | all-failed state | per-provider failure notice | recents/commands still work |
| Local (planner/favorites/history/shopping/settings) | instant (localStorage) | per-collection/coaching empty states | import-validation errors | storage-quota tolerant | fully functional |
| Health | passive (telemetry exists at boot) | never (28 static entries) | diagnostic error inline | per-provider rows independent | shows last-known + offline hint |
