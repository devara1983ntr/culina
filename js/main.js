/**
 * CULINA — application entry point.
 * Fonts (self-hosted, OFL-licensed via @fontsource: Playfair Display + Inter) →
 * design system CSS → app.
 */

/* Typography */
import '@fontsource/playfair-display/400.css';
import '@fontsource/playfair-display/500.css';
import '@fontsource/playfair-display/600.css';
import '@fontsource/playfair-display/700.css';
import '@fontsource/playfair-display/400-italic.css';
import '@fontsource/inter/300.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';

/* Design system */
import '../css/tokens.css';
import '../css/reset.css';
import '../css/base.css';
import '../css/layout.css';
import '../css/components.css';
import '../css/pages.css';
import '../css/expansion.css';
import '../css/gestures.css';
import '../css/utilities.css';
import '../css/responsive.css';

import { boot } from './app.js';
import { basePath } from './router.js';

/* Dismiss the boot splash. Fired as soon as the first route mounts its
   skeleton (culina:app-ready — before provider data resolves), with boot()
   completion as a backstop. Idempotent. */
function dismissBootSplash() {
  const splash = document.getElementById('boot-splash');
  if (!splash) return;
  splash.classList.add('is-done');
  splash.addEventListener('transitionend', () => splash.remove(), { once: true });
  setTimeout(() => splash.remove(), 900); // failsafe (transition may not fire under reduced motion)
}
document.addEventListener('culina:app-ready', dismissBootSplash, { once: true });

/* Service worker — production only, so dev HMR stays predictable (PRD §45).
   Registered at module level with a readyState guard: attaching a `load`
   listener from inside boot().then() races the load event — on a fast load
   with slow provider data the event fires first and registration is
   silently skipped forever (found by the image-blocked E2E context). */
const isLocal = ['localhost', '127.0.0.1'].includes(location.hostname);
if (import.meta.env.PROD && 'serviceWorker' in navigator && (location.protocol === 'https:' || isLocal)) {
  const registerSW = () => {
    navigator.serviceWorker.register((basePath() || '') + '/sw.js').catch((err) => {
      console.warn('[pwa] service worker registration failed', err);
    });
  };
  if (document.readyState === 'complete') registerSW();
  else window.addEventListener('load', registerSW, { once: true });
}

boot()
  .catch((err) => {
    console.error('[boot] failed to start', err);
  })
  .then(() => {
  dismissBootSplash();
});
