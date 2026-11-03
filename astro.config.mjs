// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import { satteri } from '@astrojs/markdown-satteri';
import { statsPlugin } from './src/lib/mdast-stats.ts';
import { datashowsPlugin } from './src/lib/mdast-datashows.ts';

// https://astro.build/config
export default defineConfig({
  site: 'https://www.findfrolf.com',
  trailingSlash: 'always',
  markdown: {
    // mdast plugins replace {{stats:...}} tokens and :::datashows boxes in
    // post bodies with live values from the committed hub/course data
    // (src/lib/stats.ts, src/lib/mdast-datashows.ts).
    processor: satteri({
      features: { directive: true },
      mdastPlugins: [statsPlugin, datashowsPlugin],
    }),
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
