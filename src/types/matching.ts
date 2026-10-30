import type { CatalogProduct, Dimensions, Money } from './product';

/** Structured understanding of a product, derived deterministically from its data. */
export interface ProductAnalysis {
  /** Leaf category id from our taxonomy (e.g. "table-lamp"), if recognised. */
  categoryId: string | null;
  /** Parent group id (e.g. "lighting"). */
  groupId: string | null;
  /** 0–1: how sure we are about the category. */
  categoryConfidence: number;
  colors: string[];
  materials: string[];
  shapes: string[];
  styles: string[];
  features: string[];
  dimensions: Dimensions | null;
  /** Number of units in the pack ("set de 2" → 2). `null` when not stated. */
  packSize: number | null;
  /** Normalised informative tokens of the title (accent-free, singular). */
  tokens: string[];
  /** Spanish keywords (for display/logging and ES-capable providers). */
  keywordsEs: string[];
  /** English keywords used for AliExpress-style search. */
  keywordsEn: string[];
  /** Brand / designer tokens that must never be used in queries. */
  brandTokens: string[];
  /** Flags such as "is-accessory" when the item itself is an accessory. */
  flags: string[];
  /** Where the analysis signals came from. */
  sources: AnalysisSource[];
}

export type AnalysisSource = 'title' | 'description' | 'breadcrumbs' | 'attributes' | 'url' | 'vision';

export interface SearchQuery {
  text: string;
  lang: 'en' | 'es';
  /** precise → attribute → broad. Used for weighting and logging. */
  intent: 'precise' | 'attribute' | 'broad' | 'image';
  /** Optional price window in EUR to avoid absurd results. */
  maxPrice?: number;
}

export type MatchTier = 'verified' | 'very_similar' | 'similar' | 'low_confidence';

/** One similarity signal with its contribution, kept for transparency/debugging. */
export interface SignalScore {
  name: SimilaritySignal | ShoppingSignal;
  /** 0–1 value of the signal. */
  value: number;
  /** Effective weight after renormalisation over available signals. */
  weight: number;
}

export type SimilaritySignal =
  | 'category'
  | 'keywords'
  | 'color'
  | 'material'
  | 'shape'
  | 'style'
  | 'features'
  | 'dimensions'
  | 'visual'
  | 'identity';

export type ShoppingSignal =
  | 'price'
  | 'shipping_known'
  | 'delivery'
  | 'rating'
  | 'popularity'
  | 'data_quality';

export type SavingsBasis = 'total_with_shipping' | 'item_price_only';

export interface Savings {
  amount: Money;
  /** 0–100, rounded. */
  percent: number;
  basis: SavingsBasis;
}

export type FilterReason =
  | 'out_of_stock'
  | 'not_shipping_to_spain'
  | 'category_mismatch'
  | 'accessory'
  | 'brand_misuse'
  | 'counterfeit_signal'
  | 'price_not_representative'
  | 'price_missing'
  | 'not_cheaper'
  | 'currency_mismatch'
  | 'pack_mismatch'
  | 'size_mismatch'
  | 'duplicate'
  | 'below_threshold'
  | 'no_image';

export interface ScoredCandidate {
  product: CatalogProduct;
  analysis: ProductAnalysis;
  similarity: number;
  /** Share (0–1) of the similarity weight backed by real data on both sides. */
  evidence: number;
  shopping: number;
  final: number;
  tier: MatchTier;
  signals: SignalScore[];
  shoppingSignals: SignalScore[];
  /** Comparable price used for savings ("total" when shipping is known). */
  comparablePrice: Money | null;
  savings: Savings | null;
  /** Non-blocking caveats shown in the UI (e.g. "precio desde"). */
  caveats: CandidateCaveat[];
  /** Queries that retrieved this candidate. */
  matchedQueries: string[];
  /** Number of near-identical listings merged into this one. */
  duplicates: number;
}

export type CandidateCaveat =
  | 'price_from'
  | 'shipping_unknown'
  | 'delivery_unknown'
  | 'size_differs'
  | 'pack_differs'
  | 'few_reviews';

export interface RejectedCandidate {
  providerProductId: string;
  title: string;
  reasons: FilterReason[];
}

export interface MatchingStats {
  queries: number;
  retrieved: number;
  uniqueAfterDedupe: number;
  rejected: number;
  rejectedByReason: Partial<Record<FilterReason, number>>;
  shown: number;
}

export type MoneyLike = Money;
