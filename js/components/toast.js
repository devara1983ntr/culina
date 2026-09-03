/**
 * CULINA — Toast notifications (aria-live, keyboard-dismissible).
 */
import { el, icon } from '../utils/dom.js';
import { toastEnter } from '../utils/motion.js';
import { refreshIcons } from '../utils/icons.js';

const ICONS = { success: 'circle-check', error: 'circle-x', info: 'info' };

export function toast(message, { type = 'info', duration = 3600, action, onAction } = {}) {
  const root = document.getElementById('toast-root');
  if (!root) return;

  let timer = null;
  const node = el(
    'div',
    { class: `toast is-${type}` },
    icon(ICONS[type] || ICONS.info),
    el('span', {}, message),
    action
      ? el(
          'button',
          {
            class: 'toast-action',
            type: 'button',
            onclick: () => {
              dismiss();
              onAction?.();
            },
          },
          action,
        )
      : null,
  );

  function dismiss() {
    if (timer) clearTimeout(timer);
    if (node.isConnected) {
      node.style.opacity = '0';
      node.style.transition = 'opacity 200ms ease';
      setTimeout(() => node.remove(), 220);
    }
  }

  root.append(node);
  refreshIcons();
  toastEnter(node);
  node.addEventListener('click', (e) => {
    if (!e.target.closest('button')) dismiss();
  });
  if (duration > 0) timer = setTimeout(dismiss, duration);
  return dismiss;
}
