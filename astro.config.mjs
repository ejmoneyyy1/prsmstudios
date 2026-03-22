// @ts-check
import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://prsmstudios.io',
  /** Aligns URLs with robots/sitemap (no trailing slash on paths). */
  trailingSlash: 'never',
  integrations: [
    tailwind(),
    // @astrojs/sitemap must stay LAST — it runs after routes are finalized.
    sitemap(),
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
