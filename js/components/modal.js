/**
 * CULINA — Modal & drawer built on the native <dialog> element:
 * focus trapping, Escape handling and inert background come for free,
 * which is exactly what WCAG 2.2 expects from accessible dialogs.
 */
import { el, icon } from '../utils/dom.js';
import { refreshIcons } from '../utils/icons.js';
import { dialogEnter, drawerEnter } from '../utils/motion.js';

/**
 * @param {{title: string, content: Node, size?: ''|'modal-wide', onClose?: () => void,
 *          initialFocus?: 'close'|'content'}} options
 * @returns {{close: () => void, dialog: HTMLDialogElement}}
 */
export function openModal({ title, content, size = '', onClose, initialFocus = 'close' }) {
  const dialogRoot = document.getElementById('dialog-root');
  const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;

  const closeButton = el(
    'button',
    { class: 'icon-btn', type: 'button', 'aria-label': 'Close dialog' },
    icon('x'),
  );

  const dialog = el(
    'dialog',
    { class: `modal ${size}`.trim(), 'aria-label': title },
    el('div', { class: 'modal-head' }, el('h2', { id: 'modal-title' }, title), closeButton),
    el('div', { class: 'modal-body' }, content),
  );

  function close() {
    if (dialog.open) dialog.close();
  }

  closeButton.addEventListener('click', close);
  // Native <dialog> handles Escape + focus trap. Backdrop click:
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) close();
  });
  dialog.addEventListener('close', () => {
    dialog.remove();
    previousFocus?.focus?.();
    onClose?.();
  });

  dialogRoot.append(dialog);
  refreshIcons();
  dialog.showModal();
  dialogEnter(dialog);

  const autofocus = content.querySelector?.('[autofocus]');
  if (initialFocus === 'content' && autofocus) autofocus.focus();
  else closeButton.focus();

  return { close, dialog };
}

/** Right-side drawer (mobile navigation). */
export function openDrawer({ title, content, onClose }) {
  const dialogRoot = document.getElementById('dialog-root');
  const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;

  const closeButton = el('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Close menu' }, icon('x'));

  const dialog = el(
    'dialog',
    { class: 'mobile-drawer', 'aria-label': title },
    el('div', { class: 'drawer-body' }, el('div', { class: 'drawer-head' }, el('span', { class: 'overline' }, title), closeButton), content),
  );

  function close() {
    if (dialog.open) dialog.close();
  }

  closeButton.addEventListener('click', close);
  dialog.addEventListener('close', () => {
    dialog.remove();
    previousFocus?.focus?.();
    onClose?.();
  });

  dialogRoot.append(dialog);
  refreshIcons();
  dialog.showModal();
  drawerEnter(dialog);
  closeButton.focus();
  return { close, dialog };
}
