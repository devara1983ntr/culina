/**
 * CULINA — Mobile bottom navigation (PRD §8).
 * Five primary destinations, active-route indication, safe-area padding.
 * Visible only on small viewports (CSS); hidden on print and when a modal
 * dialog is open (dialog top-layer handles focus, the bar just steps back).
 */
import { el, icon } from '../utils/dom.js';
import { refreshIcons } from '../utils/icons.js';
import { NAV_BOTTOM } from '../constants.js';
import { openSearchOverlay } from './searchOverlay.js';

/** Map any pathname → the bottom-nav entry that should look active. */
function bottomKeyFor(pathname) {
  const first = '/' + (pathname.split('/')[1] || '');
  if (['/recipe', '/recipes', '/ingredient', '/ingredients', '/categories', '/cuisines', '/nutrition', '/products', '/product', '/food'].includes(first)) return null; // belongs to Discover world, keep Discover active below
  if (['/discover'].includes(first)) return '/discover';
  if (first === '/') return '/';
  if (['/planner'].includes(first)) return '/planner';
  if (['/favorites'].includes(first)) return '/favorites';
  if (['/search'].includes(first)) return '/search';
  return null;
}

function worldActive(pathname) {
  // Food & drink content pages keep "Discover" lit as their world.
  const first = '/' + (pathname.split('/')[1] || '');
  return [
    '/recipe', '/recipes', '/ingredient', '/ingredients', '/categories', '/cuisines',
    '/nutrition', '/products', '/product', '/food', '/discover',
    '/cocktail', '/cocktails', '/beer', '/breweries', '/coffee', '/drinks',
  ].includes(first);
}

export function renderBottomNav() {
  const host = document.getElementById('bottom-nav');
  if (!host) return;

  const buttons = NAV_BOTTOM.map((item) => {
    if (item.action === 'search') {
      return el(
        'button',
        {
          class: 'bottom-nav-btn',
          type: 'button',
          'data-bottom-nav': 'search',
          'aria-label': 'Search',
        },
        el('span', { class: 'bottom-nav-icon', 'aria-hidden': 'true' }, icon(item.icon)),
        el('span', { class: 'bottom-nav-label' }, item.label),
      );
    }
    return el(
      'a',
      {
        class: 'bottom-nav-btn',
        href: item.href,
        'data-nav-link': '',
        'data-bottom-nav': item.href,
      },
      el('span', { class: 'bottom-nav-icon', 'aria-hidden': 'true' }, icon(item.icon)),
      el('span', { class: 'bottom-nav-label' }, item.label),
    );
  });

  const searchButton = buttons[NAV_BOTTOM.findIndex((i) => i.action === 'search')];
  searchButton.addEventListener('click', () => openSearchOverlay());

  host.replaceChildren(
    el(
      'nav',
      { class: 'bottom-nav', 'aria-label': 'Primary (mobile)' },
      ...buttons,
    ),
  );
  refreshIcons();
  updateBottomNav(location.pathname);
}

export function updateBottomNav(pathname) {
  const active = bottomKeyFor(pathname);
  const world = worldActive(pathname);
  document.querySelectorAll('[data-bottom-nav]').forEach((btn) => {
    const key = btn.getAttribute('data-bottom-nav');
    const isActive = key === active || (key === '/discover' && world);
    if (isActive) btn.setAttribute('aria-current', 'page');
    else btn.removeAttribute('aria-current');
  });
}
