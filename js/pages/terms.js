/**
 * CULINA — Terms of use.
 */
import { applyMeta } from '../seo.js';
import { docPage } from './shared.js';

export async function render(ctx) {
  applyMeta({
    title: 'Terms',
    description: 'Terms of use for CULINA — an open-data food discovery demonstration product.',
    path: '/terms',
  });

  return docPage({
    overline: 'The fine print, kept readable',
    title: 'Terms of use',
    lead: 'CULINA aggregates third-party open data for discovery purposes. These terms explain what that means for you.',
    updated: '3 September 2026',
    sections: [
      {
        title: 'The service',
        body: [
          'CULINA (“the service”) is a food and drink discovery interface that aggregates publicly available data from independent providers including TheMealDB, TheCocktailDB, Fruityvice, Foodish, Open Brewery DB, Open Food Facts and SampleAPIs. The service is provided as-is, without warranty of any kind.',
        ],
      },
      {
        title: 'No professional advice',
        body: [
          'Recipes, nutrition information and product data are provided by their sources and may be incomplete, inaccurate or out of date. Nothing in CULINA constitutes dietary, medical, allergen or food-safety advice. Always check product labels and use your own judgment — especially regarding allergies and dietary restrictions.',
        ],
      },
      {
        title: 'Data ownership and attribution',
        body: [
          'All recipes, images, product data and other content accessed through CULINA remain the property of their respective providers. Every result card carries a source badge and detail pages include full attribution panels. Open Food Facts data is licensed under the Open Database License (ODbL) v1.0.',
          'You are responsible for complying with each provider’s terms when using their data.',
        ],
      },
      {
        title: 'Acceptable use',
        list: [
          'Do not use the service in a way that abuses provider rate limits',
          'Do not misrepresent CULINA as affiliated with any data provider',
          'Do not scrape or resell provider data through the service',
        ],
      },
      {
        title: 'Availability',
        body: [
          'CULINA depends on third-party providers that may change, degrade or disappear without notice. Features may be reduced or disabled accordingly, and no availability is guaranteed.',
        ],
      },
      {
        title: 'Limitation of liability',
        body: [
          'To the maximum extent permitted by law, the maintainers of CULINA accept no liability for any loss or harm arising from use of the service or reliance on its content.',
        ],
      },
    ],
  });
}
