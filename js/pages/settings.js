/**
 * CULINA — Settings (/settings, PRD §23).
 * Appearance (light/dark/system), accessibility, data controls
 * (history toggle, export/import/reset) with destructive-action warnings.
 */
import { el, icon } from '../utils/dom.js';
import { refreshIcons } from '../utils/icons.js';
import { applyMeta } from '../seo.js';
import { settingsService } from '../services/settings.js';
import { history } from '../services/history.js';
import { favorites } from '../services/favorites.js';
import { planner } from '../services/planner.js';
import { shoppingList } from '../services/shoppingList.js';
import { toast } from '../components/toast.js';
import { pageHeader } from './shared.js';
import { STORAGE_KEYS } from '../constants.js';
import { read, write } from '../storage.js';

const THEME_OPTIONS = [
  { id: 'light', label: 'Light', description: 'Warm paper whites — the editorial default.' },
  { id: 'dark', label: 'Dark', description: 'Espresso tones for evening browsing.' },
  { id: 'system', label: 'System', description: 'Follow your device’s setting automatically.' },
];

function settingRow({ title, description, control }) {
  return el(
    'div',
    { class: 'setting-row' },
    el('div', { class: 'setting-copy' }, el('strong', {}, title), description ? el('span', { class: 'muted', style: { display: 'block', fontSize: 'var(--text-sm)' } }, description) : null),
    el('div', { class: 'setting-control' }, control),
  );
}

export async function render(ctx) {
  applyMeta({
    robots: 'noindex',
    title:
    'Settings',
    description: 'Appearance, accessibility and data controls — everything on this device, nothing in the cloud.',
    path: '/settings',
  });

  const settingsHost = el('div');
  const dataHost = el('div');

  const root = el(
    'div',
    { class: 'page' },
    el(
      'div',
      { class: 'container', style: { maxWidth: '760px' } },
      pageHeader({
        overline: 'Your device, your rules',
        title: 'Settings',
        lead: 'Appearance, accessibility and data — all stored locally under culina:v1:* keys. Nothing here syncs anywhere.',
      }),
      el('h2', { class: 'settings-group-title' }, icon('palette'), 'Appearance'),
      settingsHost,
      el('h2', { class: 'settings-group-title' }, icon('database'), 'Your data'),
      dataHost,
    ),
  );

  function renderSettings() {
    const current = settingsService.get();
    settingsHost.replaceChildren(
      settingRow({
        title: 'Theme',
        description: THEME_OPTIONS.find((t) => t.id === current.theme)?.description,
        control: el(
          'div',
          { class: 'segmented', role: 'radiogroup', 'aria-label': 'Theme' },
          ...THEME_OPTIONS.map((option) =>
            el('button', {
              class: 'segmented-btn',
              type: 'button',
              role: 'radio',
              'aria-checked': String(current.theme === option.id),
              onclick: () => {
                settingsService.set({ theme: option.id });
                renderSettings();
              },
            }, option.label),
          ),
        ),
      }),
      settingRow({
        title: 'Larger text',
        description: 'Increases the base type size across the application.',
        control: el('button', {
          class: `btn ${current.largerText ? 'btn-primary' : 'btn-secondary'} btn-sm`,
          type: 'button',
          'aria-pressed': String(current.largerText),
          onclick: () => {
            settingsService.set({ largerText: !current.largerText });
            renderSettings();
          },
        }, current.largerText ? 'On' : 'Off'),
      }),
      settingRow({
        title: 'Search & view history',
        description: `Remember your last searches and viewed items on this device. ${history.isEnabled() ? `Currently keeping ${history.counts().searches} searches and ${history.counts().views} views.` : 'Currently disabled.'}`,
        control: el('button', {
          class: `btn ${current.historyEnabled ? 'btn-primary' : 'btn-secondary'} btn-sm`,
          type: 'button',
          'aria-pressed': String(current.historyEnabled),
          onclick: () => {
            settingsService.set({ historyEnabled: !current.historyEnabled });
            renderSettings();
            renderData();
          },
        }, current.historyEnabled ? 'On' : 'Off'),
      }),
      el('p', { class: 'muted', style: { fontSize: 'var(--text-sm)', marginTop: 'var(--space-3)' } },
        'Reduced motion follows your operating system setting automatically — there is no need to configure it here.'),
    );
    refreshIcons();
  }

  function renderData() {
    const favCount = favorites.total();
    const planCount = planner.itemCount();
    const historyCounts = history.counts();
    const shoppingState = shoppingList.state();

    const exportButton = el('button', { class: 'btn btn-secondary', type: 'button' }, icon('download'), 'Export data');
    exportButton.addEventListener('click', exportData);

    const importInput = el('input', { type: 'file', accept: 'application/json', class: 'visually-hidden', id: 'import-file', 'aria-label': 'Import data file' });
    const importButton = el('button', { class: 'btn btn-secondary', type: 'button' }, icon('upload'), 'Import data');
    importButton.addEventListener('click', () => importInput.click());
    importInput.addEventListener('change', () => importData(importInput));

    const resetButton = el('button', { class: 'btn btn-danger', type: 'button' }, icon('trash-2'), 'Reset all data');
    resetButton.addEventListener('click', resetAll);

    dataHost.replaceChildren(
      el(
        'div',
        { class: 'settings-data-grid' },
        el('div', { class: 'stat-block card' }, el('span', { class: 'stat-value' }, String(favCount)), el('span', { class: 'stat-label' }, 'Favorites')),
        el('div', { class: 'stat-block card' }, el('span', { class: 'stat-value' }, String(planCount)), el('span', { class: 'stat-label' }, 'Planned dishes')),
        el('div', { class: 'stat-block card' }, el('span', { class: 'stat-value' }, String(shoppingState.manual.length)), el('span', { class: 'stat-label' }, 'Manual list items')),
        el('div', { class: 'stat-block card' }, el('span', { class: 'stat-value' }, String(historyCounts.searches + historyCounts.views)), el('span', { class: 'stat-label' }, 'History entries')),
      ),
      el(
        'div',
        { class: 'cluster', style: { flexWrap: 'wrap', marginTop: 'var(--space-4)' } },
        exportButton,
        importButton,
        importInput,
        resetButton,
      ),
      el('p', { class: 'muted', style: { fontSize: 'var(--text-sm)', marginTop: 'var(--space-3)' } },
        'Export downloads a JSON snapshot of favorites, planner, shopping list, history and settings. Import restores them on this device. Reset clears every culina:v1:* key — this cannot be undone.'),
    );
    refreshIcons();
  }

  function exportData() {
    try {
      const payload = {
        app: 'CULINA',
        version: 1,
        exportedAt: new Date().toISOString(),
        data: {
          settings: read(STORAGE_KEYS.settings, null),
          favorites: read(STORAGE_KEYS.favorites, null),
          planner: read(STORAGE_KEYS.planner, null),
          history: read(STORAGE_KEYS.history, null),
          shoppingList: read(STORAGE_KEYS.shoppingList, null),
        },
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = el('a', { href: url, download: `culina-data-${new Date().toISOString().slice(0, 10)}.json` });
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      toast('Data exported', { type: 'success' });
    } catch {
      toast('Couldn’t export your data', { type: 'error' });
    }
  }

  function importData(input) {
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        const data = parsed?.data && typeof parsed.data === 'object' ? parsed.data : null;
        if (!data || !parsed.app) throw new Error('not a CULINA export');
        const allowed = {
          [STORAGE_KEYS.settings]: data.settings,
          [STORAGE_KEYS.favorites]: data.favorites,
          [STORAGE_KEYS.planner]: data.planner,
          [STORAGE_KEYS.history]: data.history,
          [STORAGE_KEYS.shoppingList]: data.shoppingList,
        };
        let restored = 0;
        for (const [key, value] of Object.entries(allowed)) {
          if (value !== null && value !== undefined) {
            write(key, value);
            restored++;
          }
        }
        settingsService.init();
        toast(`Imported ${restored} data set${restored === 1 ? '' : 's'}`, { type: 'success' });
        renderSettings();
        renderData();
      } catch {
        toast('That file isn’t a valid CULINA export', { type: 'error' });
      } finally {
        input.value = '';
      }
    };
    reader.onerror = () => toast('Couldn’t read that file', { type: 'error' });
    reader.readAsText(file);
  }

  function resetAll() {
    const confirmed = window.confirm(
      `Reset all CULINA data on this device?\n\nThis permanently removes ${favorites.total()} favorites, ${planner.itemCount()} planned dishes, your shopping list, history and settings. This cannot be undone.`,
    );
    if (!confirmed) return;
    for (const key of Object.values(STORAGE_KEYS)) {
      try {
        window.localStorage.removeItem(key);
      } catch {
        /* private mode */
      }
    }
    settingsService.reset();
    toast('All data reset', { type: 'info' });
    renderSettings();
    renderData();
  }

  renderSettings();
  renderData();
  refreshIcons();
  return root;
}
