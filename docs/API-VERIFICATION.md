# CULINA — API Verification Record

**Verification date: 2026-09-02** · Method: live probes (HTTP status, content-type, payload shape, CORS headers) from the deployment environment, followed by in-app adapter tests on real responses.

The machine-readable registry — classifications, auth requirements, endpoints, rate limits, attribution, and the exact verification note for each provider — lives in [`../js/api/registry.js`](../js/api/registry.js). Live status is always visible at `/health`.

## Methodology

Each provider was probed before integration:

1. **Reachability** — DNS resolution, HTTP(S) availability, final status codes.
2. **Payload shape** — real responses captured and used as test fixtures (`tests/normalizer.test.js`).
3. **Browser compatibility** — `Access-Control-Allow-Origin` presence for direct browser use.
4. **Auth model** — none / key / OAuth, and where a key would have to live.
5. **Quirks** — documented per provider below and encoded in the adapter (never worked around silently in the UI).

Rules honored throughout (PRD): never claim an API works unverified; never fabricate data; never expose secrets client-side.

## Enabled providers (8)

### TheMealDB — `mealdb` · DIRECT
- Base: `https://www.themealdb.com/api/json/{key}/1/` — the free community test key is documented publicly by the provider; no secret involved.
- Verified endpoints: `search.php?s=`, `lookup.php?i=`, `filter.php?{c,a,i}=`, `list.php?{c,a,i}=list`, `random.php`, `categories.php`.
- Payload quirks encoded in the adapter/normalizer:
  - Ingredients are 20 column pairs (`strIngredient1..20` / `strMeasure1..20`) — many null/blank; blanks are skipped, not emitted.
  - `strArea` (continent label like "Japanese") with optional `strCountry`; cuisine = `strArea || strCountry`.
  - Instructions are a single string with `\r\n` breaks; some entries carry `STEP n:` markers which are stripped into numbered steps.
  - `strTags` is a comma list; `strSource`/`strYoutube` may be absent → `null`, never linked.
  - Preview images are `{thumb}/preview` — both sizes kept on the model.

### TheCocktailDB — `cocktaildb` · DIRECT
- Same architecture as TheMealDB. Verified: `search.php?s=`, `lookup.php?i=`, `filter.php?{c,i}=`, `list.php?c=list`, plus the non-alcoholic filter (`a=Non_Alcoholic`).
- `strAlcoholic` is tri-state in practice → mapped to `true/false/null`.
- `strIBA`, `strGlass` present on classics only.

### Fruityvice — `fruityvice` · PROXY_REQUIRED
- Verified live: `/api/fruit/all` (≈190 fruits) and `/api/fruit/{id}` return 200 JSON.
- **No `Access-Control-Allow-Origin` header** → direct browser calls are blocked. Reached through the same-origin gateway (`/api/fruityvice/*`), provided by `vite.config.js` in dev and `server.js` in production (strict path allowlist: `/api/fruit/(all|\d+)`).
- Nutrition is per-100 g for calories/protein/carbs/fat/sugar. **Fiber and sodium are not provided → `null`, never `0`.** No imagery → typographic tiles.

### Foodish — `foodish` · DIRECT
- Only the random-image endpoint (`/api/`) is dependable; category-specific paths were unreliable during verification. The adapter uses the verified endpoint only.

### Open Brewery DB — `openbrewerydb` · DIRECT
- Base: `https://api.openbrewerydb.org/v1` (new schema: `address_1`, `state_province`).
- No `/random` endpoint — the adapter randomizes a page number (1–220) with `per_page=1`.
- Rate limit: 120 requests per window per IP → list results cached 10 minutes.
- Coordinates arrive as strings → parsed to numbers, map links built only when both exist.

### Open Food Facts — `openfoodfacts` · DIRECT
- Base: `https://world.openfoodfacts.org/api/v2`.
- **Text search (`/search`) intermittently returns 503 (server overload)** — verified repeatedly. The adapter retries twice; failures degrade gracefully. Barcode lookup (`/code/{barcode}`) is reliable.
- Nutri-Score grade (`a–e`) and NOVA group (1–4) mapped when present; nutriments read per-100 g (`energy-kcal_100g` etc.). Absent values → `null`.
- Labels arrive as machine tags (`en:organic`) → cleaned to "Organic".

### SampleAPIs — Coffee — `sampleapis-coffee` · DIRECT
- `https://api.sampleapis.com/coffee/{hot,iced}` — community dataset; title/description/ingredients/image per guide.

### SampleAPIs — Beers — `sampleapis-beers` · DIRECT
- Verified: only `/ale` and `/stouts` endpoints exist (the historical beer list is gone).
- `rating` is an object (`{average, reviews}`) on some entries and a string on others → both normalized.
- `image` may literally be `"no"` → `null` (monogram tile in the UI). Price is a display string.
- **ABV, brewery and tasting notes are not provided — shown nowhere, never invented.** The original PunkAPI (BrewDog) that would have supplied them is dead (NXDOMAIN), which is disclosed in the UI.

## Verified but not enabled (20)

| Provider | Classification | Verification outcome |
| --- | --- | --- |
| Spoonacular | API_KEY_REQUIRED | Working API, key required — would need a keyed server gateway; disabled with honest "Configuration required" |
| Edamam (Nutrition, Recipes) | API_KEY_REQUIRED | Same — app id + key |
| Tasty (RapidAPI) | API_KEY_REQUIRED | Same — RapidAPI key |
| RecipeAPI | API_KEY_REQUIRED | Same |
| Zestful | API_KEY_REQUIRED | Same |
| Chomp | API_KEY_REQUIRED | Same |
| Food Info | API_KEY_REQUIRED | Same |
| Systembolaget | API_KEY_REQUIRED | Same |
| Kroger | OAUTH_REQUIRED | OAuth 2.0 client-credentials flow; out of scope for a keyless build |
| Untappd | OAUTH_REQUIRED | Same |
| PunkAPI (BrewDog) | UNAVAILABLE | DNS no longer resolves (verified 2026-09-02) |
| LCBO API | UNAVAILABLE | Dead endpoint |
| Rustybeer | UNAVAILABLE | Dead endpoint |
| TacoFancy | UNAVAILABLE | HTTP-only (no TLS) → mixed-content blocked |
| NYPL "What's on the menu?" | UNAVAILABLE | HTTP-only |
| BaconMockup | DISABLED | Reachable placeholder-image API; no real food data value |
| Coffee (alexflipnote) | DISABLED | Superseded by SampleAPIs coffee (images only, no guides) |
| WhiskyHunter | DISABLED | Reachable but out of product scope |
| Report of the Week | DISABLED | Reachable but unstructured for this use |

## In-app verification surfaces

- `/health` — per-provider status, latency, classification, rate limits, license, last error, and on-demand "Test" buttons backed by adapter `diagnostic()` functions.
- Every result card carries a source badge; every detail page includes a full source panel.
- `about` — enabled vs. not-enabled provider lists with reasons, publicly visible.
