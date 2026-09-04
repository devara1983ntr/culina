# Security Policy

## Reporting a vulnerability

Please report security issues privately to the repository owner via GitHub's
**Report a vulnerability** flow (Security → Advisories) or the contact in the
profile linked from this repository. Please include reproduction steps and,
where possible, a minimal proof of concept. Reports are triaged within a few
days; please avoid public disclosure until a fix is released.

## Security model

CULINA is a static, local-first web application behind a minimal gateway:

- **No secrets client-side.** Every enabled provider is keyless and is called
  directly from the browser. Providers that require API keys or OAuth are
  registered but disabled, with an honest "configuration required" state —
  they are never faked. If you enable such a provider, its key belongs in the
  **server** environment of the gateway, never in HTML/CSS/JS or git history.
- **Content Security Policy.** The gateway enforces a CSP on every response:
  `script-src 'self'` plus a startup-computed SHA-256 hash of the single
  inline theme-bootstrap script, and a `connect-src` limited to the enabled
  provider origins. Deployments without the gateway (e.g. static hosting)
  lose the header-based CSP — see the README deployment section.
- **No HTML injection.** Remote provider data is never inserted as markup;
  the DOM is built programmatically (`el()` helpers). URLs pass through an
  http(s)-only sanitizer; external links carry `rel="noopener noreferrer"`.
- **Gateway hardening.** Strictly allowlisted reverse proxy (path regex, GET
  only, upstream timeout), path-traversal defense, `X-Content-Type-Options`,
  `X-Frame-Options: DENY`/`frame-ancestors 'none'`, `Referrer-Policy`,
  `Permissions-Policy` (microphone allowed deliberately for voice search),
  COOP, and HSTS on HTTPS.
- **Local-first privacy.** Favorites, plans, settings and history live in
  `localStorage` only. There are no accounts, no analytics and no outbound
  telemetry. Clearing site data resets everything.

## Verification

- `npm run build && node scripts/gateway-test.mjs` — asserts the full header
  and routing contract (72 assertions).
- `npm audit --audit-level=high` — dependency vulnerabilities (must be 0).
- `npm run audit` — static audit, including that every relative import
  resolves and no unregistered icon/route is referenced.
