import type { Availability, Dimensions, Money } from '../../types/product';
import { parseQuantitativeValue, mergeDimensions, emptyDimensions, hasDimensions } from './dimensions';
import { normalizeCurrency, parseAmount } from './price';

/** Product fields read from schema.org JSON-LD (raw strings, unsanitised). */
export interface JsonLdProduct {
  name: string | null;
  description: string | null;
  images: string[];
  brand: string | null;
  category: string | null;
  color: string | null;
  material: string | null;
  sku: string | null;
  gtin: string | null;
  mpn: string | null;
  price: Money | null;
  priceHigh: Money | null;
  availability: Availability;
  dimensions: Dimensions | null;
  rating: { value: number; count: number | null } | null;
  url: string | null;
  variantCount: number;
}

type Node = Record<string, unknown>;

function isObject(v: unknown): v is Node {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function types(node: Node): string[] {
  const t = node['@type'];
  const list = Array.isArray(t) ? t : [t];
  return list.filter((x): x is string => typeof x === 'string').map((x) => x.replace(/^https?:\/\/schema\.org\//, ''));
}

/** Flattens arrays, @graph containers and nested objects into a node list. */
export function collectNodes(blocks: unknown[], limit = 500): Node[] {
  const out: Node[] = [];
  const stack: unknown[] = [...blocks];
  while (stack.length && out.length < limit) {
    const item = stack.pop();
    if (Array.isArray(item)) {
      stack.push(...item);
    } else if (isObject(item)) {
      out.push(item);
      for (const [key, value] of Object.entries(item)) {
        if (key === 'review' || key === 'author') continue; // never needed, may contain personal data
        if (typeof value === 'object' && value !== null) stack.push(value);
      }
    }
  }
  return out;
}

function str(v: unknown): string | null {
  if (typeof v === 'string') return v.trim() || null;
  if (typeof v === 'number') return String(v);
  if (Array.isArray(v)) return str(v[0]);
  if (isObject(v)) return str(v.name ?? v['@value'] ?? v.value);
  return null;
}

function imageList(v: unknown): string[] {
  if (!v) return [];
  if (typeof v === 'string') return [v];
  if (Array.isArray(v)) return v.flatMap(imageList);
  if (isObject(v)) {
    const url = str(v.contentUrl) ?? str(v.url) ?? str(v.thumbnailUrl);
    return url ? [url] : [];
  }
  return [];
}

export function mapAvailability(v: unknown): Availability {
  const s = (str(v) ?? '').toLowerCase();
  if (!s) return 'unknown';
  if (/instock|in_stock|in stock|onlineonly|instoreonly/.test(s)) return 'in_stock';
  if (/limitedavailability|limited/.test(s)) return 'limited';
  if (/preorder|presale|backorder/.test(s)) return 'preorder';
  if (/outofstock|out_of_stock|soldout|sold out|discontinued|outofstock|agotado/.test(s)) return 'out_of_stock';
  return 'unknown';
}

interface OfferSummary {
  low: Money | null;
  high: Money | null;
  availability: Availability;
}

function summarizeOffers(offers: unknown): OfferSummary {
  const list = (Array.isArray(offers) ? offers : [offers]).filter(isObject);
  let low: Money | null = null;
  let high: Money | null = null;
  let availability: Availability = 'unknown';

  const consider = (amountRaw: unknown, currencyRaw: unknown) => {
    const amount = parseAmount(amountRaw);
    const currency = normalizeCurrency(currencyRaw);
    if (amount === null || !currency) return;
    if (!low || (currency === low.currency && amount < low.amount)) low = { amount, currency };
    if (!high || (currency === high.currency && amount > high.amount)) high = { amount, currency };
  };

  for (const offer of list) {
    const currency = offer.priceCurrency ?? (isObject(offer.priceSpecification) ? offer.priceSpecification.priceCurrency : undefined);
    if (types(offer).includes('AggregateOffer')) {
      consider(offer.lowPrice ?? offer.price, currency);
      consider(offer.highPrice, currency);
      if (offer.offers) {
        const nested = summarizeOffers(offer.offers);
        if (nested.low) consider(nested.low.amount, nested.low.currency);
        if (nested.high) consider(nested.high.amount, nested.high.currency);
      }
    } else {
      const spec = offer.priceSpecification;
      const specPrice = Array.isArray(spec)
        ? spec.filter(isObject).find((p) => !/strikethrough|listprice/i.test(str(p.priceType) ?? ''))
        : isObject(spec)
          ? spec
          : undefined;
      consider(offer.price ?? specPrice?.price, currency ?? specPrice?.priceCurrency);
    }
    const a = mapAvailability(offer.availability);
    if (a === 'in_stock' || availability === 'unknown') availability = a;
  }
  return { low, high, availability };
}

function scoreProductNode(node: Node): number {
  let score = 0;
  if (str(node.name)) score += 3;
  if (node.offers) score += 3;
  if (node.image) score += 2;
  if (node.sku || node.gtin13 || node.gtin || node.mpn) score += 1;
  if (node.description) score += 1;
  return score;
}

/** Picks the main Product (or ProductGroup) node and extracts its fields. */
export function extractJsonLdProduct(blocks: unknown[]): JsonLdProduct | null {
  const nodes = collectNodes(blocks);
  const candidates = nodes.filter((n) => {
    const t = types(n);
    return t.includes('Product') || t.includes('ProductGroup') || t.includes('IndividualProduct') || t.includes('ProductModel');
  });
  if (candidates.length === 0) return null;
  // Prefer the richest top-level product; variants inside hasVariant are summarised.
  const main = [...candidates].sort((a, b) => scoreProductNode(b) - scoreProductNode(a))[0]!;
  const variants = Array.isArray(main.hasVariant) ? main.hasVariant.filter(isObject) : [];

  let offers = summarizeOffers(main.offers);
  if (!offers.low && variants.length) {
    offers = summarizeOffers(variants.map((v) => v.offers).flat());
  }

  const rating = isObject(main.aggregateRating)
    ? (() => {
        const value = Number(str(main.aggregateRating.ratingValue));
        const best = Number(str(main.aggregateRating.bestRating) ?? 5) || 5;
        const count = Number(str(main.aggregateRating.reviewCount) ?? str(main.aggregateRating.ratingCount));
        if (!Number.isFinite(value) || value <= 0) return null;
        return { value: Math.round((value / best) * 5 * 10) / 10, count: Number.isFinite(count) ? count : null };
      })()
    : null;

  const dims = emptyDimensions();
  dims.widthCm = parseQuantitativeValue(main.width);
  dims.heightCm = parseQuantitativeValue(main.height);
  dims.depthCm = parseQuantitativeValue(main.depth);
  const sizeDims = hasDimensions(dims) ? dims : null;

  return {
    name: str(main.name),
    description: str(main.description),
    images: [...new Set([...imageList(main.image), ...variants.flatMap((v) => imageList(v.image)).slice(0, 4)])],
    brand: str(main.brand) ?? str(main.manufacturer),
    category: str(main.category),
    color: str(main.color),
    material: str(main.material),
    sku: str(main.sku) ?? str(main.productID),
    gtin: str(main.gtin13) ?? str(main.gtin) ?? str(main.gtin14) ?? str(main.gtin12) ?? str(main.gtin8),
    mpn: str(main.mpn),
    price: offers.low,
    priceHigh: offers.high && offers.low && offers.high.amount > offers.low.amount ? offers.high : null,
    availability: offers.availability,
    dimensions: mergeDimensions(sizeDims),
    rating,
    url: str(main.url),
    variantCount: variants.length,
  };
}

/** Breadcrumb names from BreadcrumbList nodes (first list with ≥ 2 items). */
export function extractBreadcrumbs(blocks: unknown[]): string[] {
  const nodes = collectNodes(blocks);
  for (const node of nodes) {
    if (!types(node).includes('BreadcrumbList')) continue;
    const items = Array.isArray(node.itemListElement) ? node.itemListElement.filter(isObject) : [];
    const names = items
      .sort((a, b) => Number(a.position ?? 0) - Number(b.position ?? 0))
      .map((it) => str(it.name) ?? (isObject(it.item) ? str(it.item.name) : null))
      .filter((n): n is string => !!n);
    if (names.length >= 2) return names;
  }
  return [];
}
