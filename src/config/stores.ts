/**
 * Curated registry of source stores.
 *
 * Any public product URL works; this list only improves naming, URL
 * canonicalisation and expectations. `readability` documents what we observed
 * when fetching with an honest bot user agent from a datacenter IP
 * (October 2026). Stores marked `often_blocked` answer with bot-protection
 * pages (Akamai, DataDome…); Gemelu never tries to bypass those and falls back
 * to the information contained in the URL itself.
 */
export interface StoreDefinition {
  id: string;
  name: string;
  /** Registrable domains (no subdomains). */
  domains: readonly string[];
  /** Query parameters that select a product variant and must be preserved. */
  variantParams?: readonly string[];
  readability: 'ok' | 'often_blocked' | 'unknown';
  /** Marketing priority for Spain (shown as examples, used in docs). */
  priority?: boolean;
}

export const STORES: readonly StoreDefinition[] = [
  { id: 'ikea', name: 'IKEA', domains: ['ikea.com', 'ikea.es'], readability: 'ok', priority: true },
  {
    id: 'zarahome',
    name: 'Zara Home',
    domains: ['zarahome.com'],
    variantParams: ['colorId', 'v1'],
    readability: 'often_blocked',
    priority: true,
  },
  { id: 'kavehome', name: 'Kave Home', domains: ['kavehome.com'], readability: 'often_blocked', priority: true },
  { id: 'sklum', name: 'Sklum', domains: ['sklum.com'], readability: 'ok', priority: true },
  {
    id: 'maisonsdumonde',
    name: 'Maisons du Monde',
    domains: ['maisonsdumonde.com'],
    readability: 'often_blocked',
    priority: true,
  },
  { id: 'westwing', name: 'Westwing', domains: ['westwing.es', 'westwing.com'], readability: 'ok', priority: true },
  { id: 'leroymerlin', name: 'Leroy Merlin', domains: ['leroymerlin.es'], readability: 'often_blocked', priority: true },
  {
    id: 'amazon',
    name: 'Amazon',
    domains: ['amazon.es', 'amazon.com', 'amazon.fr', 'amazon.de', 'amazon.it', 'amazon.co.uk', 'amzn.eu', 'amzn.to', 'a.co'],
    variantParams: ['th', 'psc'],
    readability: 'often_blocked',
    priority: true,
  },
  { id: 'elcorteingles', name: 'El Corte Inglés', domains: ['elcorteingles.es'], readability: 'unknown' },
  { id: 'hm', name: 'H&M Home', domains: ['hm.com'], readability: 'unknown' },
  { id: 'zara', name: 'Zara', domains: ['zara.com'], variantParams: ['v1'], readability: 'often_blocked' },
  { id: 'massimodutti', name: 'Massimo Dutti', domains: ['massimodutti.com'], readability: 'unknown' },
  { id: 'sostrenegrene', name: 'Søstrene Grene', domains: ['sostrenegrene.com'], readability: 'unknown' },
  { id: 'muymucho', name: 'Muy Mucho', domains: ['muymucho.es'], readability: 'unknown' },
  { id: 'casa', name: 'CASA', domains: ['casashops.com'], readability: 'unknown' },
  { id: 'laredoute', name: 'La Redoute', domains: ['laredoute.es'], readability: 'unknown' },
  { id: 'lidl', name: 'Lidl', domains: ['lidl.es'], readability: 'unknown' },
  { id: 'carrefour', name: 'Carrefour', domains: ['carrefour.es'], readability: 'unknown' },
  { id: 'habitat', name: 'Habitat', domains: ['habitat.net', 'habitat.fr'], readability: 'unknown' },
  { id: 'aliexpress', name: 'AliExpress', domains: ['aliexpress.com', 'aliexpress.es', 'aliexpress.us'], readability: 'unknown' },
];

/** Hosts that only redirect to the real product page (resolved by following redirects). */
export const SHORT_LINK_HOSTS: readonly string[] = [
  'amzn.eu',
  'amzn.to',
  'a.co',
  'bit.ly',
  'tinyurl.com',
  't.co',
  'ow.ly',
  'buff.ly',
  'rebrand.ly',
  'a.aliexpress.com',
  's.click.aliexpress.com',
];

/** Stores highlighted in marketing copy and examples (Spain, home & decor). */
export const PRIORITY_STORE_NAMES = STORES.filter((s) => s.priority).map((s) => s.name);
