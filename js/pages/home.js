/**
 * CULINA — Home page (PRD §11).
 */
import { el, icon } from '../utils/dom.js';
import { refreshIcons } from '../utils/icons.js';
import { applyMeta } from '../seo.js';
import { navigate } from '../router.js';
import { mealdb, cocktaildb, beers, foodish } from '../api/adapters/index.js';
import { entityGrid, entityCard, favoriteButton, mediaImage, itemRoute } from '../components/cards.js';
import { openSurprise } from '../components/surprise.js';
import { addToPlanDialog } from '../components/plannerWidgets.js';
import { section, sectionHead, mountReveal } from './shared.js';
import { attachTabSwipe } from '../utils/touch.js';
import { providerStrip } from '../components/providerBadge.js';
import { skeletonGrid, renderInto } from '../components/states.js';
import { renderTabs } from '../components/tabs.js';
import { searchField } from '../components/filters.js';
import { envelopeFor } from '../services/favorites.js';
import { history } from '../services/history.js';
import { APP } from '../constants.js';
import { mountImageLightbox } from '../components/lightbox.js';

function dayIndex() {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  return Math.floor((now - start) / 86_400_000);
}

const QUICK_ACTIONS = [
  { icon: 'sparkles', title: 'Surprise me', sub: 'A random discovery from any source', action: () => openSurprise() },
  { icon: 'chef-hat', title: 'What’s in my kitchen?', sub: 'Match recipes to your ingredients', href: '/kitchen' },
  { icon: 'clock', title: 'Quick bites', sub: 'Starters & simple plates', href: '/discover?entity=recipes&category=Starter' },
  { icon: 'salad', title: 'Healthy ideas', sub: 'Fruit nutrition & fresh ingredients', href: '/ingredients?tab=fruits' },
  { icon: 'martini', title: 'Cocktail discovery', sub: 'Classics, IBA lists & mocktails', href: '/discover?entity=cocktails' },
];

const CATEGORY_TILES = [
  { icon: 'utensils-crossed', title: 'Recipes', sub: 'Hundreds of meals by cuisine & category', href: '/recipes' },
  { icon: 'leaf', title: 'Ingredients', sub: 'Explore the pantry index', href: '/ingredients' },
  { icon: 'citrus', title: 'Fruits', sub: 'Botanical profiles with real nutrition', href: '/ingredients?tab=fruits' },
  { icon: 'martini', title: 'Cocktails', sub: 'Ingredients, measures & glassware', href: '/cocktails' },
  { icon: 'beer', title: 'Beer', sub: 'Ales & stouts with community ratings', href: '/beer' },
  { icon: 'building-2', title: 'Breweries', sub: '11,800+ breweries worldwide', href: '/breweries' },
  { icon: 'coffee', title: 'Coffee', sub: 'Hot & iced brewing guides', href: '/coffee' },
  { icon: 'package', title: 'Food Products', sub: 'Packaged goods with Nutri-Score', href: '/products' },
];

export async function render(ctx) {
  applyMeta({
    description: `${APP.name} unifies recipes, ingredients, nutrition, food products, cocktails, beer, breweries and coffee from verified open data sources into one elegant discovery experience.`,
  });

  const root = el('div', { class: 'page home' });

  /* ------------------------------------------------------------- HERO */
  const heroSearch = searchField({
    id: 'hero-search',
    placeholder: 'Search recipes, ingredients, food…',
    onSubmit: (q) => q.trim() && navigate(`/search?q=${encodeURIComponent(q.trim())}`),
    submitLabel: 'Search',
  });
  heroSearch.element.classList.add('hero-search');

  /* Voice input — only when the browser exposes SpeechRecognition. */
  const SpeechRecognitionCtor = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);
  if (SpeechRecognitionCtor) {
    let listening = false;
    const micButton = el('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Search by voice' }, icon('mic'));
    micButton.addEventListener('click', () => {
      if (listening) return;
      try {
        const recognition = new SpeechRecognitionCtor();
        recognition.lang = document.documentElement.lang || 'en';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;
        listening = true;
        micButton.setAttribute('aria-pressed', 'true');
        micButton.classList.add('is-listening');
        recognition.onresult = (event) => {
          const transcript = event.results?.[0]?.[0]?.transcript?.trim();
          if (transcript) {
            heroSearch.input.value = transcript;
            navigate(`/search?q=${encodeURIComponent(transcript)}`);
          }
        };
        recognition.onend = () => {
          listening = false;
          micButton.removeAttribute('aria-pressed');
          micButton.classList.remove('is-listening');
        };
        recognition.onerror = recognition.onend;
        recognition.start();
      } catch {
        listening = false;
        micButton.classList.remove('is-listening');
      }
    });
    heroSearch.trail.append(micButton);
  }

  const archMedia = el('div', { class: 'arch-media', 'aria-label': 'Food photography' });
  const archCaption = el(
    'span',
    { class: 'arch-caption' },
    icon('sparkles'),
    'Curated food photography',
  );
  archMedia.append(archCaption);
  foodish
    .randomImage({ signal: ctx.signal })
    .then(({ image }) => {
      if (!image || !archMedia.isConnected) return;
      const img = el('img', { src: image, alt: 'Random food photography served by Foodish', loading: 'eager', decoding: 'async', referrerpolicy: 'no-referrer' });
      img.addEventListener('error', () => img.remove());
      archMedia.prepend(img);
    })
    .catch(() => {
      archCaption.textContent = 'Photography temporarily unavailable';
    });

  const hero = el(
    'section',
    { class: 'home-hero' },
    el(
      'div',
      { class: 'home-hero-grid' },
      el(
        'div',
        {},
        el('p', { class: 'overline' }, icon('sparkles'), 'The food intelligence platform'),
        el('h1', { class: 'display-hero' }, 'Discover something delicious.'),
        el('p', { class: 'hero-copy' }, 'Search once across recipes, ingredients, nutrition, food products, cocktails, beer, breweries and coffee — and always know which verified source powers what you see.'),
        heroSearch.element,
        el(
          'div',
          { class: 'hero-quick' },
          el('button', { class: 'chip', type: 'button', onclick: () => openSurprise() }, icon('sparkles'), 'Surprise me'),
          el('a', { class: 'chip', href: '/kitchen' }, icon('chef-hat'), 'What’s in my kitchen?'),
          el('a', { class: 'chip', href: '/discover?entity=recipes&category=Starter' }, icon('clock'), 'Quick bites'),
          el('a', { class: 'chip', href: '/ingredients?tab=fruits' }, icon('salad'), 'Healthy ideas'),
          el('a', { class: 'chip', href: '/discover?entity=cocktails' }, icon('martini'), 'Cocktail hour'),
        ),
      ),
      archMedia,
    ),
  );

  /* ------------------------------------------- TODAY'S INSPIRATION */
  const inspirationBody = el('div', { class: 'featured-card' });
  const inspirationSection = el(
    'section',
    { class: 'section', style: { paddingTop: 0 } },
    el(
      'div',
      { class: 'container' },
      sectionHead('Today’s inspiration', { sub: 'A fresh pick from TheMealDB, re-drawn every few minutes' }),
      inspirationBody,
    ),
  );

  function renderInspirationSkeleton() {
    renderInto(
      inspirationBody,
      el('div', { class: 'featured-media skeleton', style: { minHeight: '320px' } }),
      el(
        'div',
        { class: 'featured-body' },
        el('div', { class: 'skeleton', style: { height: '1rem', width: '40%' } }),
        el('div', { class: 'skeleton', style: { height: '2.4rem', width: '80%' } }),
        el('div', { class: 'skeleton', style: { height: '1rem', width: '60%' } }),
        el('div', { class: 'skeleton', style: { height: '44px', width: '180px', borderRadius: 'var(--radius-sm)' } }),
      ),
    );
  }

  function renderInspiration(recipe) {
    if (!recipe) {
      renderInto(
        inspirationBody,
        el(
          'div',
          { class: 'state-block', style: { gridColumn: '1 / -1' } },
          el('span', { class: 'state-icon' }, icon('alert-triangle')),
          el('h2', {}, 'Today’s pick is taking a break'),
          el('p', {}, 'TheMealDB didn’t respond — the rest of CULINA is still fully live.'),
          el('button', { class: 'btn btn-secondary btn-sm', type: 'button', onclick: () => loadInspiration() }, icon('rotate-cw'), 'Try again'),
        ),
      );
      refreshIcons();
      return;
    }
    const route = itemRoute('recipe', recipe);
    const envelope = envelopeFor('recipe', recipe, route);
    renderInto(
      inspirationBody,
      el(
        'div',
        { class: 'featured-media' },
        mediaImage({ image: recipe.image, title: recipe.title, eager: true }),
      ),
      el(
        'div',
        { class: 'featured-body' },
        el('p', { class: 'overline' }, icon('flame'), 'Today’s inspiration'),
        el('h2', {}, recipe.title),
        el(
          'div',
          { class: 'cluster' },
          recipe.cuisine ? el('span', { class: 'badge badge-accent' }, recipe.cuisine) : null,
          recipe.category ? el('span', { class: 'badge badge-neutral' }, recipe.category) : null,
          recipe.ingredients.length ? el('span', { class: 'badge badge-neutral' }, `${recipe.ingredients.length} ingredients`) : null,
        ),
        el(
          'div',
          { class: 'featured-actions' },
          el('a', { class: 'btn btn-primary', href: route }, 'View recipe', icon('arrow-right')),
          favoriteButton('recipe', recipe),
          envelope ? el('button', { class: 'btn btn-secondary', type: 'button', onclick: () => addToPlanDialog(envelope) }, icon('calendar-days'), 'Plan it') : null,
        ),
      ),
    );
    refreshIcons();
  }

  async function loadInspiration() {
    renderInspirationSkeleton();
    try {
      renderInspiration(await mealdb.random({ signal: ctx.signal }));
    } catch (err) {
      if (err?.name === 'AbortError') return;
      renderInspiration(null);
    }
  }

  /* --------------------------------------------- TRENDING DISCOVERIES */
  const trendingContent = el('div');
  const tabsHost = el('div');
  const trendingGridHost = el('div');
  trendingContent.append(tabsHost, trendingGridHost);
  let trendingTab = 'recipes';
  let trendingLabel = '';
  const tabCache = new Map();

  function renderTrendingTabs() {
    renderInto(
      tabsHost,
      renderTabs({
        tabs: [
          { id: 'recipes', label: 'Recipes' },
          { id: 'cocktails', label: 'Cocktails' },
          { id: 'beers', label: 'Beers' },
        ],
        active: trendingTab,
        onSelect: (id) => selectTrendingTab(id),
        ariaLabel: 'Trending categories',
      }),
    );
  }

  /** Switch trending tab (click or horizontal swipe on the grid). */
  function selectTrendingTab(id) {
    if (id === trendingTab) return;
    trendingTab = id;
    renderTrendingTabs();
    loadTrending();
  }

  /* Swipe the trending grid left/right to change source. */
  ctx.onCleanup(
    attachTabSwipe(trendingGridHost, {
      ids: ['recipes', 'cocktails', 'beers'],
      getActive: () => trendingTab,
      onSelect: selectTrendingTab,
    }),
  );

  async function loadTrending() {
    renderInto(trendingGridHost, skeletonGrid(4));
    const key = trendingTab;
    if (tabCache.has(key)) {
      renderTrending(tabCache.get(key));
      return;
    }
    try {
      let items = [];
      let entity = 'recipe';
      if (key === 'recipes') {
        const categories = await mealdb.categories({ signal: ctx.signal });
        const category = categories[dayIndex() % categories.length];
        items = (await mealdb.filterByCategory(category.name, { signal: ctx.signal })).slice(0, 8);
        trendingLabel = `Fresh picks · ${category.name} (today’s rotating category)`;
      } else if (key === 'cocktails') {
        entity = 'cocktail';
        items = (await cocktaildb.filterByCategory('Cocktail', { signal: ctx.signal })).slice(0, 8);
        trendingLabel = 'Contemporary classics · TheCocktailDB';
      } else {
        entity = 'beer';
        const { ales } = await beers.all({ signal: ctx.signal });
        items = ales.slice(0, 8);
        trendingLabel = 'Community favorites · SampleAPIs';
      }
      tabCache.set(key, { entity, items });
      renderTrending(tabCache.get(key));
    } catch (err) {
      if (err?.name === 'AbortError') return;
      renderInto(
        trendingGridHost,
        el(
          'div',
          { class: 'state-block is-error' },
          el('span', { class: 'state-icon' }, icon('alert-triangle')),
          el('h2', { style: { fontSize: '1.05rem' } }, 'This source didn’t respond'),
          el('p', {}, 'Try another tab — the other sources are independent.'),
        ),
      );
      refreshIcons();
    }
  }

  function renderTrending({ entity, items }) {
    renderInto(
      trendingGridHost,
      el('p', { class: 'muted', style: { marginBottom: 'var(--space-4)', fontSize: 'var(--text-sm)' } }, trendingLabel),
      entityGrid(items, { entity }),
    );
    refreshIcons();
    mountReveal(ctx, trendingGridHost.querySelector('.grid-cards'));
  }

  const trendingSection = el(
    'section',
    { class: 'section', style: { paddingTop: 0 } },
    el(
      'div',
      { class: 'container' },
      sectionHead('Trending discoveries', { sub: 'Live samples from our data partners', ctaLabel: 'Open Discover', ctaHref: '/discover' }),
      trendingContent,
    ),
  );

  /* ------------------------------------------------- EXPLORE / QUICK / PROVIDERS */
  const exploreSection = el(
    'section',
    { class: 'section', style: { paddingTop: 0 } },
    el(
      'div',
      { class: 'container' },
      sectionHead('Explore by category', { sub: 'Eight worlds of food & drink intelligence' }),
      el(
        'div',
        { class: 'grid-cards' },
        ...CATEGORY_TILES.map((tile) =>
          el(
            'a',
            { class: 'category-tile reveal', href: tile.href },
            el('span', { class: 'tile-glow', 'aria-hidden': 'true' }),
            el('span', { class: 'icon-tile' }, icon(tile.icon)),
            el('span', { class: 'tile-title' }, tile.title),
            el('span', { class: 'tile-sub' }, tile.sub),
          ),
        ),
      ),
    ),
  );

  const quickSection = el(
    'section',
    { class: 'section', style: { paddingTop: 0 } },
    el(
      'div',
      { class: 'container' },
      sectionHead('Quick discovery', { sub: 'One tap, one idea' }),
      el(
        'div',
        { class: 'quick-actions' },
        ...QUICK_ACTIONS.map((action) => {
          const inner = el(
            'span',
            { class: 'icon-tile', 'aria-hidden': 'true' },
            icon(action.icon),
          );
          const text = el(
            'span',
            {},
            el('span', { class: 'qa-title' }, action.title),
            el('span', { class: 'qa-sub', style: { display: 'block' } }, action.sub),
          );
          return action.href
            ? el('a', { class: 'quick-action reveal', href: action.href }, inner, text)
            : el('button', { class: 'quick-action reveal', type: 'button', onclick: action.action }, inner, text);
        }),
      ),
    ),
  );

  /* --------------------------------------------- WHAT CAN I MAKE? BAND */
  const kitchenBand = el(
    'section',
    { class: 'section', style: { paddingTop: 0 } },
    el(
      'div',
      { class: 'container' },
      el(
        'div',
        { class: 'kitchen-band' },
        el('span', { class: 'icon-tile is-large', 'aria-hidden': 'true' }, icon('chef-hat')),
        el(
          'div',
          { class: 'kitchen-band-copy' },
          el('h2', {}, 'What can I make right now?'),
          el('p', {}, 'Add what’s in your kitchen and CULINA ranks recipes by ingredient overlap — showing exactly how many of your items each recipe uses.'),
          el(
            'div',
            { class: 'cluster', style: { flexWrap: 'wrap' } },
            el('a', { class: 'btn btn-primary', href: '/kitchen' }, 'Open kitchen match', icon('arrow-right')),
            ...['Chicken', 'Rice', 'Eggs'].map((name) =>
              el('a', { class: 'chip', href: `/kitchen?add=${encodeURIComponent(name)}` }, '+ ', name),
            ),
          ),
        ),
      ),
    ),
  );

  /* ------------------------------------------------ RECENTLY VIEWED */
  const recentViews = history.views().slice(0, 6);
  const recentSection = recentViews.length
    ? el(
        'section',
        { class: 'section', style: { paddingTop: 0 } },
        el(
          'div',
          { class: 'container' },
          sectionHead('Recently viewed', { sub: 'Your trail on this device', ctaLabel: 'Full history', ctaHref: '/history' }),
          el(
            'div',
            { class: 'grid-cards' },
            ...recentViews.map((view) =>
              el(
                'article',
                { class: 'card reveal' },
                el('a', { class: 'card-media', href: view.route, 'aria-label': `Open ${view.title}` }, mediaImage({ image: view.image, title: view.title })),
                el(
                  'div',
                  { class: 'card-body' },
                  el('a', { class: 'card-title', href: view.route }, view.title),
                  view.subtitle ? el('div', { class: 'card-meta' }, view.subtitle) : null,
                ),
              ),
            ),
          ),
        ),
      )
    : null;

  const providersSection = el(
    'section',
    { class: 'section', style: { paddingTop: 0 } },
    el(
      'div',
      { class: 'container' },
      sectionHead('Powered by verified open data', { sub: 'Live status for every provider' }),
      providerStrip(),
    ),
  );

  root.append(hero, inspirationSection, trendingSection, kitchenBand, recentSection, exploreSection, quickSection, providersSection);

  loadInspiration();
  renderTrendingTabs();
  loadTrending();
  refreshIcons();
  mountReveal(ctx, exploreSection.querySelector('.grid-cards'), quickSection, root.querySelector('.home-hero-grid'));

  /* Tap a hero photo to enlarge it (lightbox). */
  mountImageLightbox(ctx, root);

  return root;
}
