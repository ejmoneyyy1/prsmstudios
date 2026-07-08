// @ts-check
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import tailwind from '@astrojs/tailwind';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://prsmstudios.io',
  /** Aligns URLs with robots/sitemap (no trailing slash on paths). */
  trailingSlash: 'never',
  // Cloudflare adapter enables on-demand SSR for individual pages (e.g. /pay/...)
  // while the rest of the site stays fully prerendered (static).
  adapter: cloudflare(),
  integrations: [
    tailwind(),
    // @astrojs/sitemap must stay LAST — it runs after routes are finalized.
    // Exclude redirect stubs and legal/utility pages — only index real content.
    sitemap({
      filter: (page) => ![
        'https://prsmstudios.io/consultation',
        'https://prsmstudios.io/cloud-native-scale',
        'https://prsmstudios.io/privacy',
        'https://prsmstudios.io/terms',
        'https://prsmstudios.io/404',
      ].includes(page) && !page.startsWith('https://prsmstudios.io/pay/'),
    }),
  ],
  vite: {
    optimizeDeps: {
      include: [
        'three',
        'three/examples/jsm/postprocessing/EffectComposer.js',
        'three/examples/jsm/postprocessing/RenderPass.js',
        'three/examples/jsm/postprocessing/ShaderPass.js',
        'three/examples/jsm/shaders/RGBShiftShader.js',
        'three/examples/jsm/lights/RectAreaLightUniformsLib.js',
      ],
    },
    ssr: {
      optimizeDeps: {
        include: ['three'],
      },
    },
  },
});
