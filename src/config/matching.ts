/**
 * Matching engine configuration. Every number here is documented in
 * docs/PRODUCT_MATCHING.md. Change ALGORITHM_VERSION whenever weights or
 * thresholds change: cached similarity results are keyed by it.
 */
export const ALGORITHM_VERSION = 'm1.0.0';

export interface MatchingConfig {
  /** Similarity signal weights (renormalised over signals available on both sides). */
  similarityWeights: {
    category: number;
    keywords: number;
    color: number;
    material: number;
    shape: number;
    style: number;
    features: number;
    dimensions: number;
    /** Only used when an image-embedding provider is configured. */
    visual: number;
  };
  /** Shopping usefulness weights (renormalised over known signals). */
  shoppingWeights: {
    price: number;
    shipping_known: number;
    delivery: number;
    rating: number;
    popularity: number;
    data_quality: number;
  };
  /** final = alpha·similarity + (1 − alpha)·shopping (within the same tier). */
  alpha: number;
  tiers: {
    verySimilar: { minSimilarity: number; minEvidence: number };
    similar: { minSimilarity: number; minEvidence: number };
    lowConfidence: { minSimilarity: number };
  };
  /** Candidate price below this fraction of the source price is not representative. */
  minPriceRatio: number;
  /** priceHigh / price above this → "desde" price; above `rejectPriceSpread` → rejected. */
  priceFromSpread: number;
  rejectPriceSpread: number;
  /** Only show alternatives cheaper than the source when its price is known. */
  requireCheaper: boolean;
  maxResults: number;
  maxLowConfidence: number;
  maxQueries: number;
  candidatesPerQuery: number;
  /** Minimum gap needed to call one item "Más parecido". */
  mostSimilarMargin: number;
}

export const DEFAULT_MATCHING_CONFIG: MatchingConfig = {
  similarityWeights: {
    category: 0.2,
    keywords: 0.16,
    color: 0.12,
    material: 0.14,
    shape: 0.15,
    style: 0.05,
    features: 0.08,
    dimensions: 0.1,
    visual: 0.3,
  },
  shoppingWeights: {
    price: 0.4,
    shipping_known: 0.1,
    delivery: 0.12,
    rating: 0.18,
    popularity: 0.08,
    data_quality: 0.12,
  },
  alpha: 0.7,
  tiers: {
    verySimilar: { minSimilarity: 0.76, minEvidence: 0.55 },
    similar: { minSimilarity: 0.6, minEvidence: 0.35 },
    lowConfidence: { minSimilarity: 0.45 },
  },
  minPriceRatio: 0.06,
  priceFromSpread: 2.2,
  rejectPriceSpread: 6,
  requireCheaper: true,
  maxResults: 8,
  maxLowConfidence: 4,
  maxQueries: 4,
  candidatesPerQuery: 30,
  mostSimilarMargin: 0.03,
};
