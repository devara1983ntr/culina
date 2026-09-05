/**
 * CULINA — Application shell & route lifecycle (PRD §51–§52).
 */
import { clearNode, el } from './utils/dom.js';
import { refreshIcons } from './utils/icons.js';
import { appState } from './state.js';
import { currentRoute, installLinkInterception, navigate } from './router.js';
import { applyMeta } from './seo.js';
import { pageEnter, pageExit, mountScrollProgress } from './utils/motion.js';
import { attachPullToRefresh } from './utils/pullToRefresh.js';
import { initBackToTop } from './components/backToTop.js';
import { renderHeader, updateActiveNav } from './components/header.js';
import { renderBottomNav, updateBottomNav } from './components/bottomNav.js';
import { settingsService } from './services/settings.js';
import { renderFooter } from './components/footer.js';
import { errorState, emptyState, skeletonGrid } from './components/states.js';
import { migrate } from './storage.js';
import { toast } from './components/toast.js';
import { APP } from './constants.js';

/** Code-split pages: each route loads its own chunk (PRD §40). */
export const pageLoaders = {
  home: () => import('./pages/home.js'),
  discover: () => import('./pages/discover.js'),
  search: () => import('./pages/search.js'),
  recipes: () => import('./pages/recipes.js'),
  recipe: () => import('./pages/recipe.js'),
  ingredients: () => import('./pages/ingredients.js'),
  ingredient: () => import('./pages/ingredient.js'),
  nutrition: () => import('./pages/nutrition.js'),
  products: () => import('./pages/products.js'),
  product: () => import('./pages/product.js'),
  drinks: () => import('./pages/drinks.js'),
  cocktails: () => import('./pages/cocktails.js'),
  cocktail: () => import('./pages/cocktail.js'),
  beer: () => import('./pages/beer.js'),
  breweries: () => import('./pages/breweries.js'),
  coffee: () => import('./pages/coffee.js'),
  planner: () => import('./pages/planner.js'),
  favorites: () => import('./pages/favorites.js'),
  health: () => import('./pages/health.js'),
  kitchen: () => import('./pages/kitchen.js'),
  about: () => import('./pages/about.js'),
  food: () => import('./pages/food.js'),
  foodDetail: () => import('./pages/ingredient.js'),
  categories: () => import('./pages/categories.js'),
  cuisines: () => import('./pages/cuisines.js'),
  beerDetail: () => import('./pages/beerDetail.js'),
  breweryDetail: () => import('./pages/breweryDetail.js'),
  shoppingList: () => import('./pages/shoppingList.js'),
  settings: () => import('./pages/settings.js'),
  history: () => import('./pages/history.js'),
  privacy: () => import('./pages/privacy.js'),
  terms: () => import('./pages/terms.js'),
  accessibility: () => import('./pages/accessibility.js'),
  offline: () => import('./pages/offline.js'),
};

let activeCleanups = [];
let firstRender = true;
let renderToken = 0;

function runCleanups() {
  for (const fn of activeCleanups) {
    try {
      fn();
    } catch (err) {
      console.warn('[app] cleanup failed', err);
    }
  }
  activeCleanups = [];
}

function notFoundView(pathname) {
  return emptyState({
    icon: 'compass',
    title: 'This page doesn’t exist',
    message: `We couldn’t find “${pathname}”. It may have been moved, or the link is outdated.`,
    actionLabel: 'Back to home',
    href: '/',
  });
}

export async function renderRoute({ restoreScroll = null } = {}) {
  const route = currentRoute();
  const token = ++renderToken;
  appState.set({ route: { page: route.page, path: route.pathname } });
  updateActiveNav(route.pathname);
  updateBottomNav(route.pathname);
  runCleanups();

  const main = document.getElementById('main');
  const controller = new AbortController();
  const ctx = {
    params: route.params,
    query: route.query,
    path: route.pathname,
    signal: controller.signal,
    onCleanup: (fn) => activeCleanups.push(fn),
  };

  applyMeta({ title: null, description: `${APP.name} — ${APP.supportingCopy}`, jsonLd: null });

  const loader = pageLoaders[route.page];
  if (!loader) {
    clearNode(main);
    main.append(notFoundView(route.pathname));
    refreshIcons();
    return;
  }

  if (firstRender) {
    /* First paint: show a skeleton immediately so the boot splash can be
       dismissed and users see progress while the first chunk + data load. */
    clearNode(main);
    main.append(
      el(
        'div',
        { class: 'page' },
        el('div', { class: 'container' }, skeletonGrid(8)),
      ),
    );
    document.dispatchEvent(new CustomEvent('culina:app-ready'));
  }

  try {
    /* Page transition (skill: exit faster than enter, never block
       navigation): the outgoing view fades out WHILE the next route's
       chunk + render run — the animation costs nothing extra. */
    const outgoing = firstRender ? null : main.firstElementChild;
    const exitAnimation = outgoing ? pageExit(outgoing) : Promise.resolve();
    const [mod] = await Promise.all([loader(), exitAnimation]);
    if (token !== renderToken) return; // a newer navigation superseded us
    const view = await mod.render(ctx);
    if (token !== renderToken) return;
    clearNode(main);
    main.append(view);
    refreshIcons();
    pageEnter(main.firstElementChild);

    if (!firstRender) {
      // Move screen-reader focus to the new page content (WCAG-friendly SPA nav)
      main.focus({ preventScroll: true });
    }
    window.scrollTo({ top: restoreScroll ?? 0, behavior: 'instant' in document.documentElement.style ? 'instant' : 'auto' });
    firstRender = false;
  } catch (err) {
    if (err?.name === 'AbortError') return;
    console.error('[app] page error', err);
    clearNode(main);
    main.append(
      errorState({
        error: err,
        onRetry: () => renderRoute(),
      }),
    );
    refreshIcons();
    firstRender = false;
  }
}

export async function boot() {
  migrate();
  settingsService.init();
  renderHeader();
  renderFooter();
  renderBottomNav();
  installLinkInterception();
  initBackToTop();
  mountScrollProgress();
  /* Pull-to-refresh (touch devices): re-mounts the current route, which
     revalidates every provider call through the API client's TTL cache. */
  attachPullToRefresh(() => renderRoute());

  window.addEventListener('popstate', (event) => {
    renderRoute({ restoreScroll: event.state?.scroll ?? null });
  });

  window.addEventListener('online', () => {
    appState.set({ online: true });
    toast('Back online — live data restored', { type: 'success' });
  });
  window.addEventListener('offline', () => {
    appState.set({ online: false });
    toast('You’re offline — cached pages still work', { type: 'error', duration: 5000 });
  });

  await renderRoute();
}
