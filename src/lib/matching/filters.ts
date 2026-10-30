import type { CatalogProduct, Money } from '../../types/product';
import type { FilterReason, ProductAnalysis } from '../../types/matching';
import type { MatchingConfig } from '../../config/matching';
import { CATEGORY_BY_ID } from './analyze';
import { ACCESSORY_TERMS, CATEGORIES, COUNTERFEIT_TERMS, PROTECTED_NAMES, WEAK_ACCESSORY_TERMS } from './lexicon';
import { sizeRatio } from './score';
import { normalizePhrase, phraseText } from './text';

/** Leaf categories that are reasonable substitutes for each other. */
const COMPATIBLE_LEAVES: [string, string][] = [
  ['side-table', 'coffee-table'],
  ['basket', 'storage-box'],
  ['vase', 'planter'],
  ['wall-mirror', 'floor-mirror'],
  ['dinnerware', 'mug'],
];

const GENERIC_BRAND_WORDS = new Set(
  ['collection', 'home', 'design', 'studio', 'living', 'casa', 'deco', 'store', 'shop', 'interiors', 'furniture', 'the', 'by', 'and', 'y']
    .map(normalizePhrase),
);

const compiledPhrases = (list: string[]) => [...new Set(list.map(normalizePhrase).filter(Boolean))];
const PROTECTED = compiledPhrases(PROTECTED_NAMES);
const COUNTERFEIT = compiledPhrases(COUNTERFEIT_TERMS);
const WEAK = compiledPhrases(WEAK_ACCESSORY_TERMS);
const STRONG_BY_GROUP: Record<string, string[]> = Object.fromEntries(
  Object.entries(ACCESSORY_TERMS).map(([group, terms]) => [group, compiledPhrases(terms)]),
);
const CATEGORY_PHRASES = compiledPhrases(CATEGORIES.flatMap((c) => c.terms));

function contains(text: string, phrase: string): boolean {
  return text.includes(` ${phrase} `);
}

function firstIndex(text: string, phrases: string[]): number {
  let best = Number.POSITIVE_INFINITY;
  for (const p of phrases) {
    const i = text.indexOf(` ${p} `);
    if (i >= 0 && i < best) best = i;
  }
  return best;
}

export function isAccessoryListing(title: string, candidate: ProductAnalysis, source: ProductAnalysis): boolean {
  if (source.flags.includes('accessory')) return false;
  if (candidate.flags.includes('accessory')) return true;
  const text = phraseText(title);
  const strong = [...(STRONG_BY_GROUP._generic ?? []), ...(source.groupId ? STRONG_BY_GROUP[source.groupId] ?? [] : [])];
  if (strong.some((p) => contains(text, p))) return true;
  // Weak words ("cable", "funda", "pata"…) only count when they precede the product noun.
  const weakPos = firstIndex(text, WEAK);
  if (weakPos === Number.POSITIVE_INFINITY) return false;
  const nounPos = firstIndex(text, CATEGORY_PHRASES);
  return weakPos < nounPos;
}

export function brandMisuse(title: string, source: ProductAnalysis, extraNames: string[] = []): boolean {
  const text = phraseText(title);
  if (PROTECTED.some((p) => contains(text, p))) return true;
  if (extraNames.map(normalizePhrase).some((p) => p && contains(text, p))) return true;
  return source.brandTokens.some((t) => t.length >= 4 && !GENERIC_BRAND_WORDS.has(t) && contains(text, t));
}

export function counterfeitSignal(title: string): boolean {
  const text = phraseText(title);
  return COUNTERFEIT.some((p) => contains(text, p));
}

function categoryCompatible(a: ProductAnalysis, b: ProductAnalysis): boolean {
  if (!a.categoryId || !b.categoryId) return true;
  if (a.categoryId === b.categoryId) return true;
  const ga = CATEGORY_BY_ID.get(a.categoryId)?.group;
  const gb = CATEGORY_BY_ID.get(b.categoryId)?.group;
  const confident = a.categoryConfidence >= 0.6 && b.categoryConfidence >= 0.6;
  if (ga !== gb) return !confident;
  if (a.categoryId === 'lamp' || b.categoryId === 'lamp' || a.categoryId === 'table' || b.categoryId === 'table') return true;
  if (COMPATIBLE_LEAVES.some(([x, y]) => (x === a.categoryId && y === b.categoryId) || (y === a.categoryId && x === b.categoryId))) {
    return true;
  }
  return !(confident && a.categoryConfidence >= 0.75 && b.categoryConfidence >= 0.75);
}

export interface FilterContext {
  sourceAnalysis: ProductAnalysis;
  sourcePrice: Money | null;
  /** Comparable candidate price (item + known shipping). */
  comparable: Money | null;
  config: MatchingConfig;
  extraBlockedNames?: string[];
}

/** Returns every reason to reject the candidate (empty = keep). */
export function verifyCandidate(c: CatalogProduct, analysis: ProductAnalysis, ctx: FilterContext): FilterReason[] {
  const reasons: FilterReason[] = [];
  const { sourceAnalysis: src, config } = ctx;

  if (c.availability === 'out_of_stock') reasons.push('out_of_stock');
  if (c.shipsToSpain === false) reasons.push('not_shipping_to_spain');
  if (!c.image) reasons.push('no_image');
  if (!c.price) reasons.push('price_missing');
  if (c.price && c.price.currency !== 'EUR') reasons.push('currency_mismatch');

  if (!categoryCompatible(src, analysis)) reasons.push('category_mismatch');
  if (isAccessoryListing(c.title, analysis, src)) reasons.push('accessory');
  if (brandMisuse(c.title, src, ctx.extraBlockedNames)) reasons.push('brand_misuse');
  if (counterfeitSignal(c.title)) reasons.push('counterfeit_signal');

  if (c.price && c.priceHigh && c.priceHigh.currency === c.price.currency) {
    if (c.priceHigh.amount / c.price.amount > config.rejectPriceSpread) reasons.push('price_not_representative');
  }
  if (ctx.sourcePrice && ctx.comparable && ctx.comparable.currency === ctx.sourcePrice.currency) {
    if (ctx.comparable.amount < ctx.sourcePrice.amount * config.minPriceRatio) reasons.push('price_not_representative');
    if (config.requireCheaper && ctx.comparable.amount >= ctx.sourcePrice.amount) reasons.push('not_cheaper');
  }

  const ratio = sizeRatio(src, analysis);
  if (ratio !== null && ratio < 0.45) reasons.push('size_mismatch');

  return [...new Set(reasons)];
}
