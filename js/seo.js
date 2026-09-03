/**
 * CULINA — Per-route SEO metadata (PRD §46).
 * Titles, descriptions, canonicals, Open Graph/Twitter and JSON-LD are
 * applied from real, displayed data only — never fabricated schema fields.
 */

function upsertMeta(selector, attr, key, content) {
  let node = document.head.querySelector(selector);
  if (!content) {
    if (node) node.remove();
    return;
  }
  if (!node) {
    node = document.createElement('meta');
    node.setAttribute(attr, key);
    document.head.append(node);
  }
  node.setAttribute('content', content);
}

function setJsonLd(data) {
  const existing = document.getElementById('route-jsonld');
  if (!data) {
    if (existing) existing.remove();
    return;
  }
  const script = existing || document.createElement('script');
  script.id = 'route-jsonld';
  script.type = 'application/ld+json';
  script.textContent = JSON.stringify(data);
  if (!existing) document.head.append(script);
}

/**
 * @param {{title?: string, description?: string, path?: string,
 *          ogImage?: string, jsonLd?: object|null, robots?: string}} meta
 */
export function applyMeta(meta = {}) {
  const baseTitle = 'CULINA — Discover food. Understand it. Make it yours.';

  document.title = meta.title ? `${meta.title} · CULINA` : baseTitle;

  upsertMeta('meta[name="description"]', 'name', 'description', meta.description);
  // App-internal pages (settings, history, favorites, offline) pass robots: 'noindex'
  upsertMeta('meta[name="robots"]', 'name', 'robots', meta.robots || null);
  upsertMeta('meta[property="og:title"]', 'property', 'og:title', meta.title || baseTitle);
  upsertMeta(
    'meta[property="og:description"]',
    'property',
    'og:description',
    meta.description || 'Recipes, ingredients, nutrition and drinks — intelligently connected.',
  );
  upsertMeta('meta[name="twitter:title"]', 'name', 'twitter:title', meta.title || baseTitle);
  upsertMeta(
    'meta[name="twitter:description"]',
    'name',
    'twitter:description',
    meta.description || 'Recipes, ingredients, nutrition and drinks — intelligently connected.',
  );

  const path = meta.path || window.location.pathname + window.location.search;
  const canonicalUrl = new URL(path, window.location.origin).toString();
  let canonical = document.head.querySelector('link[rel="canonical"]');
  if (!canonical) {
    canonical = document.createElement('link');
    canonical.rel = 'canonical';
    canonical.id = 'canonical';
    document.head.append(canonical);
  }
  canonical.href = canonicalUrl;

  let ogUrl = document.head.querySelector('meta[property="og:url"]');
  if (!ogUrl) {
    ogUrl = document.createElement('meta');
    ogUrl.setAttribute('property', 'og:url');
    document.head.append(ogUrl);
  }
  ogUrl.setAttribute('content', canonicalUrl);

  if (meta.ogImage) {
    upsertMeta('meta[property="og:image"]', 'property', 'og:image', meta.ogImage);
  }

  setJsonLd(meta.jsonLd ?? null);
}
