import type { CatalogProduct } from '../../types/product';
import type { SearchResultPayload } from '../../types/search';
import type {
  AdminMetrics,
  ClickRecord,
  CommissionRecord,
  CorrectionRecord,
  DataStore,
  SearchEventRecord,
  SearchJobRecord,
  SyncRunRecord,
} from './types';

const MAX = 5000;

function capPush<T>(list: T[], item: T) {
  list.push(item);
  if (list.length > MAX) list.splice(0, list.length - MAX);
}

function top<K extends string>(items: K[], n: number): { key: K; count: number }[] {
  const counts = new Map<K, number>();
  for (const i of items) counts.set(i, (counts.get(i) ?? 0) + 1);
  return [...counts.entries()].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count).slice(0, n);
}

export function computeMetrics(
  from: string,
  to: string,
  jobs: SearchJobRecord[],
  events: SearchEventRecord[],
  clicks: ClickRecord[],
  commissions: CommissionRecord[],
): AdminMetrics {
  const inRange = (t: string) => t >= from && t <= to;
  const j = jobs.filter((x) => inRange(x.createdAt));
  const e = events.filter((x) => inRange(x.at));
  const c = clicks.filter((x) => inRange(x.at));
  const done = j.filter((x) => x.status !== 'running');
  const durations = done.map((x) => x.durationMs).filter((x): x is number => typeof x === 'number').sort((a, b) => a - b);
  const withResults = done.filter((x) => x.resultCount > 0).length;
  const shown = e.filter((x) => x.type === 'results_shown').length || withResults;
  const com = commissions.filter((x) => inRange(x.transactionDate));
  const jobById = new Map(j.map((x) => [x.id, x]));
  const catClicks = new Map<string, number>();
  for (const click of c) {
    const cat = jobById.get(click.searchId)?.categoryId;
    if (cat) catClicks.set(cat, (catClicks.get(cat) ?? 0) + 1);
  }
  return {
    range: { from, to },
    searches: done.length,
    searchesWithResults: withResults,
    extractionOk: done.filter((x) => x.readMode === 'page' || x.readMode === 'example').length,
    extractionUrlOnly: done.filter((x) => x.readMode === 'url-only').length,
    extractionFailed: done.filter((x) => x.readMode === null).length,
    avgResults: done.length ? Math.round((done.reduce((s, x) => s + x.resultCount, 0) / done.length) * 10) / 10 : 0,
    avgDurationMs: durations.length ? Math.round(durations.reduce((s, x) => s + x, 0) / durations.length) : null,
    p95DurationMs: durations.length ? durations[Math.min(durations.length - 1, Math.floor(durations.length * 0.95))]! : null,
    cacheHitRate: done.length ? Math.round((done.filter((x) => x.cacheHit).length / done.length) * 100) / 100 : 0,
    pageviews: e.filter((x) => x.type === 'pageview').length,
    clicks: c.length,
    affiliateClicks: c.filter((x) => x.isAffiliate).length,
    ctr: shown ? Math.round((c.length / shown) * 1000) / 1000 : 0,
    topDomains: top(done.map((x) => x.domain), 10).map(({ key, count }) => ({ domain: key, count })),
    topProducts: top(done.filter((x) => x.sourceTitle).map((x) => JSON.stringify([x.sourceTitle, x.canonicalUrl])), 10).map(({ key, count }) => {
      const [title, url] = JSON.parse(key) as [string, string];
      return { title, url, count };
    }),
    topCategories: top(done.filter((x) => x.categoryId).map((x) => x.categoryId as string), 10).map(({ key, count }) => ({
      categoryId: key,
      searches: count,
      clicks: catClicks.get(key) ?? 0,
    })),
    topClickedProducts: top(c.map((x) => `${x.provider}:${x.providerProductId}`), 10).map(({ key, count }) => {
      const [provider, ...rest] = key.split(':');
      return { provider: provider ?? '', providerProductId: rest.join(':'), clicks: count };
    }),
    entryModes: top(done.map((x) => x.entryMode), 6).map(({ key, count }) => ({ mode: key, count })),
    trafficSources: top(e.filter((x) => x.type === 'pageview').map((x) => x.utmSource ?? x.referrerDomain ?? 'directo'), 10).map(({ key, count }) => ({ source: key, count })),
    errors: top(done.filter((x) => x.errorCode).map((x) => x.errorCode as string), 10).map(({ key, count }) => ({ code: key, count })),
    providerCalls: done.reduce((s, x) => s + (x.providerCalls ?? 0), 0),
    commissions: com.length
      ? { count: com.length, amount: Math.round(com.reduce((s, x) => s + (x.commissionAmount ?? 0), 0) * 100) / 100, currency: com[0]?.currency ?? null }
      : null,
  };
}

/** In-memory store: per-isolate, bounded, lost on restart. For dev, tests and demo deployments. */
export class MemoryStore implements DataStore {
  readonly kind = 'memory' as const;
  private readonly jobs: SearchJobRecord[] = [];
  private readonly events: SearchEventRecord[] = [];
  private readonly clicks: ClickRecord[] = [];
  private readonly corrections: CorrectionRecord[] = [];
  private readonly syncRuns: SyncRunRecord[] = [];
  private readonly commissions: CommissionRecord[] = [];
  private readonly results = new Map<string, { payload: SearchResultPayload; storedAt: string; expires: number }>();
  private readonly catalog = new Map<string, CatalogProduct>();
  private readonly usage = new Map<string, number>();

  async createSearchJob(job: SearchJobRecord) {
    capPush(this.jobs, { ...job });
  }
  async finishSearchJob(id: string, patch: Partial<SearchJobRecord>) {
    const job = this.jobs.find((j) => j.id === id);
    if (job) Object.assign(job, patch);
  }
  async getResult(key: string) {
    const r = this.results.get(key);
    if (!r || r.expires < Date.now()) return null;
    return { payload: r.payload, storedAt: r.storedAt };
  }
  async putResult(key: string, payload: SearchResultPayload, ttlSeconds: number) {
    if (this.results.size > 2000) this.results.delete(this.results.keys().next().value!);
    this.results.set(key, { payload, storedAt: new Date().toISOString(), expires: Date.now() + ttlSeconds * 1000 });
  }
  async upsertCatalogProducts(products: CatalogProduct[]) {
    for (const p of products) this.catalog.set(`${p.provider}:${p.providerProductId}`, p);
  }
  async logEvent(e: SearchEventRecord) {
    capPush(this.events, e);
  }
  async logClick(c: ClickRecord) {
    capPush(this.clicks, c);
  }
  async saveCorrection(c: CorrectionRecord) {
    capPush(this.corrections, c);
  }
  async getMetrics(from: string, to: string) {
    return computeMetrics(from, to, this.jobs, this.events, this.clicks, this.commissions);
  }
  async recentSearches(limit: number) {
    return [...this.jobs].reverse().slice(0, limit);
  }
  async recentCorrections(limit: number) {
    return [...this.corrections].reverse().slice(0, limit);
  }
  async recentSyncRuns(limit: number) {
    return [...this.syncRuns].reverse().slice(0, limit);
  }
  async saveSyncRun(run: SyncRunRecord) {
    const i = this.syncRuns.findIndex((r) => r.id === run.id);
    if (i >= 0) this.syncRuns[i] = run;
    else capPush(this.syncRuns, run);
  }
  async incrementUsage(day: string, key: string, by = 1) {
    const k = `${day}:${key}`;
    const v = (this.usage.get(k) ?? 0) + by;
    this.usage.set(k, v);
    return v;
  }
  async saveCommissions(rows: CommissionRecord[]) {
    for (const r of rows) {
      const i = this.commissions.findIndex((c) => c.provider === r.provider && c.transactionId === r.transactionId);
      if (i >= 0) this.commissions[i] = r;
      else capPush(this.commissions, r);
    }
  }
}
