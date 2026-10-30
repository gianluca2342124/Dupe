/**
 * Single source of truth for the brand.
 *
 * Changing the product name or domain only requires editing this file
 * (plus the deployment domain in wrangler.jsonc / Cloudflare dashboard).
 * Everything user-facing — copy, metadata, legal pages, OG tags, share
 * texts — reads from here.
 */
export const BRAND = {
  /** Display name, as written in running text. */
  name: 'Gemelu',
  /** Lowercase wordmark used in the logo and in the "prefix trick". */
  wordmark: 'gemelu',
  /** Production domain (no protocol). Used for the prefix trick copy and canonical URLs. */
  domain: 'gemelu.com',
  /** Canonical site origin. Overridable at runtime via PUBLIC_SITE_URL. */
  siteUrl: 'https://gemelu.com',
  /** Short promise used in the hero and <title>. */
  tagline: 'Lo mismo. Por mucho menos.',
  /** One-line explanation used in meta descriptions and the hero subtitle. */
  description:
    'Encuentra alternativas casi idénticas a los productos que te gustan, sin pagar de más.',
  /** Positioning statement (internal + about page). */
  positioning: 'Descubre lo mismo por mucho menos.',
  locale: 'es-ES',
  language: 'es',
  currency: 'EUR',
  country: 'ES',
  /** Social handles are placeholders until the accounts exist. */
  social: {
    tiktok: '',
    instagram: '',
  },
  /** Contact address shown in legal pages. Must be completed before launch. */
  contactEmail: 'hola@gemelu.com',
  /** Brand colours (mirrors the CSS tokens in src/styles/global.css). */
  colors: {
    paper: '#FAF8F4',
    ink: '#1A1915',
    terracotta: '#B4532F',
    save: '#1D6B47',
  },
} as const;

export type Brand = typeof BRAND;

/** "gemelu.com/" — the string users add in front of a product link. */
export const PREFIX_TRICK = `${BRAND.domain}/`;
