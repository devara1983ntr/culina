/**
 * CULINA — Command palette & global search (⌘K / Ctrl+K, or “/”).
 * Debounced (250 ms), aborts obsolete requests, grouped live results with
 * provider badges, keyboard navigation, recent searches (local only),
 * and quick-action commands (type “>” to filter commands only).
 */
import { el, icon, clearNode } from '../utils/dom.js';
import { refreshIcons } from '../utils/icons.js';
import { openModal } from './modal.js';
import { unifiedSearch } from '../services/search.js';
import { navigate } from '../router.js';
import { read, write } from '../storage.js';
import { STORAGE_KEYS, ENTITY_LABELS } from '../constants.js';
import { itemRoute, mediaImage } from './cards.js';
import { debounce } from '../utils/fn.js';
import { truncate } from '../utils/format.js';
import { settingsService } from '../services/settings.js';
import { history } from '../services/history.js';
import { openSurprise } from './surprise.js';

const GROUP_META = {
  recipes: { icon: 'utensils-crossed', routeEntity: 'recipe' },
  cocktails: { icon: 'martini', routeEntity: 'cocktail' },
  fruits: { icon: 'citrus', routeEntity: 'fruit' },
  products: { icon: 'package', routeEntity: 'product' },
  breweries: { icon: 'building-2', routeEntity: 'brewery' },
  beers: { icon: 'beer', routeEntity: 'beer' },
  coffees: { icon: 'coffee', routeEntity: 'coffee' },
};

const SUGGESTIONS = ['chicken', 'margarita', 'strawberry', 'espresso', 'pizza', 'nutella', 'gin'];

/** Quick actions — navigation & app commands, keyboard accessible. */
const COMMANDS = [
  { id: 'discover', label: 'Discover recipes', hint: 'Browse every source', icon: 'compass', run: () => navigate('/discover') },
  { id: 'recipes', label: 'All recipes', hint: 'Filter by cuisine & category', icon: 'utensils-crossed', run: () => navigate('/recipes') },
  { id: 'kitchen', label: 'Kitchen match', hint: 'What can I make right now?', icon: 'chef-hat', run: () => navigate('/kitchen') },
  { id: 'planner', label: 'Meal planner', hint: 'Plan your week', icon: 'calendar-days', run: () => navigate('/planner') },
  { id: 'shopping', label: 'Shopping list', hint: 'Merged & manual items', icon: 'shopping-basket', run: () => navigate('/shopping-list') },
  { id: 'favorites', label: 'Favorites', hint: 'Your saved collection', icon: 'heart', run: () => navigate('/favorites') },
  { id: 'nutrition', label: 'Nutrition explorer', hint: 'Fruits & products', icon: 'flask-conical', run: () => navigate('/nutrition') },
  { id: 'drinks', label: 'Drinks hub', hint: 'Cocktails, beer, breweries, coffee', icon: 'wine', run: () => navigate('/drinks') },
  { id: 'health', label: 'API health', hint: 'Provider diagnostics', icon: 'activity', run: () => navigate('/health') },
  { id: 'settings', label: 'Settings', hint: 'Theme, accessibility, data', icon: 'settings', run: () => navigate('/settings') },
  { id: 'theme', label: 'Switch theme', hint: 'Light · dark · system', icon: 'sun-moon', run: () => settingsService.cycleTheme() },
  { id: 'surprise', label: 'Surprise me', hint: 'A random discovery', icon: 'sparkles', run: () => openSurprise() },
];

function saveRecent(query) {
  const q = String(query || '').trim();
  if (!q || q.length < 2) return;
  const list = read(STORAGE_KEYS.recentSearches, []).filter((item) => item.q.toLowerCase() !== q.toLowerCase());
  list.unshift({ q, at: Date.now() });
  write(STORAGE_KEYS.recentSearches, list.slice(0, 8));
  history.recordSearch(q); // history service (capped, disableable)
}

export function openSearchOverlay({ initialQuery = '' } = {}) {
  let controller = null;
  let flatResults = [];
  let activeIndex = -1;

  let commandMode = false;

  const input = el('input', {
    type: 'search',
    placeholder: 'Search recipes, drinks, products… — “>” for commands',
    'aria-label': 'Search everything',
    autocomplete: 'off',
    spellcheck: 'false',
  });
  if (initialQuery) input.value = initialQuery;

  const spinner = el('span', { class: 'spinner', hidden: '', 'aria-hidden': 'true' });
  const results = el('div', { class: 'search-overlay-results' });

  const { close, dialog } = openModal({
    title: 'Search',
    content: el(
      'div',
      { class: 'search-overlay-inner' },
      el(
        'div',
        { class: 'search-overlay-input-row' },
        icon('search', 'search-lead'),
        input,
        spinner,
      ),
      results,
    ),
    onClose: () => {
      controller?.abort();
      debouncedRun.cancel();
    },
  });
  // Reparent into the search-overlay chrome (modal without visible header)
  dialog.classList.add('search-overlay');
  dialog.querySelector('.modal-head')?.remove();
  dialog.querySelector('.modal-body')?.classList.add('search-overlay-body');
  input.focus();

  function resultItem(entity, item) {
    const route = itemRoute(entity, item);
    const button = el(
      route ? 'a' : 'div',
      {
        class: 'result-item',
        ...(route ? { href: route } : {}),
      },
      mediaImage({ image: item.imagePreview || item.image, title: item.title }),
      el(
        'span',
        { style: { minWidth: 0 } },
        el('span', { class: 'result-title clamp-1' }, truncate(item.title, 64)),
        el('span', { class: 'result-sub clamp-1' }, item.cuisine || item.category || item.brand || item.family || item.style || ''),
      ),
      el('span', { class: 'badge badge-source' }, item.source === 'mealdb' ? 'TheMealDB' : item.source === 'cocktaildb' ? 'TheCocktailDB' : item.source === 'fruityvice' ? 'Fruityvice' : item.source === 'openfoodfacts' ? 'Open Food Facts' : item.source === 'openbrewerydb' ? 'Open Brewery DB' : 'SampleAPIs'),
    );
    if (route) button.addEventListener('click', () => { saveRecent(input.value); close(); });
    return button;
  }

  function commandButton(command) {
    const button = el(
      'button',
      { class: 'result-item command-item', type: 'button', 'aria-label': command.label },
      el('span', { class: 'command-icon', 'aria-hidden': 'true' }, icon(command.icon)),
      el(
        'span',
        { style: { minWidth: 0, flex: 1 } },
        el('span', { class: 'result-title clamp-1' }, command.label),
        el('span', { class: 'result-sub clamp-1' }, command.hint || ''),
      ),
      el('span', { class: 'kbd-hint', 'aria-hidden': 'true' }, '↵'),
    );
    button.addEventListener('click', () => {
      close();
      command.run();
    });
    return button;
  }

  function renderCommands(filtered) {
    clearNode(results);
    flatResults = [...filtered.map(commandButton)];
    activeIndex = -1;
    commandMode = true;
    results.append(
      el('p', { class: 'result-group-label' }, icon('zap'), filtered.length ? 'Commands' : 'No matching commands'),
      ...flatResults,
      el('p', { class: 'muted', style: { padding: 'var(--space-2) var(--space-3)', fontSize: 'var(--text-xs)' } }, 'Type anything without “>” to search across providers.'),
    );
    refreshIcons();
  }

  function renderIdle() {
    const recents = read(STORAGE_KEYS.recentSearches, []);
    clearNode(results);
    flatResults = [];
    activeIndex = -1;
    commandMode = false;

    /* Quick actions (command mode) */
    results.append(
      el('p', { class: 'result-group-label' }, icon('zap'), 'Quick actions'),
      ...COMMANDS.slice(0, 6).map((command) => {
        const node = commandButton(command);
        flatResults.push(node);
        return node;
      }),
      el('p', { class: 'muted', style: { padding: '0 var(--space-3) var(--space-2)', fontSize: 'var(--text-xs)' } }, 'Type to search · “>” for all commands'),
    );

    if (recents.length) {
      results.append(
        el('p', { class: 'result-group-label' }, 'Recent searches'),
        el(
          'div',
          { class: 'cluster', style: { padding: '0 var(--space-3) var(--space-3)' } },
          ...recents.slice(0, 6).map((r) =>
            el('button', { class: 'chip', type: 'button', onclick: () => { input.value = r.q; run(r.q); } }, icon('clock'), r.q),
          ),
        ),
      );
    }
    results.append(
      el('p', { class: 'result-group-label' }, 'Try searching for'),
      el(
        'div',
        { class: 'cluster', style: { padding: '0 var(--space-3)' } },
        ...SUGGESTIONS.map((s) =>
          el('button', { class: 'chip', type: 'button', onclick: () => { input.value = s; run(s); } }, s),
        ),
      ),
    );
    refreshIcons();
  }

  function renderResults(result) {
    clearNode(results);
    flatResults = [];
    activeIndex = -1;
    commandMode = false;
    const groups = Object.entries(result.groups).filter(([, items]) => items.length);

    if (!groups.length) {
      results.append(
        el(
          'div',
          { class: 'state-block', style: { margin: 'var(--space-4) auto' } },
          el('span', { class: 'state-icon' }, icon('search-check')),
          el('h3', { style: { fontSize: '1.05rem' } }, `No results for “${truncate(result.query, 40)}”`),
          el('p', {}, 'Try a different spelling, a broader term, or explore by category instead.'),
          el('a', { class: 'btn btn-soft btn-sm', href: '/discover' }, 'Open Discover'),
        ),
      );
      refreshIcons();
      return;
    }

    if (result.failures.length) {
      results.append(
        el(
          'div',
          { class: 'notice is-warning', style: { margin: 'var(--space-2)' } },
          icon('alert-triangle'),
          el('span', {}, `${result.failures.map((f) => f.label).join(', ')} unavailable — other sources shown.`),
        ),
      );
    }

    for (const [group, items] of groups) {
      const meta = GROUP_META[group];
      results.append(
        el(
          'p',
          { class: 'result-group-label' },
          icon(meta?.icon || 'search'),
          `${ENTITY_LABELS[group] || group} `,
          el('span', { class: 'muted numeric' }, items.length),
        ),
      );
      const shown = items.slice(0, 4);
      for (const item of shown) {
        const node = resultItem(meta?.routeEntity || group, item);
        results.append(node);
        if (node.tagName === 'A') flatResults.push(node);
      }
    }

    const total = Object.values(result.groups).reduce((sum, list) => sum + list.length, 0);
    const viewAll = el(
      'button',
      { class: 'btn btn-soft', type: 'button', style: { margin: 'var(--space-3) auto', display: 'flex', width: 'calc(100% - 1.5rem)' } },
      `View all ${total} result${total === 1 ? '' : 's'}`,
      icon('arrow-right'),
    );
    viewAll.addEventListener('click', () => {
      saveRecent(input.value);
      close();
      navigate(`/search?q=${encodeURIComponent(input.value.trim())}`);
    });
    results.append(viewAll);
    refreshIcons();
  }

  async function run(query) {
    const raw = String(query || '');
    const q = raw.trim();
    if (raw.trimStart().startsWith('>')) {
      const term = q.replace(/^>\s*/, '').toLowerCase();
      const filtered = COMMANDS.filter((c) => !term || c.label.toLowerCase().includes(term) || (c.hint || '').toLowerCase().includes(term));
      controller?.abort();
      spinner.setAttribute('hidden', '');
      renderCommands(filtered);
      return;
    }
    if (q.length < 2) {
      controller?.abort();
      spinner.setAttribute('hidden', '');
      renderIdle();
      return;
    }
    controller?.abort();
    controller = new AbortController();
    spinner.removeAttribute('hidden');
    clearNode(results);
    results.append(
      el('div', { class: 'stack-3', style: { padding: 'var(--space-4)' }, role: 'status' },
        el('span', { class: 'spinner' }),
        el('span', { class: 'muted', style: { fontSize: 'var(--text-sm)' } }, `Searching “${truncate(q, 40)}” across providers…`),
      ),
    );
    try {
      const result = await unifiedSearch(q, { signal: controller.signal });
      if (controller.signal.aborted) return;
      renderResults(result);
    } catch (err) {
      if (err?.name === 'AbortError') return;
      clearNode(results);
      results.append(
        el(
          'div',
          { class: 'state-block is-error' },
          el('span', { class: 'state-icon' }, icon('alert-triangle')),
          el('h3', { style: { fontSize: '1.05rem' } }, 'Search failed'),
          el('p', {}, 'Providers could not be reached. Check your connection and try again.'),
        ),
      );
      refreshIcons();
    } finally {
      spinner.setAttribute('hidden', '');
    }
  }

  const debouncedRun = debounce(run, 250);
  input.addEventListener('input', () => debouncedRun(input.value));
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      const q = input.value.trim();
      if (activeIndex >= 0 && flatResults[activeIndex]) {
        flatResults[activeIndex].click();
      } else if (commandMode && flatResults.length) {
        flatResults[0].click();
      } else if (q.length >= 2 && !commandMode) {
        saveRecent(q);
        close();
        navigate(`/search?q=${encodeURIComponent(q)}`);
      }
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!flatResults.length) return;
      activeIndex = event.key === 'ArrowDown'
        ? (activeIndex + 1) % flatResults.length
        : (activeIndex - 1 + flatResults.length) % flatResults.length;
      flatResults.forEach((node, i) => node.classList.toggle('is-active', i === activeIndex));
      flatResults[activeIndex].scrollIntoView({ block: 'nearest' });
    }
  });

  renderIdle();
  if (initialQuery) run(initialQuery);
}
