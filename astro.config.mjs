// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import { satteri } from '@astrojs/markdown-satteri';
import { statsPlugin } from './src/lib/mdast-stats.ts';

// https://astro.build/config
export default defineConfig({
  site: 'https://www.findfrolf.com',
  trailingSlash: 'always',
  markdown: {
    // Replaces {{stats:...}} tokens in post bodies with live directory
    // counts (src/lib/stats.ts) so no hardcoded course/state counts.
    processor: satteri({ mdastPlugins: [statsPlugin] }),
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
