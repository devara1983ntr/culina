/**
 * CULINA — Image lightbox: tap any hero photo to view it enlarged.
 * Built on the accessible <dialog> modal (focus trap + Escape for free).
 * Enhancement only — every image is already visible inline; the lightbox
 * never gates content behind a gesture.
 */
import { el } from '../utils/dom.js';
import { openModal } from './modal.js';
import { safeUrl } from '../utils/format.js';

export function openLightbox(src, alt) {
  const url = safeUrl(src);
  if (!url) return;
  const img = el('img', {
    class: 'lightbox-img',
    src: url,
    alt: alt ? `${alt} (enlarged)` : 'Enlarged photo',
    decoding: 'async',
    referrerpolicy: 'no-referrer',
  });
  const { close, dialog } = openModal({
    title: alt || 'Photo',
    content: el(
      'div',
      { class: 'lightbox-body' },
      img,
      el('p', { class: 'muted lightbox-hint' }, 'Tap the photo, click the backdrop or press Escape to close.'),
    ),
    size: 'modal-wide',
  });
  dialog.classList.add('lightbox-modal');
  img.addEventListener('click', close);
  img.addEventListener('error', () => {
    img.replaceWith(
      el('p', { class: 'muted', style: { padding: 'var(--space-5)', textAlign: 'center' } },
        'This photo couldn’t be enlarged — the provider’s image is temporarily unavailable.'),
    );
  });
}

/**
 * Wire lightbox behaviour for the photos inside `root` (detail heroes,
 * featured cards). Uses click delegation, so images injected later by
 * async providers are covered automatically. Returns nothing — cleanup is
 * registered through ctx.
 */
export function mountImageLightbox(ctx, root) {
  if (!root) return;
  const onClick = (event) => {
    const img = event.target instanceof Element ? event.target.closest('.detail-hero-media img, .featured-media img') : null;
    if (!img || !root.contains(img)) return;
    openLightbox(img.currentSrc || img.src, img.alt || '');
  };
  root.addEventListener('click', onClick);
  ctx?.onCleanup?.(() => root.removeEventListener('click', onClick));
}
