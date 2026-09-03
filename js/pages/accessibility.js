/**
 * CULINA — Accessibility statement (WCAG 2.2 AA targets).
 */
import { applyMeta } from '../seo.js';
import { docPage } from './shared.js';

export async function render(ctx) {
  applyMeta({
    title: 'Accessibility',
    description: 'CULINA’s accessibility commitment: WCAG 2.2 AA targets, keyboard support, reduced motion, contrast and touch-target standards.',
    path: '/accessibility',
  });

  return docPage({
    overline: 'Built for everyone',
    title: 'Accessibility',
    lead: 'CULINA targets WCAG 2.2 Level AA. This statement explains what that means in practice and how to tell us when we fall short.',
    updated: '3 September 2026',
    sections: [
      {
        title: 'Conformance target',
        body: [
          'The application is designed and tested against the Web Content Accessibility Guidelines (WCAG) 2.2 at Level AA. Conformance is a continuous process — if you find a barrier, please report it via the project repository.',
        ],
      },
      {
        title: 'What we do',
        list: [
          'Semantic landmarks, a skip-to-content link and logical heading hierarchy on every page',
          'Full keyboard operation — navigation, tabs, dialogs, the command palette and the meal planner all work without a mouse',
          'Visible focus indicators on every interactive element',
          'Native <dialog> elements for modals and drawers, with focus containment and Escape to close',
          'Text alternatives for images and aria-live announcements for async status changes',
          'Color contrast of at least 4.5:1 for text in both light and dark themes',
          'Touch targets of at least 44 × 44 CSS pixels, larger for primary actions',
          'prefers-reduced-motion respected — transitions and reveals are suppressed or shortened',
          'Never relying on color alone to communicate status',
        ],
      },
      {
        title: 'Known considerations',
        body: [
          'Third-party images arrive from data providers and inherit their quality; when an image is missing, a designed typographic placeholder is shown instead.',
          'The meal planner supports drag & drop but always provides equivalent button controls (move, duplicate, remove) so pointer interaction is never required.',
        ],
      },
      {
        title: 'Settings that help',
        body: [
          'Larger text mode (Settings → Accessibility) increases the base type size across the application. Your operating system’s reduced-motion preference is honored automatically.',
        ],
      },
    ],
  });
}
