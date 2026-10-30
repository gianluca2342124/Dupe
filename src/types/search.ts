import type { Availability, DataConfidence, Money, ProviderId } from './product';
import type { CandidateCaveat, MatchTier, MatchingStats, Savings } from './matching';

/** How the user reached the search. Used for analytics only. */
export type EntryMode = 'prefix' | 'form' | 'share' | 'example' | 'direct';

export type SearchStage =
  | 'validating'
  | 'reading'
  | 'analyzing'
  | 'searching'
  | 'comparing'
  | 'done'
  | 'error';

export type SearchErrorCode =
  | 'invalid_url'
  | 'invalid_query'
  | 'blocked_host'
  | 'own_domain'
  | 'not_a_product'
  | 'store_blocked'
  | 'robots_disallowed'
  | 'fetch_failed'
  | 'timeout'
  | 'too_large'
  | 'unsupported_content'
  | 'provider_unavailable'
  | 'rate_limited'
  | 'budget_exceeded'
  | 'internal';

/** Source product as exposed to the browser (no internal provenance noise). */
export interface PublicSourceProduct {
  url: string;
  canonicalUrl: string;
  storeName: string;
  storeKnown: boolean;
  domain: string;
  title: string | null;
  image: string | null;
  price: Money | null;
  priceIsRange: boolean;
  availability: Availability;
  brand: string | null;
  checkedAt: string;
  confidence: DataConfidence;
  readMode: 'page' | 'url-only' | 'example' | 'text';
  /** Short attribute summary for the UI ("Vidrio · Blanco · 39 cm"). */
  highlights: string[];
}

export interface ResultItem {
  /** Stable id within a search (provider:productId). */
  id: string;
  provider: ProviderId;
  title: string;
  shortTitle: string;
  image: string | null;
  price: Money | null;
  priceIsFrom: boolean;
  shippingCost: Money | null;
  totalPrice: Money | null;
  deliveryDays: { min: number | null; max: number | null } | null;
  rating: { value: number; count: number | null } | null;
  orders: number | null;
  tier: MatchTier;
  /** Only present when SHOW_SIMILARITY_PERCENT is enabled (calibrated). */
  similarityPercent: number | null;
  savings: Savings | null;
  labels: ResultLabel[];
  caveats: CandidateCaveat[];
  /** Internal redirect (/go/…) — never a raw third-party URL. */
  goUrl: string;
  /** Whether the outbound link carries affiliate tracking. */
  isAffiliate: boolean;
  isDemo: boolean;
  checkedAt: string | null;
}

export type ResultLabel = 'most_similar' | 'cheapest';

export interface Notice {
  kind:
    | 'demo'
    | 'url_only'
    | 'text_query'
    | 'partial_source'
    | 'no_source_price'
    | 'prices_not_comparable'
    | 'shipping_unknown'
    | 'few_results'
    | 'low_confidence_only'
    | 'stale_cache';
  message: string;
}

export interface SearchResultPayload {
  id: string;
  algorithmVersion: string;
  status: 'results' | 'few_results' | 'no_reliable_results';
  source: PublicSourceProduct;
  provider: { id: ProviderId; label: string; isDemo: boolean };
  items: ResultItem[];
  lowConfidenceItems: ResultItem[];
  summary: {
    count: number;
    maxSavings: Savings | null;
    cheapestTotal: Money | null;
  };
  notices: Notice[];
  stats: MatchingStats;
  createdAt: string;
  cache: { hit: boolean; ageSeconds: number };
  timingsMs: Record<string, number>;
}

export type SearchEvent =
  | { type: 'stage'; stage: SearchStage; detail?: string }
  | { type: 'source'; source: PublicSourceProduct }
  | { type: 'progress'; stage: SearchStage; done: number; total: number }
  | { type: 'result'; result: SearchResultPayload }
  | { type: 'error'; code: SearchErrorCode; message: string; source?: PublicSourceProduct };
