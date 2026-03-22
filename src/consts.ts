export const SITE_URL = 'https://prsmstudios.io';

/** Short brand name for Open Graph `og:site_name` and UI. */
export const SITE_NAME = 'PRSM Studio';

/** Default `<title>` / primary SEO title (homepage and fallback). */
export const SITE_TITLE = 'PRSM Studio | Venture Deployment & Brand Reframing';

/** Default meta description sitewide (override per page when needed). */
export const SITE_DESCRIPTION =
  'Engineering high-fidelity digital presences. We architect, rebrand, and deploy mission-critical software and apps for those who refuse to stay invisible.';

/**
 * Social share image (absolute URL built with SITE_URL).
 * Place a 1200×630 (or larger) asset at `public/og-image.png` for best results.
 */
export const OG_IMAGE = '/og-image.png';

/** @deprecated Use OG_IMAGE — kept if external links still reference the old asset. */
export const OG_IMAGE_LEGACY = '/og/prsmstudios-og.svg';

/** Public address for `mailto:` links (footer, etc.). */
export const CONTACT_EMAIL = 'eaalobuia@gmail.com';

/**
 * Optional: override audit CTAs with an external form URL instead of `/audit`.
 */
export const PRESENCE_AUDIT_FORM_URL = '';

/**
 * Cal.com — `/audit` duration picker. `embed=true` required.
 * Create three event types in Cal.com and set slugs to match (or edit these slugs below).
 * @see https://cal.com/docs/developing/guides/embeds
 */
export const CAL_USERNAME = 'ealobuia';

const CAL_EMBED_QUERY = 'embed=true&layout=month_view&theme=light&brandColor=%231A1A1A';

/** Slug segment after `/cal.com/username/` — must match each event type’s URL in Cal.com. */
export const CAL_EVENT_SLUGS = {
  '15': '15min',
  '30': '30min',
  '60': '60min',
} as const;

export type CalDurationKey = keyof typeof CAL_EVENT_SLUGS;

export function calEmbedUrl(duration: CalDurationKey): string {
  const slug = CAL_EVENT_SLUGS[duration];
  return `https://cal.com/${CAL_USERNAME}/${slug}?${CAL_EMBED_QUERY}`;
}

/** Default embed (30 min) — used by `audit.astro` until the user switches duration. */
export const CAL_BOOKING_EMBED_SRC = calEmbedUrl('30');

/** Primary destination for “Request a Presence Audit” across the site. */
export const PRESENCE_AUDIT_HREF = PRESENCE_AUDIT_FORM_URL || '/audit';

/** City Pulse on the App Store — leave empty for disabled / placeholder state. */
export const CITY_PULSE_APP_STORE_URL = '';

/** City Pulse on Google Play — leave empty for disabled / placeholder state. */
export const CITY_PULSE_PLAY_STORE_URL = '';

/** Optional looping product UI video (e.g. `/video/city-pulse-ui.mp4`). If empty, screenshot is used. */
export const CITY_PULSE_UI_VIDEO_URL = '';

/** Poster / fallback screenshot inside the device frame. */
export const CITY_PULSE_UI_SCREENSHOT = '/case-images/city-pulse-hover.svg';

/**
 * Replace with your real verification string from Google Search Console → Settings → Ownership verification.
 */
export const GOOGLE_SITE_VERIFICATION = 'GSC_VERIFICATION_HASH_HERE';
