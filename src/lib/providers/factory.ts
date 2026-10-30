import type { AppConfig } from '../server/config';
import type { SupabaseStore } from '../data/supabase-store';
import { AliExpressClient } from './aliexpress/client';
import { AliExpressDirectProvider } from './aliexpress/provider';
import { AwinAliExpressProvider } from './awin/provider';
import { DemoCatalogProvider } from './demo/provider';
import type { AffiliateProductProvider } from './types';

/** PRODUCT_PROVIDER=demo|aliexpress|awin → provider instance. */
export function createProvider(config: AppConfig, deps: { fetch: typeof fetch; supabase: SupabaseStore | null }): AffiliateProductProvider {
  switch (config.provider) {
    case 'aliexpress':
      return new AliExpressDirectProvider(
        new AliExpressClient(
          {
            appKey: config.aliexpress.appKey ?? '',
            appSecret: config.aliexpress.appSecret ?? '',
            trackingId: config.aliexpress.trackingId,
          },
          deps.fetch,
          { timeoutMs: 8000 },
        ),
        {
          language: config.aliexpress.language,
          currency: config.aliexpress.currency,
          shipTo: config.aliexpress.shipTo,
          usePriceFilter: config.aliexpress.usePriceFilter,
          shippingLookups: config.aliexpress.shippingLookups,
        },
      );
    case 'awin':
      return new AwinAliExpressProvider(
        deps.supabase
          ? {
              search: (q) => deps.supabase!.searchCatalog(q),
              count: (p) => deps.supabase!.countCatalog(p),
            }
          : null,
        {
          publisherId: config.awin.publisherId,
          advertiserId: config.awin.advertiserId,
          deepLinkEnabled: config.awin.deepLinkEnabled,
        },
      );
    default:
      return new DemoCatalogProvider();
  }
}
