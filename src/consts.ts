export const SITE_URL = 'https://prsmstudios.io';

// Must be an absolute path from the site root (works well with static hosts like Cloudflare Pages).
export const OG_IMAGE = '/og/prsmstudios-og.svg';

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

