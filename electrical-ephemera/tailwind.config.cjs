const plugin = require('tailwindcss/plugin');

// Glassmorphism preset: centralized "glass" surfaces and shadows.
const glassmorphism = {
  theme: {
    extend: {
      boxShadow: {
        'glass-lg': '0 24px 80px rgba(0, 0, 0, 0.55)',
      },
    },
  },
  plugins: [
    plugin(function ({ addUtilities }) {
      addUtilities(
        {
          '.glass-surface': {
            backdropFilter: 'blur(14px)',
            backgroundColor: 'rgba(255, 255, 255, 0.06)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            boxShadow: '0 24px 80px rgba(0, 0, 0, 0.55)',
          },
        },
        ['responsive']
      );
    }),
  ],
};

// Grainy noise SVG (feTurbulence) encoded as a data URI.
const noiseSvg = encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" width="180" height="180">
    <filter id="n">
      <feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="4" stitchTiles="stitch" />
      <feColorMatrix type="matrix" values="
        1 0 0 0 0
        0 1 0 0 0
        0 0 1 0 0
        0 0 0 .45 0" />
    </filter>
    <rect width="180" height="180" filter="url(#n)" opacity="0.55" />
  </svg>
`);

module.exports = {
  presets: [glassmorphism],
  content: [
    './src/**/*.{astro,html,js,jsx,ts,tsx}',
    './public/**/*.html',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f8fafc',
          100: '#e8eef7',
          200: '#b8c7e6',
          300: '#7ea1da',
          400: '#3f77d7',
          500: '#1f66d0',
          600: '#1650aa',
          700: '#123e83',
          800: '#0f2f63',
          900: '#0b2143',
        },
      },
    },
  },
  plugins: [
    plugin(function ({ addUtilities }) {
      addUtilities(
        {
          '.grainy-noise': {
            backgroundImage: `url("data:image/svg+xml,${noiseSvg}")`,
            backgroundSize: '240px 240px',
            opacity: '0.035',
            mixBlendMode: 'overlay',
          },
        },
        ['responsive']
      );
    }),
  ],
};

