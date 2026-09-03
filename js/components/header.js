/**
 * CULINA — App header: brand, primary nav (accessible dropdown), search
 * trigger, theme control, favorites badge, mobile drawer (PRD §10).
 */
import { el, icon } from '../utils/dom.js';
import { refreshIcons } from '../utils/icons.js';
import { appState } from '../state.js';
import { NAV_PRIMARY, NAV_SECONDARY, APP } from '../constants.js';
import { openDrawer } from './modal.js';
import { openSearchOverlay } from './searchOverlay.js';
import { favorites } from '../services/favorites.js';
import { settingsService } from '../services/settings.js';
import { BrandLogo } from './brand.js';

const THEME_META = {
  light: { icon: 'sun', label: 'Theme: light — switch to dark' },
  dark: { icon: 'moon', label: 'Theme: dark — use system setting' },
  system: { icon: 'sun-moon', label: 'Theme: system — switch to light' },
};

function themeToggle() {
  const button = el('button', { class: 'icon-btn', type: 'button' });
  const render = () => {
    const mode = settingsService.get().theme;
    const meta = THEME_META[mode] || THEME_META.system;
    button.replaceChildren(icon(meta.icon));
    button.setAttribute('aria-label', meta.label);
    button.title = `Theme: ${mode}`;
    refreshIcons();
  };
  button.addEventListener('click', () => {
    settingsService.cycleTheme();
    render();
  });
  appState.subscribe(render); // header lives for the app lifetime
  render();
  return button;
}

/** Top-level path for a given route (so /recipe/x highlights “Recipes”). */
function navKeyFor(pathname) {
  const first = '/' + (pathname.split('/')[1] || '');
  if (['/recipe', '/recipes'].includes(first)) return '/recipes';
  if (['/ingredient', '/ingredients'].includes(first)) return '/ingredients';
  if (['/cocktail', '/cocktails', '/beer', '/breweries', '/coffee', '/drinks'].includes(first)) return '/drinks';
  return first;
}

export function updateActiveNav(pathname) {
  const key = navKeyFor(pathname);
  document.querySelectorAll('[data-nav-link]').forEach((link) => {
    if (link.getAttribute('href') === key) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
}

export function renderHeader() {
  const header = document.getElementById('site-header');
  if (!header) return;

  /* --- Dropdown (Drinks) --- */
  const drinks = NAV_PRIMARY.find((item) => item.children);
  const menu = el(
    'div',
    { class: 'nav-menu', id: 'drinks-menu', hidden: '' },
    ...drinks.children.map((child) => el('a', { href: child.href, 'data-nav-link': '' }, child.label)),
  );
  const dropdownButton = el(
    'button',
    { type: 'button', 'aria-haspopup': 'true', 'aria-expanded': 'false', 'aria-controls': 'drinks-menu' },
    'Drinks',
    icon('chevron-down'),
  );

  const closeMenu = () => {
    menu.setAttribute('hidden', '');
    dropdownButton.setAttribute('aria-expanded', 'false');
  };
  dropdownButton.addEventListener('click', () => {
    if (!menu.hasAttribute('hidden')) {
      closeMenu();
    } else {
      menu.removeAttribute('hidden');
      dropdownButton.setAttribute('aria-expanded', 'true');
      menu.querySelector('a')?.focus();
    }
  });
  menu.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeMenu();
      dropdownButton.focus();
    }
  });
  document.addEventListener('click', (event) => {
    if (!menu.hasAttribute('hidden') && !event.target.closest('.nav-dropdown')) closeMenu();
  });

  /* --- Primary nav --- */
  const nav = el(
    'nav',
    { class: 'primary-nav', 'aria-label': 'Primary' },
    ...NAV_PRIMARY.filter((item) => !item.children).map((item) => el('a', { href: item.href, 'data-nav-link': '' }, item.label)),
    el('div', { class: 'nav-dropdown' }, dropdownButton, menu),
  );

  /* --- Actions --- */
  const searchTrigger = el(
    'button',
    { class: 'search-trigger', type: 'button', 'aria-label': 'Open search' },
    icon('search'),
    el('span', { class: 'search-trigger-label' }, 'Search food, drinks…'),
    el(
      'span',
      { class: 'kbd-hint', 'aria-hidden': 'true' },
      el('kbd', { style: { fontSize: '10px', fontWeight: 600, border: '1px solid var(--color-border-strong)', borderRadius: '4px', padding: '1px 5px' } }, 'Ctrl'),
      el('kbd', { style: { fontSize: '10px', fontWeight: 600, border: '1px solid var(--color-border-strong)', borderRadius: '4px', padding: '1px 5px' } }, 'K'),
    ),
  );
  searchTrigger.addEventListener('click', () => openSearchOverlay());

  const favoritesLink = el(
    'a',
    { class: 'icon-btn desktop-only', href: '/favorites', 'aria-label': 'Favorites' },
    icon('heart'),
    el('span', { class: 'count-badge', hidden: '', 'data-role': 'favorites-count' }, '0'),
  );

  const menuButton = el('button', { class: 'icon-btn menu-btn', type: 'button', 'aria-label': 'Open menu' }, icon('menu'));
  menuButton.addEventListener('click', () => {
    const content = el(
      'div',
      { class: 'stack-5' },
      el(
        'div',
        {},
        el('p', { class: 'drawer-section-label' }, 'Explore'),
        ...NAV_PRIMARY.flatMap((item) =>
          item.children
            ? item.children.map((child) => el('a', { class: 'drawer-link', href: child.href, 'data-nav-link': '' }, icon(child.icon), child.label))
            : [el('a', { class: 'drawer-link', href: item.href, 'data-nav-link': '' }, icon(item.icon), item.label)],
        ),
      ),
      el(
        'div',
        {},
        el('p', { class: 'drawer-section-label' }, 'More'),
        ...NAV_SECONDARY.map((item) => el('a', { class: 'drawer-link', href: item.href, 'data-nav-link': '' }, icon(item.icon), item.label)),
      ),
      el(
        'div',
        { class: 'cluster', style: { marginTop: 'auto', paddingTop: 'var(--space-4)', borderTop: '1px solid var(--color-border)' } },
        themeToggle(),
        el('span', { class: 'muted', style: { fontSize: 'var(--text-xs)' } }, `v${APP.version} · local-first`),
      ),
    );
    openDrawer({ title: 'Menu', content });
  });

  header.replaceChildren(
    el(
      'div',
      { class: 'header-inner' },
      BrandLogo({ href: '/', markSize: 26 }),
      nav,
      el('div', { class: 'header-actions' }, searchTrigger, themeToggle(), favoritesLink, menuButton),
    ),
  );
  refreshIcons();

  /* Favorites badge reacts to store changes */
  const updateBadge = () => {
    const badge = header.querySelector('[data-role="favorites-count"]');
    if (!badge) return;
    const total = favorites.total();
    if (total > 0) {
      badge.removeAttribute('hidden');
      badge.textContent = String(total > 99 ? '99+' : total);
    } else {
      badge.setAttribute('hidden', '');
    }
  };
  appState.subscribe(() => updateBadge());
  updateBadge();

  /* Header elevation on scroll */
  const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 8);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* Global shortcuts: Ctrl/⌘ + K opens the command palette; “/” focuses
     search when not already typing in a field. */
  window.addEventListener('keydown', (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      openSearchOverlay();
      return;
    }
    if (event.key === '/' && !event.metaKey && !event.ctrlKey && !event.altKey) {
      const active = document.activeElement;
      const typing = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT' || active.isContentEditable);
      if (!typing && !document.querySelector('dialog[open]')) {
        event.preventDefault();
        openSearchOverlay();
      }
    }
  });
}
