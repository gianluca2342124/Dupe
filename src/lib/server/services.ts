import { DEFAULT_MATCHING_CONFIG } from '../../config/matching';
import type { SourceProduct } from '../../types/product';
import { AffiliateLinkService, MemoryLinkCache } from '../affiliate/links';
import { ResultCache, type KVNamespaceLike } from '../data/cache';
import { MemoryStore } from '../data/memory-store';
import { SupabaseStore } from '../data/supabase-store';
import type { DataStore } from '../data/types';
import { BOT_USER_AGENT_TOKEN, botUserAgent, FixturePageFetcher, LivePageFetcher } from '../extraction/fetchers';
import { FIXTURE_PAGES } from '../extraction/fixtures';
import { CloudflareBrowserRendering } from '../extraction/headless';
import { ProductExtractionService } from '../extraction/service';
import { createProvider } from '../providers/factory';
import { DemoCatalogProvider } from '../providers/demo/provider';
import type { AffiliateProductProvider } from '../providers/types';
import { SearchService, type VisionAnalyzer } from '../search/service';
import { DohResolver } from '../security/dns';
import type { HostPolicyConfig } from '../security/host-policy';
import { CloudflareRateLimiter, MemoryRateLimiter, NoopRateLimiter, type CloudflareRateLimitBinding, type RateLimiter } from '../security/rate-limit';
import { RobotsChecker } from '../security/robots';
import { createSafeFetcher } from '../security/safe-fetch';
import { buildConfig, SECRET_ENV_NAMES, type AppConfig } from './config';
import { createLogger, type Logger } from './logger';
import { AnthropicVisionAnalyzer } from '../matching/vision';

export interface Services {
  config: AppConfig;
  logger: Logger;
  store: DataStore;
  supabase: SupabaseStore | null;
  cache: ResultCache;
  provider: AffiliateProductProvider;
  search: SearchService;
  searchLimiter: RateLimiter;
  clickLimiter: RateLimiter;
  hostPolicy: HostPolicyConfig;
}

let instance: Services | null = null;
let instanceKey = '';

/** Lazily builds the per-isolate service graph from Worker env + bindings. */
export function getServices(env: Record<string, unknown>): Services {
  const key = JSON.stringify(
    Object.fromEntries(Object.entries(env).filter(([, v]) => typeof v === 'string' || typeof v === 'boolean' || typeof v === 'number')),
  );
  if (instance && key === instanceKey) return instance;

  const config = buildConfig(env);
  const secrets = SECRET_ENV_NAMES.map((n) => env[n]).filter((v): v is string => typeof v === 'string' && v.length > 0);
  const logger = createLogger(config.logLevel, secrets);
  const fetchImpl: typeof fetch = (input, init) => fetch(input, init);

  const supabase =
    config.supabase.url && config.supabase.serviceRoleKey ? new SupabaseStore(config.supabase.url, config.supabase.serviceRoleKey, fetchImpl) : null;
  const store: DataStore = supabase ?? new MemoryStore();
  const kv = (env.GEMELU_CACHE as KVNamespaceLike | undefined) ?? null;
  const cache = new ResultCache(kv, supabase, { memorySeconds: 900, kvSeconds: 6 * 3600, storeSeconds: 24 * 3600 });

  const own = [new URL(config.siteUrl).hostname, 'gemelu.com', 'localhost'];
  const hostPolicy: HostPolicyConfig = {
    mode: config.hostPolicy.mode,
    allowlist: config.hostPolicy.allowlist,
    denylist: config.hostPolicy.denylist,
    ownHosts: own,
  };

  const userAgent = botUserAgent(config.siteUrl);
  const safeFetch = createSafeFetcher({ fetch: fetchImpl, resolver: config.dnsGuard ? new DohResolver(fetchImpl) : null, policy: hostPolicy });
  const fixtures = config.fetchMode === 'fixtures';
  const robots = !fixtures && config.robotsPolicy === 'respect' ? new RobotsChecker(safeFetch, userAgent, BOT_USER_AGENT_TOKEN) : null;
  const fetcher = fixtures ? new FixturePageFetcher(FIXTURE_PAGES) : new LivePageFetcher(safeFetch, userAgent, { timeoutMs: 9000, maxBytes: 4_500_000 }, robots);
  const headless =
    config.browserRendering.accountId && config.browserRendering.token && config.headlessHosts.length
      ? new CloudflareBrowserRendering(config.browserRendering.accountId, config.browserRendering.token, userAgent, fetchImpl)
      : null;
  const extraction = new ProductExtractionService({ fetcher, robots, headless, headlessHosts: config.headlessHosts });

  const provider = createProvider(config, { fetch: fetchImpl, supabase });
  const demoProvider = provider.capabilities.isDemo ? provider : new DemoCatalogProvider();

  const kvSource = kv
    ? {
        get: async (k: string) => ((await kv.get(`s:${k}`, 'json')) as SourceProduct | null) ?? null,
        put: (k: string, v: SourceProduct) => kv.put(`s:${k}`, JSON.stringify(v), { expirationTtl: 24 * 3600 }),
      }
    : null;

  const vision: VisionAnalyzer | null =
    config.vision.provider === 'anthropic' && config.vision.apiKey
      ? new AnthropicVisionAnalyzer({ apiKey: config.vision.apiKey, model: config.vision.model, fetch: fetchImpl, store, dailyLimit: config.vision.dailyLimit, logger })
      : null;

  const search = new SearchService({
    store,
    cache,
    extraction,
    provider,
    demoProvider,
    links: new AffiliateLinkService(new MemoryLinkCache()),
    matching: DEFAULT_MATCHING_CONFIG,
    hostPolicy,
    linkSecret: config.linkSigningSecret ?? 'insecure-dev-secret',
    siteUrl: config.siteUrl,
    showSimilarityPercent: config.showSimilarityPercent,
    dailyBudget: config.dailySearchBudget,
    logger,
    vision,
    kvSource,
  });

  const limiter = (binding: unknown, perMinute: number): RateLimiter => {
    if (config.rateLimitMode === 'off') return new NoopRateLimiter();
    if (config.rateLimitMode === 'edge' && binding) return new CloudflareRateLimiter(binding as CloudflareRateLimitBinding);
    return new MemoryRateLimiter(perMinute, 60_000);
  };
  const searchLimiter = limiter(env.SEARCH_LIMITER, 12);
  const clickLimiter = limiter(env.CLICK_LIMITER, 60);

  for (const w of config.warnings) logger.debug('config warning', { warning: w });

  instance = { config, logger, store, supabase, cache, provider, search, searchLimiter, clickLimiter, hostPolicy };
  instanceKey = key;
  return instance;
}

/** Test helper. */
export function resetServices() {
  instance = null;
  instanceKey = '';
}
