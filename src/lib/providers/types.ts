import type { CatalogProduct, ProviderId } from '../../types/product';

/**
 * Contract every product source must implement (AliExpress API, Awin feeds,
 * demo catalogue…). The matching engine only talks to this interface.
 */
export interface ProviderSearchQuery {
  text: string;
  lang: 'en' | 'es';
  maxPrice?: number;
  limit: number;
  /** Always "ES" for now; kept explicit for future markets. */
  shipTo: string;
  currency: string;
}

export interface ProviderCapabilities {
  textSearch: boolean;
  /** Only true when the provider documents image search AND our account is authorised for it. */
  imageSearch: boolean;
  productDetails: boolean;
  /** Can return or generate official affiliate links. */
  affiliateLinks: boolean;
  /** Results are fixtures — never present them as real offers. */
  isDemo: boolean;
}

export interface ProviderCallContext {
  /** Abort long provider calls when the overall search budget is exhausted. */
  signal?: AbortSignal;
  /** Cost accounting hook (API calls, units). */
  onCall?: (provider: ProviderId, operation: string, units?: number) => void;
}

export interface ProviderHealth {
  ok: boolean;
  configured: boolean;
  message: string;
}

export interface AffiliateProductProvider {
  readonly id: ProviderId;
  readonly label: string;
  readonly capabilities: ProviderCapabilities;
  searchByText(query: ProviderSearchQuery, ctx?: ProviderCallContext): Promise<CatalogProduct[]>;
  searchByImage?(imageUrl: string, ctx?: ProviderCallContext): Promise<CatalogProduct[]>;
  getProductDetails?(ids: string[], ctx?: ProviderCallContext): Promise<CatalogProduct[]>;
  /**
   * Returns official affiliate links for products that don't already carry
   * one, keyed by providerProductId. Must never fabricate links: products the
   * provider cannot link are simply absent from the map.
   */
  generateAffiliateLinks?(products: CatalogProduct[], ctx?: ProviderCallContext): Promise<Map<string, string>>;
  healthCheck(): Promise<ProviderHealth>;
}

export class ProviderError extends Error {
  constructor(
    public readonly provider: ProviderId,
    public readonly code: 'not_configured' | 'auth' | 'rate_limited' | 'timeout' | 'bad_response' | 'upstream' | 'circuit_open',
    message: string,
    public readonly retryable = false,
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}
