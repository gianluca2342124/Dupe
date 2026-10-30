import type { CatalogProduct, Money } from '../../types/product';
import type { ProductAnalysis, ShoppingSignal, SignalScore, SimilaritySignal } from '../../types/matching';
import type { MatchingConfig } from '../../config/matching';
import { sortedMeasures } from '../extraction/dimensions';
import { CATEGORY_BY_ID, CONCEPTS } from './analyze';

const GENERIC = new Set(['lamp', 'table']);

/** Similarity between two concept sets using the lexicon's related-concept map. */
export function conceptSetSimilarity(
  kind: keyof typeof CONCEPTS,
  source: readonly string[],
  candidate: readonly string[],
): number {
  if (!source.length || !candidate.length) return 0;
  const map = CONCEPTS[kind];
  const scores = source.slice(0, 3).map((s) => {
    let best = 0;
    for (const c of candidate) {
      if (s === c) return 1;
      const rel = map.get(s)?.related?.[c] ?? map.get(c)?.related?.[s] ?? 0;
      if (rel > best) best = rel;
    }
    return best;
  });
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

export function categorySimilarity(a: string | null, b: string | null): number | null {
  if (!a || !b) return null;
  if (a === b) return 1;
  const ga = CATEGORY_BY_ID.get(a)?.group;
  const gb = CATEGORY_BY_ID.get(b)?.group;
  if (!ga || !gb || ga !== gb) return 0;
  if (GENERIC.has(a) || GENERIC.has(b)) return 0.75;
  return 0.45;
}

function conceptBag(a: ProductAnalysis): string[] {
  return [
    ...(a.categoryId ? [`c:${a.categoryId}`] : []),
    ...a.colors.map((x) => `col:${x}`),
    ...a.materials.map((x) => `mat:${x}`),
    ...a.shapes.map((x) => `sh:${x}`),
    ...a.styles.map((x) => `st:${x}`),
    ...a.features.map((x) => `f:${x}`),
  ];
}

export function dimensionSimilarity(a: ProductAnalysis, b: ProductAnalysis): number | null {
  const ma = sortedMeasures(a.dimensions);
  const mb = sortedMeasures(b.dimensions);
  if (!ma.length || !mb.length) return null;
  const pairs = Math.min(2, ma.length, mb.length);
  let total = 0;
  for (let i = 0; i < pairs; i++) {
    const x = ma[i]!;
    const y = mb[i]!;
    const r = Math.min(x, y) / Math.max(x, y);
    total += Math.max(0, Math.min(1, (r - 0.5) / 0.4));
  }
  return total / pairs;
}

/** Largest-measure ratio (0–1), or null when unknown on either side. */
export function sizeRatio(a: ProductAnalysis, b: ProductAnalysis): number | null {
  const x = sortedMeasures(a.dimensions)[0];
  const y = sortedMeasures(b.dimensions)[0];
  if (!x || !y) return null;
  return Math.min(x, y) / Math.max(x, y);
}

export interface SimilarityResult {
  similarity: number;
  evidence: number;
  identity: boolean;
  signals: SignalScore[];
}

interface IdentityFields {
  gtin: string | null;
  mpn: string | null;
}

function sameIdentity(a: IdentityFields, b: IdentityFields): boolean {
  const gtin = (s: string | null) => (s ?? '').replace(/\D/g, '');
  const ga = gtin(a.gtin);
  const gb = gtin(b.gtin);
  if (ga.length >= 8 && ga === gb) return true;
  const ma = (a.mpn ?? '').replace(/[\s.-]/g, '').toLowerCase();
  const mb = (b.mpn ?? '').replace(/[\s.-]/g, '').toLowerCase();
  return ma.length >= 6 && ma === mb;
}

/**
 * Similarity from real signals only. A signal contributes when both sides
 * have data for it. When the source has a distinctive attribute that the
 * candidate never mentions, we apply a mild, half-weight penalty that does
 * not count as evidence.
 */
export function computeSimilarity(
  source: ProductAnalysis,
  sourceIds: IdentityFields,
  cand: ProductAnalysis,
  candIds: IdentityFields,
  weights: MatchingConfig['similarityWeights'],
  visual: number | null = null,
): SimilarityResult {
  const signals: SignalScore[] = [];
  let weighted = 0;
  let weightSum = 0;
  let evidenceWeight = 0;

  const add = (name: SimilaritySignal, value: number, weight: number, counts: boolean) => {
    signals.push({ name, value: Math.round(value * 1000) / 1000, weight });
    weighted += value * weight;
    weightSum += weight;
    if (counts) evidenceWeight += weight;
  };

  const cat = categorySimilarity(source.categoryId, cand.categoryId);
  if (cat !== null) add('category', cat, weights.category, true);

  const bagA = conceptBag(source);
  const bagB = conceptBag(cand);
  if (bagA.length >= 2 && bagB.length >= 2) {
    const A = new Set(bagA);
    const B = new Set(bagB);
    let inter = 0;
    for (const x of A) if (B.has(x)) inter++;
    // Overlap coefficient relative to the source: how much of the source description is covered.
    add('keywords', inter / A.size, weights.keywords, true);
  }

  for (const [signal, kind, key] of [
    ['color', 'colors', 'colors'],
    ['material', 'materials', 'materials'],
    ['shape', 'shapes', 'shapes'],
  ] as const) {
    const s = source[key];
    const c = cand[key];
    if (!s.length) continue;
    if (c.length) add(signal, conceptSetSimilarity(kind, s, c), weights[signal], true);
    else add(signal, 0.3, weights[signal] * 0.5, false);
  }

  if (source.styles.length && cand.styles.length) {
    add('style', conceptSetSimilarity('styles', source.styles, cand.styles), weights.style, true);
  }
  if (source.features.length && cand.features.length) {
    const A = new Set(source.features);
    const inter = cand.features.filter((f) => A.has(f)).length;
    add('features', inter / A.size, weights.features, true);
  }

  const dims = dimensionSimilarity(source, cand);
  if (dims !== null) add('dimensions', dims, weights.dimensions, true);
  if (visual !== null) add('visual', Math.max(0, Math.min(1, visual)), weights.visual, true);

  const identity = sameIdentity(sourceIds, candIds);
  if (identity) add('identity', 1, 0.5, true);

  const totalPossible =
    weights.category + weights.keywords + weights.color + weights.material + weights.shape + weights.style +
    weights.features + weights.dimensions + (visual !== null ? weights.visual : 0);

  return {
    similarity: weightSum > 0 ? Math.round((weighted / weightSum) * 1000) / 1000 : 0,
    evidence: Math.round(Math.min(1, evidenceWeight / totalPossible) * 1000) / 1000,
    identity,
    signals,
  };
}

export interface ShoppingResult {
  shopping: number;
  signals: SignalScore[];
}

/** How useful the alternative is to buy, from known data only. */
export function computeShopping(
  cand: CatalogProduct,
  comparable: Money | null,
  sourcePrice: Money | null,
  peerPrices: number[],
  weights: MatchingConfig['shoppingWeights'],
): ShoppingResult {
  const signals: SignalScore[] = [];
  let weighted = 0;
  let weightSum = 0;
  const add = (name: ShoppingSignal, value: number, weight: number) => {
    const v = Math.max(0, Math.min(1, value));
    signals.push({ name, value: Math.round(v * 1000) / 1000, weight });
    weighted += v * weight;
    weightSum += weight;
  };

  if (comparable && sourcePrice && comparable.currency === sourcePrice.currency && sourcePrice.amount > 0) {
    const saving = 1 - comparable.amount / sourcePrice.amount;
    add('price', saving / 0.7, weights.price);
  } else if (comparable && peerPrices.length > 1) {
    const cheaperThan = peerPrices.filter((p) => p > comparable.amount).length;
    add('price', cheaperThan / (peerPrices.length - 1), weights.price * 0.6);
  }

  add('shipping_known', cand.shippingCost ? 1 : 0, weights.shipping_known);

  const maxDays = cand.deliveryDays?.max ?? cand.deliveryDays?.min ?? null;
  if (maxDays !== null) add('delivery', (30 - maxDays) / 23, weights.delivery);

  if (cand.rating) {
    const m = 4.2;
    const C = 25;
    if (cand.rating.count !== null) {
      const bayes = (C * m + cand.rating.value * cand.rating.count) / (C + cand.rating.count);
      add('rating', (bayes - 3.8) / 1.1, weights.rating);
    } else {
      add('rating', (cand.rating.value - 3.8) / 1.1, weights.rating * 0.5);
    }
  }
  if (cand.orders !== null) add('popularity', Math.log10(cand.orders + 1) / 3.5, weights.popularity);

  const fields = [
    cand.price,
    cand.image,
    cand.shippingCost,
    cand.deliveryDays,
    cand.rating,
    cand.orders,
    cand.availability !== 'unknown' ? true : null,
  ];
  add('data_quality', fields.filter((f) => f !== null && f !== undefined).length / fields.length, weights.data_quality);

  return { shopping: weightSum > 0 ? Math.round((weighted / weightSum) * 1000) / 1000 : 0, signals };
}
