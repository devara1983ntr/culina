/**
 * CULINA — History-based client-side router.
 * Shareable, meaningful URLs (PRD §7/§52) with real <a href> links for
 * crawlability; interception provides SPA navigation without reloads.
 */

export const routes = [
  { path: '/', page: 'home' },
  { path: '/discover', page: 'discover' },
  { path: '/search', page: 'search' },
  { path: '/recipes', page: 'recipes' },
  { path: '/recipe/:id', page: 'recipe' },
  { path: '/ingredients', page: 'ingredients' },
  { path: '/ingredient/:source/:id', page: 'ingredient' },
  { path: '/nutrition', page: 'nutrition' },
  { path: '/products', page: 'products' },
  { path: '/product/:source/:id', page: 'product' },
  { path: '/drinks', page: 'drinks' },
  { path: '/cocktails', page: 'cocktails' },
  { path: '/cocktail/:id', page: 'cocktail' },
  { path: '/beer', page: 'beer' },
  { path: '/breweries', page: 'breweries' },
  { path: '/coffee', page: 'coffee' },
  { path: '/planner', page: 'planner' },
  { path: '/favorites', page: 'favorites' },
  { path: '/health', page: 'health' },
  { path: '/kitchen', page: 'kitchen' },
  { path: '/about', page: 'about' },
  { path: '/food', page: 'food' },
  { path: '/food/:source/:id', page: 'foodDetail' },
  { path: '/categories', page: 'categories' },
  { path: '/cuisines', page: 'cuisines' },
  { path: '/beer/:style/:id', page: 'beerDetail' },
  { path: '/brewery/:name', page: 'breweryDetail' },
  { path: '/shopping-list', page: 'shoppingList' },
  { path: '/settings', page: 'settings' },
  { path: '/history', page: 'history' },
  { path: '/privacy', page: 'privacy' },
  { path: '/terms', page: 'terms' },
  { path: '/accessibility', page: 'accessibility' },
  { path: '/offline', page: 'offline' },
];

const compiled = routes.map((route) => ({
  ...route,
  regex: new RegExp(`^${route.path.replace(/:[^/]+/g, (name) => `(?<${name.slice(1)}>[^/]+)`)}$`),
}));

export function matchRoute(pathname) {
  const clean = pathname.replace(/\/+$/, '') || '/';
  for (const route of compiled) {
    const m = clean.match(route.regex);
    if (m) return { page: route.page, path: route.path, params: m.groups || {} };
  }
  return null;
}

export function currentRoute() {
  const { pathname, search } = window.location;
  const matched = matchRoute(pathname);
  const query = Object.fromEntries(new URLSearchParams(search));
  return {
    page: matched ? matched.page : 'not-found',
    params: matched ? matched.params : {},
    query,
    pathname,
  };
}

export function navigate(to, { replace = false } = {}) {
  const target = to.startsWith('/') ? to : new URL(to, location.origin).pathname + location.search;
  if (replace) history.replaceState({}, '', target);
  else history.pushState({}, '', target);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

/** Global link interception → SPA navigation. */
export function installLinkInterception() {
  document.addEventListener('click', (event) => {
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    const anchor = event.target.closest('a');
    if (!anchor || anchor.target === '_blank' || anchor.hasAttribute('download')) return;
    if (anchor.dataset.external !== undefined) return;

    const href = anchor.getAttribute('href');
    if (!href || !href.startsWith('/')) return;
    if (href.startsWith('//')) return; // protocol-relative external

    event.preventDefault();
    navigate(href);
  });
}
