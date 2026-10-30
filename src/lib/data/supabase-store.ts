import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { CatalogProduct } from '../../types/product';
import type { SearchResultPayload } from '../../types/search';
import { computeMetrics } from './memory-store';
import type {
  ClickRecord,
  CommissionRecord,
  CorrectionRecord,
  DataStore,
  SearchEventRecord,
  SearchJobRecord,
  SyncRunRecord,
} from './types';

/**
 * Supabase (PostgreSQL) store. Server-only: uses the service-role key, which
 * bypasses RLS; every table has RLS enabled with no public policies, so the
 * anon key can read nothing. Never import this module from client code.
 */

type Row = Record<string, unknown>;

const jobToRow = (j: Partial<SearchJobRecord>): Row => {
  const map: Record<string, string> = {
    id: 'id', createdAt: 'created_at', finishedAt: 'finished_at', status: 'status', entryMode: 'entry_mode', sourceUrl: 'source_url',
    canonicalUrl: 'canonical_url', domain: 'domain', storeId: 'store_id', provider: 'provider', readMode: 'read_mode',
    sourceTitle: 'source_title', categoryId: 'category_id', resultCount: 'result_count', lowConfidenceCount: 'low_confidence_count',
    bestSavingsEur: 'best_savings_eur', errorCode: 'error_code', cacheHit: 'cache_hit', durationMs: 'duration_ms', timings: 'timings',
    providerCalls: 'provider_calls',
  };
  const row: Row = {};
  for (const [k, v] of Object.entries(j)) if (map[k] && v !== undefined) row[map[k]] = v;
  return row;
};

const rowToJob = (r: Row): SearchJobRecord => ({
  id: String(r.id),
  createdAt: String(r.created_at),
  finishedAt: (r.finished_at as string) ?? null,
  status: r.status as SearchJobRecord['status'],
  entryMode: r.entry_mode as SearchJobRecord['entryMode'],
  sourceUrl: String(r.source_url ?? ''),
  canonicalUrl: String(r.canonical_url ?? ''),
  domain: String(r.domain ?? ''),
  storeId: String(r.store_id ?? ''),
  provider: r.provider as SearchJobRecord['provider'],
  readMode: (r.read_mode as SearchJobRecord['readMode']) ?? null,
  sourceTitle: (r.source_title as string) ?? null,
  categoryId: (r.category_id as string) ?? null,
  resultCount: Number(r.result_count ?? 0),
  lowConfidenceCount: Number(r.low_confidence_count ?? 0),
  bestSavingsEur: r.best_savings_eur === null || r.best_savings_eur === undefined ? null : Number(r.best_savings_eur),
  errorCode: (r.error_code as SearchJobRecord['errorCode']) ?? null,
  cacheHit: Boolean(r.cache_hit),
  durationMs: r.duration_ms === null || r.duration_ms === undefined ? null : Number(r.duration_ms),
  timings: (r.timings as Record<string, number>) ?? {},
  providerCalls: Number(r.provider_calls ?? 0),
});

export function catalogToRow(p: CatalogProduct): Row {
  return {
    provider: p.provider,
    provider_product_id: p.providerProductId,
    title: p.title,
    description: p.description,
    image_url: p.image,
    images: p.images,
    price: p.price?.amount ?? null,
    price_high: p.priceHigh?.amount ?? null,
    list_price: p.listPrice?.amount ?? null,
    currency: p.price?.currency ?? null,
    shipping_cost: p.shippingCost?.amount ?? null,
    delivery_days_min: p.deliveryDays?.min ?? null,
    delivery_days_max: p.deliveryDays?.max ?? null,
    ships_to_es: p.shipsToSpain,
    availability: p.availability,
    rating: p.rating?.value ?? null,
    rating_count: p.rating?.count ?? null,
    orders_count: p.orders,
    category_path: p.categoryPath,
    attributes: p.attributes,
    product_url: p.productUrl,
    affiliate_url: p.affiliateUrl,
    affiliate_source: p.affiliateSource,
    gtin: p.gtin,
    mpn: p.mpn,
    seller_name: p.sellerName,
    price_checked_at: p.priceCheckedAt,
    availability_checked_at: p.availabilityCheckedAt,
    last_seen_at: new Date().toISOString(),
  };
}

export function rowToCatalog(r: Row): CatalogProduct {
  const currency = (r.currency as string) ?? 'EUR';
  const money = (v: unknown) => (v === null || v === undefined ? null : { amount: Number(v), currency });
  return {
    provider: r.provider as CatalogProduct['provider'],
    providerProductId: String(r.provider_product_id),
    title: String(r.title),
    description: (r.description as string) ?? null,
    image: (r.image_url as string) ?? null,
    images: (r.images as string[]) ?? [],
    price: money(r.price),
    priceHigh: money(r.price_high),
    listPrice: money(r.list_price),
    shippingCost: money(r.shipping_cost),
    deliveryDays: r.delivery_days_max === null || r.delivery_days_max === undefined ? null : { min: (r.delivery_days_min as number) ?? null, max: Number(r.delivery_days_max) },
    shipsToSpain: (r.ships_to_es as boolean | null) ?? null,
    availability: (r.availability as CatalogProduct['availability']) ?? 'unknown',
    rating: r.rating === null || r.rating === undefined ? null : { value: Number(r.rating), count: (r.rating_count as number) ?? null },
    orders: (r.orders_count as number) ?? null,
    categoryPath: (r.category_path as string[]) ?? [],
    attributes: (r.attributes as Record<string, string>) ?? {},
    variants: [],
    productUrl: (r.product_url as string) ?? null,
    affiliateUrl: (r.affiliate_url as string) ?? null,
    affiliateSource: (r.affiliate_source as CatalogProduct['affiliateSource']) ?? null,
    gtin: (r.gtin as string) ?? null,
    mpn: (r.mpn as string) ?? null,
    sellerName: (r.seller_name as string) ?? null,
    priceCheckedAt: (r.price_checked_at as string) ?? null,
    availabilityCheckedAt: (r.availability_checked_at as string) ?? null,
    isDemo: false,
  };
}

export class SupabaseStore implements DataStore {
  readonly kind = 'supabase' as const;
  readonly db: SupabaseClient;

  constructor(url: string, serviceRoleKey: string, fetchImpl?: typeof fetch) {
    this.db = createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: fetchImpl ? { fetch: fetchImpl } : {},
    });
  }

  private async run<T>(p: PromiseLike<{ data: T; error: { message: string } | null }>): Promise<T> {
    const { data, error } = await p;
    if (error) throw new Error(`Supabase: ${error.message}`);
    return data;
  }

  async createSearchJob(job: SearchJobRecord) {
    await this.run(this.db.from('search_jobs').insert(jobToRow(job)));
  }
  async finishSearchJob(id: string, patch: Partial<SearchJobRecord>) {
    await this.run(this.db.from('search_jobs').update(jobToRow(patch)).eq('id', id));
  }
  async getResult(key: string) {
    const data = await this.run(
      this.db.from('search_results').select('payload, stored_at, expires_at').eq('cache_key', key).gt('expires_at', new Date().toISOString()).maybeSingle(),
    );
    if (!data) return null;
    const row = data as Row;
    return { payload: row.payload as SearchResultPayload, storedAt: String(row.stored_at) };
  }
  async putResult(key: string, payload: SearchResultPayload, ttlSeconds: number) {
    const now = new Date();
    await this.run(
      this.db.from('search_results').upsert({
        cache_key: key,
        payload,
        stored_at: now.toISOString(),
        expires_at: new Date(now.getTime() + ttlSeconds * 1000).toISOString(),
      }),
    );
  }
  async upsertCatalogProducts(products: CatalogProduct[]) {
    for (let i = 0; i < products.length; i += 500) {
      await this.run(this.db.from('catalog_products').upsert(products.slice(i, i + 500).map(catalogToRow), { onConflict: 'provider,provider_product_id' }));
    }
  }
  async logEvent(e: SearchEventRecord) {
    await this.run(
      this.db.from('search_events').insert({
        type: e.type, at: e.at, search_id: e.searchId ?? null, path: e.path ?? null, domain: e.domain ?? null, entry_mode: e.entryMode ?? null,
        referrer_domain: e.referrerDomain ?? null, utm_source: e.utmSource ?? null, utm_medium: e.utmMedium ?? null, utm_campaign: e.utmCampaign ?? null,
        device_class: e.deviceClass ?? null, country: e.country ?? null, value: e.value ?? null,
      }),
    );
  }
  async logClick(c: ClickRecord) {
    await this.run(
      this.db.from('outbound_clicks').insert({
        click_id: c.clickId, at: c.at, search_id: c.searchId, provider: c.provider, provider_product_id: c.providerProductId, rank: c.rank,
        tier: c.tier, is_affiliate: c.isAffiliate, is_demo: c.isDemo, device_class: c.deviceClass, country: c.country,
      }),
    );
  }
  async saveCorrection(c: CorrectionRecord) {
    await this.run(
      this.db.from('product_corrections').insert({
        id: c.id, at: c.at, search_id: c.searchId, source_url: c.sourceUrl, provider_product_id: c.providerProductId, kind: c.kind, note: c.note, status: c.status,
      }),
    );
  }
  async getMetrics(from: string, to: string) {
    // Bounded reads; for larger volumes use the SQL views in supabase/migrations.
    const [jobs, events, clicks, commissions] = await Promise.all([
      this.run(this.db.from('search_jobs').select('*').gte('created_at', from).lte('created_at', to).order('created_at', { ascending: false }).limit(5000)),
      this.run(this.db.from('search_events').select('*').gte('at', from).lte('at', to).limit(20000)),
      this.run(this.db.from('outbound_clicks').select('*').gte('at', from).lte('at', to).limit(20000)),
      this.run(this.db.from('commission_reports').select('*').gte('transaction_date', from).lte('transaction_date', to).limit(5000)),
    ]);
    return computeMetrics(
      from,
      to,
      (jobs as Row[]).map(rowToJob),
      (events as Row[]).map((r) => ({
        type: r.type as SearchEventRecord['type'], at: String(r.at), searchId: (r.search_id as string) ?? null, path: (r.path as string) ?? null,
        domain: (r.domain as string) ?? null, entryMode: (r.entry_mode as SearchEventRecord['entryMode']) ?? null, referrerDomain: (r.referrer_domain as string) ?? null,
        utmSource: (r.utm_source as string) ?? null, utmMedium: (r.utm_medium as string) ?? null, utmCampaign: (r.utm_campaign as string) ?? null,
        deviceClass: (r.device_class as SearchEventRecord['deviceClass']) ?? null, country: (r.country as string) ?? null, value: (r.value as number) ?? null,
      })),
      (clicks as Row[]).map((r) => ({
        clickId: String(r.click_id), at: String(r.at), searchId: String(r.search_id), provider: r.provider as ClickRecord['provider'],
        providerProductId: String(r.provider_product_id), rank: Number(r.rank), tier: String(r.tier), isAffiliate: Boolean(r.is_affiliate),
        isDemo: Boolean(r.is_demo), deviceClass: (r.device_class as ClickRecord['deviceClass']) ?? null, country: (r.country as string) ?? null,
      })),
      (commissions as Row[]).map((r) => ({
        provider: r.provider as CommissionRecord['provider'], transactionId: String(r.transaction_id), clickRef: (r.click_ref as string) ?? null,
        status: String(r.status), saleAmount: (r.sale_amount as number) ?? null, commissionAmount: (r.commission_amount as number) ?? null,
        currency: (r.currency as string) ?? null, transactionDate: String(r.transaction_date),
      })),
    );
  }
  async recentSearches(limit: number) {
    const rows = await this.run(this.db.from('search_jobs').select('*').order('created_at', { ascending: false }).limit(limit));
    return (rows as Row[]).map(rowToJob);
  }
  async recentCorrections(limit: number) {
    const rows = await this.run(this.db.from('product_corrections').select('*').order('at', { ascending: false }).limit(limit));
    return (rows as Row[]).map((r) => ({
      id: String(r.id), at: String(r.at), searchId: (r.search_id as string) ?? null, sourceUrl: (r.source_url as string) ?? null,
      providerProductId: (r.provider_product_id as string) ?? null, kind: r.kind as CorrectionRecord['kind'], note: (r.note as string) ?? null,
      status: r.status as CorrectionRecord['status'],
    }));
  }
  async recentSyncRuns(limit: number) {
    const rows = await this.run(this.db.from('provider_sync_runs').select('*').order('started_at', { ascending: false }).limit(limit));
    return (rows as Row[]).map((r) => ({
      id: String(r.id), provider: r.provider as SyncRunRecord['provider'], kind: r.kind as SyncRunRecord['kind'], status: r.status as SyncRunRecord['status'],
      startedAt: String(r.started_at), finishedAt: (r.finished_at as string) ?? null, rowsRead: Number(r.rows_read ?? 0),
      rowsUpserted: Number(r.rows_upserted ?? 0), rowsRejected: Number(r.rows_rejected ?? 0), error: (r.error as string) ?? null,
    }));
  }
  async saveSyncRun(run: SyncRunRecord) {
    await this.run(
      this.db.from('provider_sync_runs').upsert({
        id: run.id, provider: run.provider, kind: run.kind, status: run.status, started_at: run.startedAt, finished_at: run.finishedAt,
        rows_read: run.rowsRead, rows_upserted: run.rowsUpserted, rows_rejected: run.rowsRejected, error: run.error,
      }),
    );
  }
  async incrementUsage(day: string, key: string, by = 1) {
    const data = await this.run(this.db.rpc('increment_usage', { p_day: day, p_key: key, p_by: by }));
    return Number(data ?? 0);
  }
  async saveCommissions(rows: CommissionRecord[]) {
    if (!rows.length) return;
    await this.run(
      this.db.from('commission_reports').upsert(
        rows.map((r) => ({
          provider: r.provider, transaction_id: r.transactionId, click_ref: r.clickRef, status: r.status, sale_amount: r.saleAmount,
          commission_amount: r.commissionAmount, currency: r.currency, transaction_date: r.transactionDate, imported_at: new Date().toISOString(),
        })),
        { onConflict: 'provider,transaction_id' },
      ),
    );
  }

  /** Catalogue search (used by the Awin provider) via the `search_catalog` SQL function. */
  async searchCatalog(q: { text: string; provider: string; maxPrice?: number; limit: number }): Promise<CatalogProduct[]> {
    const rows = await this.run(
      this.db.rpc('search_catalog', { p_query: q.text, p_provider: q.provider, p_max_price: q.maxPrice ?? null, p_limit: q.limit }),
    );
    return ((rows as Row[]) ?? []).map(rowToCatalog);
  }

  async countCatalog(provider: string): Promise<number> {
    const { count, error } = await this.db.from('catalog_products').select('provider_product_id', { count: 'exact', head: true }).eq('provider', provider);
    if (error) throw new Error(error.message);
    return count ?? 0;
  }
}
