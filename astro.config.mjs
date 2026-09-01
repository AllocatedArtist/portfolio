import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import glsl from 'vite-plugin-glsl';

export default defineConfig({
  site: 'https://allocatedartist.github.io/portfolio',
  base: '/portfolio',
  integrations: [sitemap()],
  vite: {
    plugins: [glsl({ compress: true })],
    // Without this the minifier emits `@media (width<=760px)` range syntax,
    // which needs iOS Safari 16.4+. Anything older gets NO responsive rules
    // at all, which fails silently and looks like the CSS is broken.
    // Targeting safari14 forces the legacy `max-width` form. It costs a few
    // bytes and changes nothing on modern browsers.
    build: { cssTarget: ['safari14', 'chrome87', 'firefox78', 'edge88'] },
  },
});
