import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import glsl from 'vite-plugin-glsl';

export default defineConfig({
  site: 'https://allocatedartist.github.io',
  base: '/portfolio',
  integrations: [sitemap()],
  vite: { plugins: [glsl({ compress: true })] },
});
