// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  // Canonical origin. Every canonical tag and sitemap entry uses this host.
  site: 'https://findfrolf.com',

  // One URL per page, with no trailing slash.
  //
  // With the default `build.format: 'directory'`, Astro emits `/co/index.html`
  // and Cloudflare Pages 308-redirects `/co` → `/co/`. The sitemap, canonical
  // tags, and every internal link use `/co`, so every URL we told Google about
  // was a redirect. Emitting `/co.html` makes Cloudflare Pages serve `/co`
  // directly (200) and redirect `/co/` → `/co`, matching our canonical form.
  trailingSlash: 'never',
  build: {
    format: 'file',
  },

  vite: {
    plugins: [tailwindcss()],
    cacheDir: 'node_modules/.vite-cache-clean',
    optimizeDeps: {
      entries: ['src/**/*.{astro,ts,js,mjs}'],
      exclude: ['absent-apogee'],
    },
    server: {
      fs: {
        ignore: ['absent-apogee', 'docs'],
      },
    },
  },
});
