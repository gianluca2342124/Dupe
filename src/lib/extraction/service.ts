import type { ExtractionMethod, ReadIssue, ReadIssueReason, SourceField, SourceProduct } from '../../types/product';
import type { NormalizedProductUrl } from '../url/normalize';
import type { RobotsChecker } from '../security/robots';
import { SafeFetchError } from '../security/safe-fetch';
import { cleanImageUrl, cleanText, cleanUrl } from '../security/sanitize';
import { applyAdapter } from './adapters';
import { detectBlock, type BlockKind } from './challenge';
import { RedirectRefused } from './fetchers';
import { formatDimensions, mergeDimensions, parseDimensionsFromText } from './dimensions';
import type { HeadlessRenderer } from './headless';
import { extractBreadcrumbs, extractJsonLdProduct, mapAvailability } from './jsonld';
import { parseAmount, normalizeCurrency, currencyFromText } from './price';
import { firstMeta, firstMicrodata, scanHtml, type PageScan } from './scanner';
import { nameFromUrl } from './url-slug';

export interface FetchedPage {
  status: number;
  finalUrl: string;
  html: string;
  truncated: boolean;
}

/** Abstraction over "get the HTML of this URL" (live, fixtures, headless). */
export interface PageFetcher {
  fetchPage(url: string): Promise<FetchedPage>;
}

export type ExtractionFailure = ReadIssueReason;

export type ExtractionResult =
  | { ok: true; product: SourceProduct; durationMs: number }
  | {
      ok: false;
      reason: ExtractionFailure;
      detail?: string;
      blockKind?: BlockKind;
      /** Best-effort record built from the URL alone (never invented data). */
      fallback: SourceProduct | null;
      durationMs: number;
    };

export interface ExtractionDeps {
  fetcher: PageFetcher;
  robots: RobotsChecker | null;
  headless: HeadlessRenderer | null;
  /** Hosts for which headless rendering may be used (when configured). */
  headlessHosts: readonly string[];
  now?: () => Date;
}

function baseProduct(n: NormalizedProductUrl, checkedAt: string): SourceProduct {
  return {
    originalUrl: n.original,
    canonicalUrl: n.canonical,
    finalUrl: null,
    host: n.host,
    domain: n.domain,
    store: n.store,
    title: null,
    description: null,
    image: null,
    images: [],
    price: null,
    priceHigh: null,
    availability: 'unknown',
    brand: null,
    category: null,
    breadcrumbs: [],
    color: null,
    material: null,
    shape: null,
    dimensions: null,
    variant: null,
    gtin: null,
    mpn: null,
    sku: null,
    rating: null,
    checkedAt,
    confidence: 'low',
    fieldSources: {},
    methods: [],
    readMode: 'page',
  };
}

/**
 * Builds a URL-only record: just a descriptive name derived from the path.
 * `nameUrl` is where a redirect led (short links such as amzn.eu/d/… only
 * carry the name in their target).
 */
export function urlOnlyProduct(n: NormalizedProductUrl, checkedAt: string, issue?: ReadIssue, nameUrl?: string): SourceProduct | null {
  const name = (nameUrl && nameUrl !== n.canonical ? nameFromUrl(nameUrl) : null) ?? nameFromUrl(n.canonical);
  if (!name) return null;
  const p = baseProduct(n, checkedAt);
  p.title = name;
  p.readMode = 'url-only';
  p.fieldSources.title = 'url-slug';
  p.methods = ['url-slug'];
  p.confidence = 'low';
  if (issue) p.readIssue = issue;
  return p;
}

type Setter = <K extends keyof SourceProduct>(field: K & SourceField, value: SourceProduct[K] | null | undefined, method: ExtractionMethod) => void;

/** Merges all page signals into a SourceProduct, recording provenance per field. */
export function buildSourceProduct(scan: PageScan, n: NormalizedProductUrl, page: FetchedPage, checkedAt: string): SourceProduct {
  const p = baseProduct(n, checkedAt);
  p.finalUrl = page.finalUrl;
  const methods = new Set<ExtractionMethod>();
  const set: Setter = (field, value, method) => {
    if (value === null || value === undefined || (Array.isArray(value) && value.length === 0)) return;
    if (p[field] !== null && p[field] !== undefined && p[field] !== 'unknown') return; // first (highest priority) wins
    (p as unknown as Record<string, unknown>)[field] = value;
    p.fieldSources[field] = method;
    methods.add(method);
  };
  const base = page.finalUrl;

  // 1) schema.org JSON-LD
  const ld = extractJsonLdProduct(scan.jsonLd);
  if (ld) {
    set('title', cleanText(ld.name, 300), 'json-ld');
    set('description', cleanText(ld.description, 1200), 'json-ld');
    const imgs = ld.images.map((i) => cleanImageUrl(i, base)).filter((i): i is string => !!i);
    if (imgs.length) {
      set('image', imgs[0], 'json-ld');
      p.images = imgs.slice(0, 8);
    }
    set('price', ld.price, 'json-ld');
    if (ld.priceHigh) p.priceHigh = ld.priceHigh;
    if (ld.availability !== 'unknown') set('availability', ld.availability, 'json-ld');
    set('brand', cleanText(ld.brand, 80), 'json-ld');
    set('category', cleanText(ld.category, 120), 'json-ld');
    set('color', cleanText(ld.color, 80), 'json-ld');
    set('material', cleanText(ld.material, 120), 'json-ld');
    set('dimensions', ld.dimensions, 'json-ld');
    set('gtin', cleanText(ld.gtin, 20), 'json-ld');
    set('mpn', cleanText(ld.mpn, 40), 'json-ld');
    set('sku', cleanText(ld.sku, 40), 'json-ld');
    set('rating', ld.rating, 'json-ld');
  }
  p.breadcrumbs = extractBreadcrumbs(scan.jsonLd)
    .map((b) => cleanText(b, 80))
    .filter((b): b is string => !!b && !/^(inicio|home|página de inicio|productos)$/i.test(b));

  // 2) Microdata
  const mdPrice = firstMicrodata(scan, 'price', 'lowprice');
  const mdCurrency = firstMicrodata(scan, 'pricecurrency');
  set('title', cleanText(firstMicrodata(scan, 'name'), 300), 'microdata');
  if (mdPrice) {
    const amount = parseAmount(mdPrice);
    const currency = normalizeCurrency(mdCurrency) ?? currencyFromText(mdPrice);
    if (amount !== null && currency) set('price', { amount, currency }, 'microdata');
  }
  set('image', cleanImageUrl(firstMicrodata(scan, 'image'), base), 'microdata');
  set('brand', cleanText(firstMicrodata(scan, 'brand'), 80), 'microdata');
  set('gtin', cleanText(firstMicrodata(scan, 'gtin13', 'gtin'), 20), 'microdata');
  const mdAvailability = firstMicrodata(scan, 'availability');
  if (mdAvailability) set('availability', mapAvailability(mdAvailability), 'microdata');

  // 3) Open Graph / product meta
  set('title', cleanText(firstMeta(scan, 'og:title', 'twitter:title'), 300), 'open-graph');
  set('description', cleanText(firstMeta(scan, 'og:description', 'twitter:description'), 1200), 'open-graph');
  set(
    'image',
    cleanImageUrl(firstMeta(scan, 'og:image:secure_url', 'og:image:url', 'og:image', 'twitter:image', 'twitter:image:src'), base),
    'open-graph',
  );
  const ogAmount = firstMeta(scan, 'product:price:amount', 'og:price:amount', 'product:sale_price:amount');
  if (ogAmount) {
    const amount = parseAmount(ogAmount);
    const currency = normalizeCurrency(firstMeta(scan, 'product:price:currency', 'og:price:currency', 'product:sale_price:currency'));
    if (amount !== null && currency) set('price', { amount, currency }, 'open-graph');
  }
  const ogAvailability = firstMeta(scan, 'product:availability', 'og:availability');
  if (ogAvailability) set('availability', mapAvailability(ogAvailability), 'open-graph');
  set('brand', cleanText(firstMeta(scan, 'product:brand', 'og:brand'), 80), 'open-graph');
  set('color', cleanText(firstMeta(scan, 'product:color'), 80), 'open-graph');
  set('material', cleanText(firstMeta(scan, 'product:material'), 120), 'open-graph');
  set('category', cleanText(firstMeta(scan, 'product:category'), 120), 'open-graph');

  // 4) Plain HTML metadata
  set('title', cleanText(scan.h1, 300), 'html');
  set('title', cleanText(scan.title, 300), 'meta');
  set('description', cleanText(firstMeta(scan, 'description'), 1200), 'meta');
  set('image', cleanImageUrl(firstMeta(scan, 'image_src'), base), 'meta');
  // Last resort: the first large <img> on the page.
  const mainImage = scan.images.find((i) => !/logo|icon|sprite|banner|avatar/i.test(`${i.src} ${i.alt ?? ''}`));
  if (mainImage) set('image', cleanImageUrl(mainImage.src, base), 'html');

  // Derived: dimensions from text when no structured dimensions were present.
  if (!p.dimensions) {
    const fromTitle = parseDimensionsFromText(p.title);
    const fromDescription = parseDimensionsFromText(p.description);
    const dims = mergeDimensions(fromTitle, fromDescription);
    if (dims) {
      p.dimensions = dims;
      p.fieldSources.dimensions = 'html';
    }
  }
  if (!p.category && p.breadcrumbs.length) {
    p.category = p.breadcrumbs[p.breadcrumbs.length - 1] ?? null;
    if (p.category) p.fieldSources.category = 'json-ld';
  }

  if (p.images.length === 0 && p.image) p.images = [p.image];
  p.methods = [...methods];
  const adapted = applyAdapter(p);
  adapted.confidence = computeConfidence(adapted);
  return adapted;
}

const STRUCTURED: ExtractionMethod[] = ['json-ld', 'microdata'];

export function computeConfidence(p: SourceProduct): SourceProduct['confidence'] {
  const structuredPrice = p.price && STRUCTURED.includes(p.fieldSources.price ?? 'html');
  const structuredTitle = STRUCTURED.includes(p.fieldSources.title ?? 'html');
  if (p.title && p.image && structuredPrice && structuredTitle) return 'high';
  if (p.title && (p.image || p.price)) return 'medium';
  return 'low';
}

function hasProductSignals(scan: PageScan, p: SourceProduct): boolean {
  if (p.methods.includes('json-ld') || scan.hasProductItemscope) return true;
  const ogType = firstMeta(scan, 'og:type')?.toLowerCase() ?? '';
  if (ogType.includes('product')) return true;
  if (p.price) return true;
  return false;
}

function looksLikeProductPath(url: string): boolean {
  try {
    const { pathname } = new URL(url);
    const segments = pathname.split('/').filter(Boolean);
    if (segments.length === 0) return false;
    const last = segments[segments.length - 1] ?? '';
    return /\d{3,}/.test(pathname) || last.split(/[-_]/).length >= 3;
  } catch {
    return false;
  }
}

export class ProductExtractionService {
  private readonly now: () => Date;

  constructor(private readonly deps: ExtractionDeps) {
    this.now = deps.now ?? (() => new Date());
  }

  async extract(n: NormalizedProductUrl): Promise<ExtractionResult> {
    const started = Date.now();
    const checkedAt = this.now().toISOString();
    const fail = (
      reason: ExtractionFailure,
      opts: { detail?: string | undefined; blockKind?: BlockKind | undefined; nameUrl?: string | undefined; fallback?: boolean } = {},
    ): ExtractionResult => {
      const { detail, blockKind } = opts;
      const issue: ReadIssue = { reason, ...(detail ? { detail } : {}), ...(blockKind ? { block: blockKind } : {}) };
      return {
        ok: false,
        reason,
        ...(detail ? { detail } : {}),
        ...(blockKind ? { blockKind } : {}),
        fallback: opts.fallback === false ? null : urlOnlyProduct(n, checkedAt, issue, opts.nameUrl),
        durationMs: Date.now() - started,
      };
    };

    if (this.deps.robots) {
      const robots = await this.deps.robots.check(new URL(n.canonical));
      if (robots.verdict === 'disallowed') return fail('robots_disallowed');
      if (robots.verdict === 'unreachable') return fail('robots_unreachable', { detail: robots.detail });
      if (robots.verdict === 'blocked') return fail('blocked', { detail: robots.detail, blockKind: robots.block });
    }

    let page: FetchedPage;
    try {
      page = await this.deps.fetcher.fetchPage(n.canonical);
    } catch (err) {
      if (err instanceof RedirectRefused) {
        const { verdict, detail, block } = err.decision;
        const reason: ExtractionFailure = verdict === 'blocked' ? 'blocked' : verdict === 'unreachable' ? 'robots_unreachable' : 'robots_disallowed';
        return fail(reason, { detail, blockKind: block, nameUrl: err.url });
      }
      if (err instanceof SafeFetchError) {
        const nameUrl = err.url;
        if (err.code === 'timeout') return fail('timeout', { nameUrl });
        if (err.code === 'too_large') return fail('too_large', { nameUrl });
        if (err.code === 'unsupported_content') return fail('unsupported_content', { nameUrl });
        if (err.code === 'blocked_host' || err.code === 'private_address') return fail('blocked_host', { detail: err.code });
        return fail('fetch_failed', { detail: err.code, nameUrl });
      }
      return fail('fetch_failed', { detail: 'network' });
    }

    const block = detectBlock(page.status, page.html);
    if (block) return fail('blocked', { detail: `HTTP ${page.status}`, blockKind: block, nameUrl: page.finalUrl });
    if (page.status >= 400) return fail('http_error', { detail: `HTTP ${page.status}`, nameUrl: page.finalUrl });

    let scan = scanHtml(page.html);
    let product = buildSourceProduct(scan, n, page, checkedAt);

    // Client-rendered shells: optionally render once with a real browser,
    // only for allow-listed hosts and never to get past a block.
    if (!hasProductSignals(scan, product) && this.deps.headless && this.deps.headlessHosts.includes(n.domain)) {
      try {
        const rendered = await this.deps.headless.render(n.canonical);
        if (!detectBlock(rendered.status, rendered.html)) {
          scan = scanHtml(rendered.html);
          product = buildSourceProduct(scan, n, rendered, checkedAt);
          product.methods = [...new Set<ExtractionMethod>([...product.methods, 'headless'])];
        }
      } catch {
        // Headless rendering is an optional enhancement; ignore failures.
      }
    }

    if (!product.title) return fail('not_product', { detail: 'no title', nameUrl: page.finalUrl });
    if (!hasProductSignals(scan, product) && !(product.image && looksLikeProductPath(page.finalUrl))) {
      return fail('not_product', { detail: 'no product signals', fallback: false });
    }
    return { ok: true, product, durationMs: Date.now() - started };
  }
}

/** Highlights for the UI: material · colour · size, from real data only. */
export function sourceHighlights(p: SourceProduct): string[] {
  const out: string[] = [];
  if (p.material) out.push(p.material);
  if (p.color) out.push(p.color);
  const dims = formatDimensions(p.dimensions);
  if (dims) out.push(dims);
  return out.slice(0, 3);
}

export { cleanUrl };
