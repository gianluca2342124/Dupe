import type { CatalogProduct, Money } from '../../../types/product';
import { cleanImageUrl, cleanText, cleanUrl } from '../../security/sanitize';
import type {
  AffiliateProductProvider,
  ProviderCallContext,
  ProviderHealth,
  ProviderSearchQuery,
} from '../types';
import { ProviderError } from '../types';
import type { AliExpressClient } from './client';

/**
 * AliExpress Affiliate API provider (official Open Platform).
 *
 * Methods used (documented under "AE-Affiliate"):
 *   aliexpress.affiliate.product.query        keyword search (returns promotion_link with tracking_id)
 *   aliexpress.affiliate.productdetail.get    details incl. ean_code
 *   aliexpress.affiliate.product.shipping.get shipping fee + delivery days to a country
 *   aliexpress.affiliate.link.generate        official affiliate links for product URLs
 *
 * No affiliate image-search method is documented; image search only exists
 * in the separate Dropshipping API (aliexpress.ds.image.searchV2) which
 * needs a different app type and user authorisation — not assumed here.
 */

interface ApiProduct {
  product_id?: string | number;
  product_title?: string;
  product_main_image_url?: string;
  product_small_image_urls?: string[] | { string?: string[] };
  product_detail_url?: string;
  promotion_link?: string;
  target_sale_price?: string;
  target_sale_price_currency?: string;
  target_original_price?: string;
  target_original_price_currency?: string;
  sale_price?: string;
  sale_price_currency?: string;
  evaluate_rate?: string;
  lastest_volume?: string | number;
  first_level_category_name?: string;
  second_level_category_name?: string;
  shop_name?: string;
  ship_to_days?: string;
  sku_id?: string | number;
  tax_rate?: string;
  ean_code?: string;
}

export interface AliExpressProviderOptions {
  language: string; // "ES"
  currency: string; // "EUR"
  shipTo: string; // "ES"
  /** Pass max_sale_price (documented in cents) to the API. Off by default; we filter locally. */
  usePriceFilter: boolean;
  /** Look up real shipping cost/delivery for the best N candidates (1 API call each). */
  shippingLookups: number;
  now?: () => Date;
}

/**
 * Lists come either as plain arrays (simplified responses) or wrapped in a
 * single-key object (`{ product: [...] }`, `{ promotion_link: [...] }`,
 * `{ string: [...] }`) in the classic format. Accept both.
 */
export function asList<T>(v: unknown): T[] {
  if (Array.isArray(v)) return v as T[];
  if (v && typeof v === 'object') {
    for (const inner of Object.values(v as Record<string, unknown>)) if (Array.isArray(inner)) return inner as T[];
  }
  return [];
}

function money(amount: unknown, currency: unknown): Money | null {
  const n = typeof amount === 'number' ? amount : typeof amount === 'string' ? Number(amount.replace(',', '.')) : NaN;
  if (!Number.isFinite(n) || n <= 0 || typeof currency !== 'string' || !/^[A-Z]{3}$/.test(currency)) return null;
  return { amount: Math.round(n * 100) / 100, currency };
}

export function mapAliExpressProduct(p: ApiProduct, nowIso: string): CatalogProduct | null {
  const id = p.product_id !== undefined ? String(p.product_id) : null;
  const title = cleanText(p.product_title, 300);
  if (!id || !title) return null;
  const price = money(p.target_sale_price, p.target_sale_price_currency) ?? money(p.sale_price, p.sale_price_currency);
  const rate = p.evaluate_rate ? Number(String(p.evaluate_rate).replace('%', '')) : NaN;
  const days = p.ship_to_days ? /(\d{1,2})\s*day/i.exec(p.ship_to_days)?.[1] : undefined;
  const smallImages = asList<string>(p.product_small_image_urls);
  const affiliateUrl = cleanUrl(p.promotion_link);
  return {
    provider: 'aliexpress',
    providerProductId: id,
    title,
    description: null,
    image: cleanImageUrl(p.product_main_image_url),
    images: [p.product_main_image_url, ...smallImages].map((u) => cleanImageUrl(u)).filter((u): u is string => !!u).slice(0, 6),
    price,
    priceHigh: null,
    listPrice: money(p.target_original_price, p.target_original_price_currency),
    shippingCost: null,
    deliveryDays: days ? { min: null, max: Number(days) } : null,
    // We always query with ship_to_country=ES, which filters to shippable items.
    shipsToSpain: true,
    availability: 'unknown',
    rating: Number.isFinite(rate) && rate > 0 ? { value: Math.round((rate / 20) * 10) / 10, count: null } : null,
    orders: p.lastest_volume !== undefined && Number.isFinite(Number(p.lastest_volume)) ? Number(p.lastest_volume) : null,
    categoryPath: [p.first_level_category_name, p.second_level_category_name].filter((c): c is string => !!c),
    attributes: {
      ...(p.evaluate_rate ? { positive_rate: String(p.evaluate_rate) } : {}),
      ...(p.sku_id !== undefined ? { sku_id: String(p.sku_id) } : {}),
      ...(p.tax_rate ? { tax_rate: String(p.tax_rate) } : {}),
    },
    variants: [],
    productUrl: cleanUrl(p.product_detail_url),
    affiliateUrl,
    affiliateSource: affiliateUrl ? 'api' : null,
    gtin: p.ean_code ? p.ean_code.replace(/\D/g, '') || null : null,
    mpn: null,
    sellerName: cleanText(p.shop_name, 80),
    priceCheckedAt: price ? nowIso : null,
    availabilityCheckedAt: null,
    isDemo: false,
  };
}

function checkResp(payload: Record<string, unknown>): Record<string, unknown> | null {
  const resp = payload.resp_result as Record<string, unknown> | undefined;
  if (!resp) return null;
  const code = Number(resp.resp_code);
  if (code === 200) return (resp.result as Record<string, unknown>) ?? null;
  // 405 and friends: "result is empty" — not an error for us.
  if (/empty|no data|no result/i.test(String(resp.resp_msg ?? ''))) return null;
  throw new ProviderError('aliexpress', 'upstream', `resp_code ${resp.resp_code}: ${String(resp.resp_msg ?? '')}`);
}

export class AliExpressDirectProvider implements AffiliateProductProvider {
  readonly id = 'aliexpress' as const;
  readonly label = 'AliExpress';
  readonly capabilities = {
    textSearch: true,
    imageSearch: false,
    productDetails: true,
    affiliateLinks: true,
    isDemo: false,
  };

  constructor(private readonly client: AliExpressClient, private readonly opts: AliExpressProviderOptions) {}

  private nowIso() {
    return (this.opts.now?.() ?? new Date()).toISOString();
  }

  async searchByText(q: ProviderSearchQuery, ctx?: ProviderCallContext): Promise<CatalogProduct[]> {
    ctx?.onCall?.('aliexpress', 'product.query');
    const payload = await this.client.call(
      'aliexpress.affiliate.product.query',
      {
        keywords: q.text,
        page_no: 1,
        page_size: Math.min(50, Math.max(1, q.limit)),
        target_currency: this.opts.currency,
        target_language: q.lang === 'es' ? 'ES' : this.opts.language === 'ES' ? 'ES' : 'EN',
        ship_to_country: this.opts.shipTo,
        tracking_id: this.client.trackingId ?? undefined,
        platform_product_type: 'ALL',
        max_sale_price: this.opts.usePriceFilter && q.maxPrice ? Math.round(q.maxPrice * 100) : undefined,
      },
      ctx?.signal,
    );
    const result = checkResp(payload);
    if (!result) return [];
    const now = this.nowIso();
    const products = asList<ApiProduct>(result.products)
      .map((p) => mapAliExpressProduct(p, now))
      .filter((p): p is CatalogProduct => !!p);
    return products;
  }

  async getProductDetails(ids: string[], ctx?: ProviderCallContext): Promise<CatalogProduct[]> {
    if (!ids.length) return [];
    ctx?.onCall?.('aliexpress', 'productdetail.get');
    const payload = await this.client.call(
      'aliexpress.affiliate.productdetail.get',
      {
        product_ids: ids.slice(0, 20).join(','),
        target_currency: this.opts.currency,
        target_language: this.opts.language,
        country: this.opts.shipTo,
        tracking_id: this.client.trackingId ?? undefined,
      },
      ctx?.signal,
    );
    const result = checkResp(payload);
    if (!result) return [];
    const now = this.nowIso();
    return asList<ApiProduct>(result.products)
      .map((p) => mapAliExpressProduct(p, now))
      .filter((p): p is CatalogProduct => !!p);
  }

  /** Fills shippingCost/deliveryDays from product.shipping.get (needs sku_id + tax_rate). */
  async enrichShipping(products: CatalogProduct[], ctx?: ProviderCallContext): Promise<void> {
    const targets = products.filter((p) => p.provider === 'aliexpress' && p.attributes.sku_id && p.price).slice(0, this.opts.shippingLookups);
    await Promise.allSettled(
      targets.map(async (p) => {
        ctx?.onCall?.('aliexpress', 'product.shipping.get');
        const payload = await this.client.call(
          'aliexpress.affiliate.product.shipping.get',
          {
            product_id: p.providerProductId,
            sku_id: p.attributes.sku_id,
            ship_to_country: this.opts.shipTo,
            target_currency: this.opts.currency,
            target_sale_price: p.price!.amount.toFixed(2),
            target_language: this.opts.language,
            tax_rate: p.attributes.tax_rate ?? '0',
          },
          ctx?.signal,
        );
        const result = checkResp(payload);
        if (!result) return;
        const fee = Number(result.shipping_fee);
        if (Number.isFinite(fee) && fee >= 0) p.shippingCost = { amount: Math.round(fee * 100) / 100, currency: this.opts.currency };
        const min = Number(result.min_delivery_days);
        const max = Number(result.max_delivery_days ?? result.delivery_days);
        if (Number.isFinite(max) && max > 0) p.deliveryDays = { min: Number.isFinite(min) && min > 0 ? min : null, max };
      }),
    );
  }

  async generateAffiliateLinks(products: CatalogProduct[], ctx?: ProviderCallContext): Promise<Map<string, string>> {
    const links = new Map<string, string>();
    const trackingId = this.client.trackingId;
    if (!trackingId) return links;
    const pending = products.filter((p) => !p.affiliateUrl && p.productUrl);
    for (let i = 0; i < pending.length; i += 50) {
      const batch = pending.slice(i, i + 50);
      ctx?.onCall?.('aliexpress', 'link.generate');
      const payload = await this.client.call(
        'aliexpress.affiliate.link.generate',
        {
          promotion_link_type: 0,
          source_values: batch.map((p) => p.productUrl).join(','),
          tracking_id: trackingId,
          ship_to_country: this.opts.shipTo,
        },
        ctx?.signal,
      );
      const result = checkResp(payload);
      const rows = asList<{ promotion_link?: string; source_value?: string }>(
        (result?.promotion_links as unknown) ?? [],
      );
      for (const row of rows) {
        const product = batch.find((p) => p.productUrl === row.source_value);
        const link = cleanUrl(row.promotion_link);
        if (product && link) links.set(product.providerProductId, link);
      }
    }
    return links;
  }

  async healthCheck(): Promise<ProviderHealth> {
    try {
      await this.searchByText({ text: 'table lamp', lang: 'en', limit: 1, shipTo: this.opts.shipTo, currency: this.opts.currency });
      return { ok: true, configured: true, message: 'AliExpress API reachable' };
    } catch (err) {
      const e = err as ProviderError;
      return { ok: false, configured: e.code !== 'not_configured', message: e.message };
    }
  }
}
