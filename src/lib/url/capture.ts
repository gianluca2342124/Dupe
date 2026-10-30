/**
 * "Prefix trick" capture: `gemelu.com/https://www.ikea.com/es/es/p/…`.
 *
 * Runs in the Worker entry *before* Astro sees the request, reading the raw
 * request URL so that framework-level normalisation (duplicate-slash
 * collapsing, trailing-slash redirects) cannot corrupt the embedded URL.
 *
 * What the browser does not send can't be recovered: fragments (`#…`) never
 * reach the server, and some intermediaries may merge `//` into `/`. We
 * therefore also accept `https:/host/…`, fully percent-encoded URLs and bare
 * hosts (`gemelu.com/www.ikea.com/…`).
 */

export type CaptureForm = 'scheme' | 'encoded' | 'bare-host';

export interface CaptureResult {
  /** Embedded URL as a string (scheme restored, still possibly percent-encoded). */
  target: string;
  form: CaptureForm;
}

/** First path segments owned by the app — never interpreted as embedded URLs. */
const RESERVED_SEGMENTS = new Set([
  'buscar',
  'api',
  'go',
  'admin',
  '_astro',
  '_image',
  '_server-islands',
  'ejemplo',
  'como-funciona',
  'privacidad',
  'aviso-legal',
  'condiciones',
  'afiliacion',
  'cookies',
  'contacto',
  'empresa',
  'bot',
  'og',
  'brand',
  'demo-img',
  '.well-known',
]);

/** "TLDs" that are actually file extensions of our static files. */
const FILE_EXTENSIONS = new Set([
  'xml', 'txt', 'svg', 'png', 'jpg', 'jpeg', 'webp', 'gif', 'ico', 'avif', 'js', 'mjs', 'css', 'json',
  'webmanifest', 'map', 'woff', 'woff2', 'ttf', 'otf', 'html', 'htm', 'pdf', 'mp4', 'webm',
]);

const BARE_HOST_RE = /^(?:www\d?\.)?(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+([a-z]{2,24})(?=$|[/?:])/i;

/** Splits a raw request URL into "everything after the origin" without parsing the path. */
function pathAndQuery(rawUrl: string): string | null {
  const schemeEnd = rawUrl.indexOf('://');
  if (schemeEnd < 0) return null;
  const pathStart = rawUrl.indexOf('/', schemeEnd + 3);
  if (pathStart < 0) return null;
  const hashIdx = rawUrl.indexOf('#', pathStart);
  return hashIdx >= 0 ? rawUrl.slice(pathStart, hashIdx) : rawUrl.slice(pathStart);
}

export function capturePrefixedUrl(rawRequestUrl: string): CaptureResult | null {
  const rest = pathAndQuery(rawRequestUrl);
  if (!rest || rest.length < 5) return null;
  const p = rest.replace(/^\/+/, '');

  // 1) Explicit scheme, any number of slashes after the colon: https://, https:/, https:
  const scheme = /^(https?):\/*/i.exec(p);
  if (scheme) {
    const remainder = p.slice(scheme[0].length);
    if (!remainder) return null;
    return { target: `${scheme[1]!.toLowerCase()}://${remainder}`, form: 'scheme' };
  }

  // 2) Fully percent-encoded URL: https%3A%2F%2Fwww.ikea.com%2F…
  if (/^https?%3a/i.test(p)) {
    try {
      const decoded = decodeURIComponent(p);
      const inner = /^(https?):\/*/i.exec(decoded);
      if (inner) {
        return { target: `${inner[1]!.toLowerCase()}://${decoded.slice(inner[0].length)}`, form: 'encoded' };
      }
    } catch {
      return null;
    }
    return null;
  }

  // 3) Bare host: www.ikea.com/… or ikea.com/…
  const firstSegment = p.split(/[/?]/, 1)[0]?.toLowerCase() ?? '';
  if (!firstSegment || RESERVED_SEGMENTS.has(firstSegment)) return null;
  const host = BARE_HOST_RE.exec(p);
  if (host) {
    const tld = host[1]!.toLowerCase();
    if (FILE_EXTENSIONS.has(tld)) return null;
    return { target: `https://${p}`, form: 'bare-host' };
  }
  return null;
}
