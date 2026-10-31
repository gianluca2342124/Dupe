import type { SourceProduct } from '../../types/product';
import type { ScoredCandidate } from '../../types/matching';
import type { PublicSourceProduct, ResultItem, ResultLabel } from '../../types/search';
import { sourceHighlights } from '../extraction/service';

/** Strips internal provenance; only display-safe fields reach the browser. */
export function toPublicSource(s: SourceProduct): PublicSourceProduct {
  return {
    url: s.originalUrl,
    canonicalUrl: s.canonicalUrl,
    storeName: s.store.name,
    storeKnown: s.store.known,
    domain: s.domain,
    title: s.title,
    image: s.image,
    price: s.price,
    priceIsRange: !!s.priceHigh,
    availability: s.availability,
    brand: s.brand,
    checkedAt: s.checkedAt,
    confidence: s.confidence,
    readMode: s.readMode,
    readIssue: s.readIssue ?? null,
    highlights: sourceHighlights(s),
  };
}

/** "Mushroom Table Lamp Opal Glass Shade Brass Base Bedside Lamp 36cm" → first ~7 meaningful words. */
export function shortTitle(title: string, max = 64): string {
  const cleaned = title
    .replace(/\b(19|20)\d{2}\b/g, '')
    .replace(/\b(new|hot|sale|free shipping|nuevo|oferta|envío gratis)\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  if (cleaned.length <= max) return cleaned;
  const cut = cleaned.slice(0, max);
  return `${cut.slice(0, cut.lastIndexOf(' ') > 30 ? cut.lastIndexOf(' ') : max).replace(/[,;:\-–]+$/, '')}…`;
}

export function toResultItem(
  c: ScoredCandidate,
  opts: { goUrl: string; isAffiliate: boolean; labels: ResultLabel[]; showSimilarityPercent: boolean; hideSavings: boolean },
): ResultItem {
  const p = c.product;
  const priceIsFrom = c.caveats.includes('price_from');
  return {
    id: `${p.provider}:${p.providerProductId}`,
    provider: p.provider,
    title: p.title,
    shortTitle: shortTitle(p.title),
    image: p.image,
    price: p.price,
    priceIsFrom,
    shippingCost: p.shippingCost,
    totalPrice: p.shippingCost && p.price ? c.comparablePrice : null,
    deliveryDays: p.deliveryDays,
    rating: p.rating,
    orders: p.orders,
    tier: c.tier,
    similarityPercent: opts.showSimilarityPercent ? Math.round(c.similarity * 100) : null,
    savings: opts.hideSavings ? null : c.savings,
    labels: opts.labels,
    caveats: c.caveats,
    goUrl: opts.goUrl,
    isAffiliate: opts.isAffiliate,
    isDemo: p.isDemo,
    checkedAt: p.priceCheckedAt,
  };
}
