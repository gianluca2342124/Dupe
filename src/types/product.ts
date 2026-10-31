/**
 * Core product domain types shared by extraction, matching, providers and UI.
 *
 * Rule of thumb: every field that we could not observe is `null` (or an empty
 * array). We never fill gaps with guesses — downstream code (scoring, savings,
 * UI) must treat `null` as "unknown", not as zero or as a default.
 */

export type Availability = 'in_stock' | 'out_of_stock' | 'preorder' | 'limited' | 'unknown';

/** How much we trust the extracted record as a whole. */
export type DataConfidence = 'high' | 'medium' | 'low';

export type ExtractionMethod =
  | 'json-ld'
  | 'microdata'
  | 'open-graph'
  | 'meta'
  | 'html'
  | 'adapter'
  | 'url-slug'
  | 'headless'
  | 'user-input'
  | 'example';

export interface Money {
  /** Amount in major units (e.g. 39.99). */
  amount: number;
  /** ISO 4217 code, upper-case. */
  currency: string;
}

/** Physical dimensions normalised to centimetres. */
export interface Dimensions {
  widthCm: number | null;
  heightCm: number | null;
  depthCm: number | null;
  diameterCm: number | null;
  lengthCm: number | null;
}

export interface StoreInfo {
  /** Stable id for known stores (e.g. "ikea"), or the registrable domain. */
  id: string;
  /** Human name ("IKEA", "Zara Home"…), or the domain when unknown. */
  name: string;
  /** True when the store is in our curated registry. */
  known: boolean;
}

/** The product the user wants an alternative for. */
export interface SourceProduct {
  /** URL exactly as the user submitted it (used for the "go to store" link). */
  originalUrl: string;
  /** Canonical URL (tracking params removed, store-specific cleanup). */
  canonicalUrl: string;
  /** Final URL after redirects, when a fetch happened. */
  finalUrl: string | null;
  host: string;
  domain: string;
  store: StoreInfo;
  title: string | null;
  description: string | null;
  image: string | null;
  images: string[];
  price: Money | null;
  /** When the store shows a price range (e.g. variants), the highest value. */
  priceHigh: Money | null;
  availability: Availability;
  brand: string | null;
  category: string | null;
  breadcrumbs: string[];
  color: string | null;
  material: string | null;
  shape: string | null;
  dimensions: Dimensions | null;
  variant: string | null;
  gtin: string | null;
  mpn: string | null;
  sku: string | null;
  rating: { value: number; count: number | null } | null;
  /** ISO timestamp of when the data was read from the store. */
  checkedAt: string;
  confidence: DataConfidence;
  /** Which extraction method produced each populated field. */
  fieldSources: Partial<Record<SourceField, ExtractionMethod>>;
  methods: ExtractionMethod[];
  /** How the record was obtained: the real page, only the URL text, an example, or a typed description. */
  readMode: 'page' | 'url-only' | 'example' | 'text';
  /** Why the store page could not be read (URL-only fallbacks only). */
  readIssue?: ReadIssue;
}

export type ReadIssueReason =
  | 'blocked'
  | 'robots_disallowed'
  | 'robots_unreachable'
  | 'not_product'
  | 'http_error'
  | 'timeout'
  | 'too_large'
  | 'unsupported_content'
  | 'fetch_failed'
  | 'blocked_host';

export interface ReadIssue {
  reason: ReadIssueReason;
  /** Short technical hint, safe to show: "HTTP 503", "dns_failed"… */
  detail?: string;
  /** Bot-protection signature when reason is "blocked" (see extraction/challenge). */
  block?: string;
}

export type SourceField =
  | 'title'
  | 'description'
  | 'image'
  | 'price'
  | 'availability'
  | 'brand'
  | 'category'
  | 'color'
  | 'material'
  | 'shape'
  | 'dimensions'
  | 'variant'
  | 'gtin'
  | 'mpn'
  | 'sku'
  | 'rating';

/** Normalised product coming from an affiliate/catalog provider (e.g. AliExpress). */
export interface CatalogProduct {
  provider: ProviderId;
  /** Provider's own product id. */
  providerProductId: string;
  title: string;
  description: string | null;
  image: string | null;
  images: string[];
  /** Current sale price for the default/cheapest variant shown by the provider. */
  price: Money | null;
  /** Highest variant price when the provider exposes a range. */
  priceHigh: Money | null;
  /** List/"original" price as reported by the provider (never used for savings). */
  listPrice: Money | null;
  /** Shipping cost to Spain when the provider reports it. `null` = unknown. */
  shippingCost: Money | null;
  /** Estimated delivery in days to Spain, when reported. */
  deliveryDays: { min: number | null; max: number | null } | null;
  /** `true`/`false` when the provider states it; `null` when unknown. */
  shipsToSpain: boolean | null;
  availability: Availability;
  rating: { value: number; count: number | null } | null;
  /** Units sold / orders as reported by the provider. */
  orders: number | null;
  categoryPath: string[];
  /** Free-form attributes reported by the provider (colour, material…). */
  attributes: Record<string, string>;
  variants: CatalogVariant[];
  /** Public product page (non-affiliate). */
  productUrl: string | null;
  /** Official affiliate/tracking link when the provider supplied one. */
  affiliateUrl: string | null;
  affiliateSource: AffiliateLinkSource | null;
  gtin: string | null;
  mpn: string | null;
  sellerName: string | null;
  /** ISO timestamps of the last provider confirmation. */
  priceCheckedAt: string | null;
  availabilityCheckedAt: string | null;
  /** True for fixtures from the demo catalogue. Never shown as real offers. */
  isDemo: boolean;
}

export interface CatalogVariant {
  id: string;
  label: string;
  attributes: Record<string, string>;
  price: Money | null;
  availability: Availability;
  image: string | null;
}

export type ProviderId = 'demo' | 'awin' | 'aliexpress';

export type AffiliateLinkSource = 'feed' | 'api' | 'deeplink';
