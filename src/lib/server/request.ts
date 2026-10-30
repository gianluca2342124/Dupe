import type { EntryMode } from '../../types/search';

/**
 * Request helpers. The client IP is only used in-memory as a rate-limit key
 * (hashed) and is never stored or logged.
 */

export function clientKey(request: Request): string {
  return request.headers.get('cf-connecting-ip') ?? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';
}

export function deviceClass(ua: string | null): 'mobile' | 'tablet' | 'desktop' | 'bot' {
  const s = ua ?? '';
  if (/bot|crawler|spider|preview|facebookexternalhit|whatsapp|slurp|headless/i.test(s)) return 'bot';
  if (/ipad|tablet|(android(?!.*mobile))/i.test(s)) return 'tablet';
  if (/mobi|iphone|android/i.test(s)) return 'mobile';
  return 'desktop';
}

export function country(request: Request): string | null {
  const cf = (request as Request & { cf?: { country?: string } }).cf;
  return cf?.country ?? request.headers.get('cf-ipcountry') ?? null;
}

const bareHost = (host: string) => host.replace(/^www\./, '');

/**
 * Origin for shareable links: the configured site when the request is served
 * on it, otherwise the host actually serving it (workers.dev, preview URLs,
 * local), so links shared from a test deployment work before the domain does.
 */
export function publicOrigin(siteUrl: string, requestUrl: URL): string {
  return bareHost(new URL(siteUrl).hostname) === bareHost(requestUrl.hostname) ? siteUrl.replace(/\/+$/, '') : requestUrl.origin;
}

export function referrerDomain(request: Request, ownHosts: string[]): string | null {
  const ref = request.headers.get('referer');
  if (!ref) return null;
  try {
    const host = bareHost(new URL(ref).hostname);
    return ownHosts.some((h) => bareHost(h) === host) ? null : host.slice(0, 100);
  } catch {
    return null;
  }
}

export function entryModeFrom(via: string | null | undefined): EntryMode {
  return via === 'prefix' || via === 'form' || via === 'share' || via === 'example' ? via : 'direct';
}

/** Short, bounded UTM values only. */
export function utmFrom(params: URLSearchParams | Record<string, unknown>) {
  const get = (k: string) => {
    const v = params instanceof URLSearchParams ? params.get(k) : params[k];
    return typeof v === 'string' && v ? v.slice(0, 80) : null;
  };
  return { source: get('utm_source'), medium: get('utm_medium'), campaign: get('utm_campaign') };
}

export const SECURITY_HEADERS: Record<string, string> = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'x-frame-options': 'DENY',
  'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  'cross-origin-opener-policy': 'same-origin',
};
