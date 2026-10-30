/**
 * Minimal public-suffix handling for the markets we care about.
 *
 * A full Public Suffix List (~200 KB) is unnecessary in the Worker: we only
 * need a stable "registrable domain" for store detection, caching keys and
 * host policies. Multi-label suffixes common in Europe/LatAm are listed here;
 * everything else falls back to the last two labels.
 */
const MULTI_LABEL_SUFFIXES = new Set([
  'co.uk',
  'org.uk',
  'ac.uk',
  'gov.uk',
  'com.es',
  'nom.es',
  'org.es',
  'gob.es',
  'edu.es',
  'com.pt',
  'com.br',
  'com.mx',
  'com.ar',
  'com.co',
  'com.au',
  'co.jp',
  'co.nz',
  'com.tr',
  'com.cn',
  'com.hk',
  'co.in',
  'co.za',
  'com.sg',
  'com.pl',
  'myshopify.com',
  'pages.dev',
  'workers.dev',
  'github.io',
  'vercel.app',
  'netlify.app',
]);

export function getRegistrableDomain(hostname: string): string {
  const host = hostname.toLowerCase().replace(/\.+$/, '');
  const labels = host.split('.');
  if (labels.length <= 2) return host;
  const lastTwo = labels.slice(-2).join('.');
  if (MULTI_LABEL_SUFFIXES.has(lastTwo)) return labels.slice(-3).join('.');
  return lastTwo;
}

/** "www.ikea.com" → "ikea.com"; keeps other subdomains intact. */
export function stripWww(hostname: string): string {
  return hostname.replace(/^www\d?\./i, '');
}
