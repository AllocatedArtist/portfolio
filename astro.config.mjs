import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import glsl from 'vite-plugin-glsl';

export default defineConfig({
  site: 'https://sevenf.github.io',
  integrations: [sitemap()],
  vite: { plugins: [glsl({ compress: true })] },
});
