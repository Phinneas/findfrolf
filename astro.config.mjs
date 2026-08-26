// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
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
