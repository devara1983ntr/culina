import { defineConfig } from 'vite';

/**
 * Providers that are CORS-restricted in the browser are reached through a
 * same-origin gateway path (/api/<provider>) instead of the third-party origin.
 * In dev/preview this is provided by the proxy below; in production it is
 * provided by server.js (the minimal gateway described in PRD §72/§74):
 *
 *   Browser → /api/fruityvice/* → https://www.fruityvice.com/*
 *
 * Verified 2026-09-02: Fruityvice serves no Access-Control-Allow-Origin header,
 * so direct browser calls are blocked (see docs/API-VERIFICATION.md).
 */
const providerProxy = {
  '/api/fruityvice': {
    target: 'https://www.fruityvice.com',
    changeOrigin: true,
    rewrite: (p) => p.replace(/^\/api\/fruityvice/, ''),
  },
};

export default defineConfig({
  build: {
    target: 'es2020',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['motion', 'lucide', 'sortablejs'],
        },
      },
    },
  },
  server: { host: true, allowedHosts: true, proxy: providerProxy },
  preview: { host: true, allowedHosts: true, proxy: providerProxy },
});
