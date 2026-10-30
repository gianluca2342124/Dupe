import { decodeEntities } from '../extraction/entities';

/**
 * Sanitisation for any text or URL that originates outside our code
 * (store pages, provider APIs, feeds). Output is plain text: we never render
 * third-party HTML. Astro/React escape on render; this layer additionally
 * strips markup, control characters and absurd lengths.
 */

// eslint-disable-next-line no-control-regex -- stripping control characters is the point
const CONTROL_CHARS = new RegExp('[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F\\u007F-\\u009F\\u200B-\\u200F\\u2028\\u2029\\u202A-\\u202E\\u2066-\\u2069\\uFEFF]', 'g');

export function cleanText(input: unknown, maxLength = 500): string | null {
  if (input === null || input === undefined) return null;
  let s = typeof input === 'string' ? input : typeof input === 'number' ? String(input) : null;
  if (s === null) return null;
  s = s.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ');
  s = s.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, ' ');
  s = decodeEntities(s);
  s = s.replace(CONTROL_CHARS, '').replace(/\s+/g, ' ').trim();
  if (!s) return null;
  if (s.length > maxLength) s = `${s.slice(0, maxLength - 1).trimEnd()}…`;
  return s;
}

/**
 * Accepts only absolute http(s) URLs (optionally resolving relative ones
 * against `base`). Rejects javascript:, data:, credentials and oversize input.
 */
export function cleanUrl(input: unknown, base?: string, maxLength = 2048): string | null {
  if (typeof input !== 'string') return null;
  const raw = decodeEntities(input.trim());
  if (!raw || raw.length > maxLength) return null;
  let url: URL;
  try {
    url = base ? new URL(raw.startsWith('//') ? `https:${raw}` : raw, base) : new URL(raw.startsWith('//') ? `https:${raw}` : raw);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  if (url.username || url.password) return null;
  return url.href;
}

/** Image URLs: same as cleanUrl, upgrading to https when the host supports it is not assumed. */
export function cleanImageUrl(input: unknown, base?: string): string | null {
  const url = cleanUrl(input, base);
  if (!url) return null;
  // Skip tracking pixels, sprites and obvious placeholders.
  if (/(?:pixel|spacer|blank|placeholder|transparent)\.(?:gif|png)/i.test(url)) return null;
  return url;
}

export function clampNumber(n: unknown, min: number, max: number): number | null {
  const v = typeof n === 'string' ? Number(n) : n;
  if (typeof v !== 'number' || !Number.isFinite(v)) return null;
  if (v < min || v > max) return null;
  return v;
}
