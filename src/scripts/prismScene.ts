/**
 * Thin entry: dynamic import keeps `three` + postprocessing out of the dev SSR
 * module-runner graph when Astro resolves Hero → PrismScene (avoids Vite’s
 * default 60s `fetchModule` timeout on cold/large transforms).
 */
void import('./prismSceneCore.ts');
