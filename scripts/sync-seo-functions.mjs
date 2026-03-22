/**
 * Cloudflare Pages sometimes falls back to the SPA shell for certain root files
 * (e.g. /robots.txt, /sitemap-*.xml) even when they exist in dist. Pages Functions
 * for those exact paths run first and return the built assets from dist.
 *
 * Run after `astro build` (see package.json "build" script).
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const dist = join(root, 'dist');
const fnDir = join(root, 'functions');

const textAssets = [
  { routeFile: 'robots.txt', distFile: 'robots.txt', contentType: 'text/plain; charset=utf-8' },
  {
    routeFile: 'sitemap-index.xml',
    distFile: 'sitemap-index.xml',
    contentType: 'application/xml; charset=utf-8',
  },
  {
    routeFile: 'sitemap-0.xml',
    distFile: 'sitemap-0.xml',
    contentType: 'application/xml; charset=utf-8',
  },
];

function writeTextFunction(routeFile, body, contentType) {
  const payload = JSON.stringify(body);
  const out = join(fnDir, `${routeFile}.js`);
  const src = `export async function onRequestGet() {
  return new Response(${payload}, {
    headers: {
      'Content-Type': '${contentType}',
      'Cache-Control': 'public, max-age=3600',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
`;
  writeFileSync(out, src, 'utf8');
}

function writePngFunction() {
  const pngPath = join(dist, 'og-image.png');
  if (!existsSync(pngPath)) return;

  const buf = readFileSync(pngPath);
  const b64 = buf.toString('base64');
  const b64lit = JSON.stringify(b64);
  const out = join(fnDir, 'og-image.png.js');
  const src = `export async function onRequestGet() {
  const b64 = ${b64lit};
  const binary = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return new Response(binary, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=86400',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
`;
  writeFileSync(out, src, 'utf8');
}

if (!existsSync(dist)) {
  console.error('[sync-seo-functions] dist/ missing — run astro build first.');
  process.exit(1);
}

mkdirSync(fnDir, { recursive: true });

for (const { routeFile, distFile, contentType } of textAssets) {
  const p = join(dist, distFile);
  if (!existsSync(p)) {
    console.error(`[sync-seo-functions] Missing dist file: ${distFile}`);
    process.exit(1);
  }
  const body = readFileSync(p, 'utf8');
  writeTextFunction(routeFile, body, contentType);
}

writePngFunction();

console.log('[sync-seo-functions] Wrote SEO Pages Functions from dist/.');
