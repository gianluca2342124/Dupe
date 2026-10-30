// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import cloudflare from '@astrojs/cloudflare';
import tailwindcss from '@tailwindcss/vite';

const SITE_URL = process.env.PUBLIC_SITE_URL || 'https://gemelu.com';

// Routes that must never appear in the sitemap (ephemeral, private or utility pages).
const SITEMAP_EXCLUDE = ['/buscar', '/go/', '/admin', '/api/', '/ejemplo/', '/404', '/500'];

export default defineConfig({
  site: SITE_URL,
  // Pages are server-rendered on demand unless they opt into `prerender = true`.
  // Static pages (home, legal, how-it-works) are prerendered and served from
  // Cloudflare's static asset layer without invoking the Worker.
  output: 'server',
  trailingSlash: 'never',
  build: {
    format: 'file',
    inlineStylesheets: 'auto',
  },
  // We don't use Astro sessions: no KV binding, no cookies.
  session: false,
  adapter: cloudflare({
    // Product images come from third-party CDNs and our own SVGs; no image
    // transformation service is needed (keeps the free tier free).
    imageService: 'passthrough',
  }),
  integrations: [
    react(),
    sitemap({
      filter: (page) => !SITEMAP_EXCLUDE.some((p) => new URL(page).pathname.startsWith(p)),
      changefreq: 'weekly',
      i18n: undefined,
    }),
  ],
  prefetch: {
    prefetchAll: false,
    defaultStrategy: 'hover',
  },
  devToolbar: { enabled: false },
  vite: {
    plugins: [tailwindcss()],
  },
});
