import type { CatalogProduct, ProviderId } from '../../types/product';
import type { EntryMode, SearchErrorCode, SearchResultPayload } from '../../types/search';

/**
 * Persistence contract. Implemented by MemoryStore (dev/tests/demo) and
 * SupabaseStore (production). No personal data is stored: no IPs, no user
 * agents, no cookies — only coarse, aggregated-friendly fields.
 */

export interface SearchJobRecord {
  id: string;
  createdAt: string;
  finishedAt: string | null;
  status: 'running' | 'done' | 'failed';
  entryMode: EntryMode;
  sourceUrl: string;
  canonicalUrl: string;
  domain: string;
  storeId: string;
  provider: ProviderId;
  readMode: 'page' | 'url-only' | 'example' | 'text' | null;
  sourceTitle: string | null;
  categoryId: string | null;
  resultCount: number;
  lowConfidenceCount: number;
  bestSavingsEur: number | null;
  errorCode: SearchErrorCode | null;
  cacheHit: boolean;
  durationMs: number | null;
  timings: Record<string, number>;
  providerCalls: number;
}

export interface SearchEventRecord {
  type:
    | 'pageview'
    | 'search_submitted'
    | 'search_completed'
    | 'search_failed'
    | 'results_shown'
    | 'share'
    | 'copy_link'
    | 'correction';
  at: string;
  searchId?: string | null;
  path?: string | null;
  domain?: string | null;
  entryMode?: EntryMode | null;
  referrerDomain?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  deviceClass?: 'mobile' | 'tablet' | 'desktop' | 'bot' | null;
  country?: string | null;
  value?: number | null;
}

export interface ClickRecord {
  clickId: string;
  at: string;
  searchId: string;
  provider: ProviderId;
  providerProductId: string;
  rank: number;
  tier: string;
  isAffiliate: boolean;
  isDemo: boolean;
  deviceClass: 'mobile' | 'tablet' | 'desktop' | 'bot' | null;
  country: string | null;
}

export interface CorrectionRecord {
  id: string;
  at: string;
  searchId: string | null;
  sourceUrl: string | null;
  providerProductId: string | null;
  kind: 'not_similar' | 'wrong_price' | 'unavailable' | 'counterfeit' | 'other';
  note: string | null;
  status: 'open' | 'reviewed' | 'applied' | 'dismissed';
}

export interface SyncRunRecord {
  id: string;
  provider: ProviderId;
  kind: 'feed_import' | 'price_refresh' | 'commission_import' | 'maintenance';
  status: 'running' | 'success' | 'failed';
  startedAt: string;
  finishedAt: string | null;
  rowsRead: number;
  rowsUpserted: number;
  rowsRejected: number;
  error: string | null;
}

export interface CommissionRecord {
  provider: ProviderId;
  transactionId: string;
  clickRef: string | null;
  status: string;
  saleAmount: number | null;
  commissionAmount: number | null;
  currency: string | null;
  transactionDate: string;
}

export interface AdminMetrics {
  range: { from: string; to: string };
  searches: number;
  searchesWithResults: number;
  extractionOk: number;
  extractionUrlOnly: number;
  extractionFailed: number;
  avgResults: number;
  avgDurationMs: number | null;
  p95DurationMs: number | null;
  cacheHitRate: number;
  pageviews: number;
  clicks: number;
  affiliateClicks: number;
  ctr: number;
  topDomains: { domain: string; count: number }[];
  topProducts: { title: string; url: string; count: number }[];
  topCategories: { categoryId: string; searches: number; clicks: number }[];
  topClickedProducts: { provider: string; providerProductId: string; clicks: number }[];
  entryModes: { mode: string; count: number }[];
  trafficSources: { source: string; count: number }[];
  errors: { code: string; count: number }[];
  providerCalls: number;
  /** Conversions imported from the network (verified), kept apart from local clicks. */
  commissions: { count: number; amount: number; currency: string | null } | null;
}

export interface DataStore {
  readonly kind: 'memory' | 'supabase';
  createSearchJob(job: SearchJobRecord): Promise<void>;
  finishSearchJob(id: string, patch: Partial<SearchJobRecord>): Promise<void>;
  getResult(key: string): Promise<{ payload: SearchResultPayload; storedAt: string } | null>;
  putResult(key: string, payload: SearchResultPayload, ttlSeconds: number): Promise<void>;
  upsertCatalogProducts(products: CatalogProduct[]): Promise<void>;
  logEvent(e: SearchEventRecord): Promise<void>;
  logClick(c: ClickRecord): Promise<void>;
  saveCorrection(c: CorrectionRecord): Promise<void>;
  getMetrics(from: string, to: string): Promise<AdminMetrics>;
  recentSearches(limit: number): Promise<SearchJobRecord[]>;
  recentCorrections(limit: number): Promise<CorrectionRecord[]>;
  recentSyncRuns(limit: number): Promise<SyncRunRecord[]>;
  saveSyncRun(run: SyncRunRecord): Promise<void>;
  /** Atomic-ish daily counter (cost control). Returns the new value. */
  incrementUsage(day: string, key: string, by?: number): Promise<number>;
  saveCommissions(rows: CommissionRecord[]): Promise<void>;
}
