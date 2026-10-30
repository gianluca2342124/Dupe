import type { CatalogProduct } from '../../../types/product';
import type { AffiliateProductProvider, ProviderCallContext, ProviderHealth, ProviderSearchQuery } from '../types';
import { ProviderError } from '../types';

/**
 * Awin provider: searches the catalogue that scripts/sync-awin-feed.ts imports
 * from the authorised AliExpress (or other) Awin feed. A feed is a periodic
 * download, not a live search API — results are as fresh as the last sync,
 * which is shown in the UI ("comprobado el …").
 */
export interface CatalogIndex {
  search(query: { text: string; provider: 'awin'; maxPrice?: number; limit: number }): Promise<CatalogProduct[]>;
  count(provider: 'awin'): Promise<number>;
}

/** Official Awin deep link (cread.php) — only when deep linking is enabled for the programme. */
export function buildAwinDeepLink(opts: { advertiserId: string; publisherId: string; destination: string; clickRef?: string }): string {
  const params = new URLSearchParams({ awinmid: opts.advertiserId, awinaffid: opts.publisherId });
  if (opts.clickRef) params.set('clickref', opts.clickRef);
  params.set('ued', opts.destination);
  return `https://www.awin1.com/cread.php?${params.toString()}`;
}

export class AwinAliExpressProvider implements AffiliateProductProvider {
  readonly id = 'awin' as const;
  readonly label = 'AliExpress (vía Awin)';
  readonly capabilities = {
    textSearch: true,
    imageSearch: false,
    productDetails: false,
    affiliateLinks: true,
    isDemo: false,
  };

  constructor(
    private readonly index: CatalogIndex | null,
    private readonly cfg: { publisherId: string | null; advertiserId: string | null; deepLinkEnabled: boolean },
  ) {}

  async searchByText(q: ProviderSearchQuery, ctx?: ProviderCallContext): Promise<CatalogProduct[]> {
    if (!this.index) throw new ProviderError('awin', 'not_configured', 'Awin catalogue requires Supabase (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)');
    ctx?.onCall?.('awin', 'catalog.search');
    return this.index.search({ text: q.text, provider: 'awin', limit: q.limit, ...(q.maxPrice ? { maxPrice: q.maxPrice } : {}) });
  }

  async generateAffiliateLinks(products: CatalogProduct[]): Promise<Map<string, string>> {
    const out = new Map<string, string>();
    if (!this.cfg.deepLinkEnabled || !this.cfg.publisherId || !this.cfg.advertiserId) return out;
    for (const p of products) {
      if (p.affiliateUrl || !p.productUrl) continue;
      out.set(p.providerProductId, buildAwinDeepLink({ advertiserId: this.cfg.advertiserId, publisherId: this.cfg.publisherId, destination: p.productUrl }));
    }
    return out;
  }

  async healthCheck(): Promise<ProviderHealth> {
    if (!this.index) return { ok: false, configured: false, message: 'Supabase not configured: no catalogue to search' };
    try {
      const n = await this.index.count('awin');
      return { ok: n > 0, configured: true, message: n > 0 ? `${n} Awin products indexed` : 'Catalogue is empty: run the feed sync' };
    } catch (err) {
      return { ok: false, configured: true, message: (err as Error).message };
    }
  }
}
