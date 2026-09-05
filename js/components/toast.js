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

  let dismissed = false;
  function dismiss() {
    if (dismissed) return;
    dismissed = true;
    if (timer) clearTimeout(timer);
    if (node.isConnected) {
      node.style.opacity = '0';
      node.style.transform = 'translateY(8px)';
      node.style.transition = 'opacity 180ms ease, transform 180ms ease';
      setTimeout(() => node.remove(), 200);
    }
  }

  root.append(node);
  /* Keep the stack readable: at most 3 toasts, oldest yields. */
  while (root.children.length > 3) root.firstElementChild.remove();
  refreshIcons();
  toastEnter(node);
  node.addEventListener('click', (e) => {
    if (!e.target.closest('button')) dismiss();
  });

  /* Swipe away (touch or pointer drag) — follows the finger, dismisses
     past 36 px, springs back otherwise. */
  let dragStartY = null;
  node.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button')) return;
    dragStartY = e.clientY;
    node.setPointerCapture?.(e.pointerId);
    node.style.transition = 'none';
  });
  node.addEventListener('pointermove', (e) => {
    if (dragStartY === null) return;
    const dy = e.clientY - dragStartY;
    node.style.transform = `translateY(${dy}px)`;
    node.style.opacity = String(Math.max(0.25, 1 - Math.abs(dy) / 120));
  });
  const endDrag = (e) => {
    if (dragStartY === null) return;
    const dy = e.clientY - dragStartY;
    dragStartY = null;
    node.style.transition = 'transform 180ms ease, opacity 180ms ease';
    if (Math.abs(dy) > 36) {
      dismiss();
    } else {
      node.style.transform = '';
      node.style.opacity = '';
    }
  };
  node.addEventListener('pointerup', endDrag);
  node.addEventListener('pointercancel', endDrag);

  if (duration > 0) timer = setTimeout(dismiss, duration);
  return dismiss;
}
