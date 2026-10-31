import { ALGORITHM_VERSION, type MatchingConfig } from '../../config/matching';
import type { ReadIssue, SourceProduct } from '../../types/product';
import type { ProductAnalysis } from '../../types/matching';
import type {
  EntryMode,
  Notice,
  SearchErrorCode,
  SearchEvent,
  SearchResultPayload,
} from '../../types/search';
import { createGoToken } from '../affiliate/go-token';
import type { AffiliateLinkService } from '../affiliate/links';
import type { ResultCache } from '../data/cache';
import { LruMemory } from '../data/cache';
import type { DataStore, SearchJobRecord } from '../data/types';
import type { ExtractionResult, ProductExtractionService } from '../extraction/service';
import { analyzeSource, runMatching, type VisualSimilarity } from '../matching/pipeline';
import { assignLabels } from '../matching/rank';
import type { AffiliateProductProvider } from '../providers/types';
import { randomId } from '../security/crypto';
import type { HostPolicyConfig } from '../security/host-policy';
import { normalizeProductUrl, type NormalizedProductUrl } from '../url/normalize';
import { toPublicSource, toResultItem } from './present';
import { readIssueText } from './read-issue';
import type { Logger } from '../server/logger';

export interface VisionAnalyzer {
  /** Fills gaps in a deterministic analysis from the product image + title. */
  enrich(source: SourceProduct, analysis: ProductAnalysis): Promise<ProductAnalysis | null>;
}

export interface SearchContext {
  entryMode: EntryMode;
  waitUntil?: (p: Promise<unknown>) => void;
  /** Coarse analytics (no personal data). */
  deviceClass?: 'mobile' | 'tablet' | 'desktop' | 'bot' | null;
  country?: string | null;
  referrerDomain?: string | null;
  utm?: { source?: string | null; medium?: string | null; campaign?: string | null };
}

export interface SearchServiceDeps {
  store: DataStore;
  cache: ResultCache;
  extraction: ProductExtractionService;
  provider: AffiliateProductProvider;
  demoProvider: AffiliateProductProvider;
  links: AffiliateLinkService;
  matching: MatchingConfig;
  hostPolicy: HostPolicyConfig;
  linkSecret: string;
  siteUrl: string;
  showSimilarityPercent: boolean;
  dailyBudget: number;
  logger: Logger;
  vision?: VisionAnalyzer | null;
  visual?: VisualSimilarity | null;
  kvSource?: { get(k: string): Promise<SourceProduct | null>; put(k: string, v: SourceProduct): Promise<void> } | null;
}

export class SearchError extends Error {
  constructor(public readonly code: SearchErrorCode, message: string, public readonly source?: SourceProduct) {
    super(message);
    this.name = 'SearchError';
  }
}

const ERROR_MESSAGES: Record<SearchErrorCode, string> = {
  invalid_url: 'Ese enlace no parece la dirección de un producto. Copia el enlace completo desde la tienda.',
  invalid_query: 'Describe el producto con algunas palabras más (por ejemplo, «lámpara de mesa seta de cristal»).',
  blocked_host: 'No podemos analizar enlaces de ese dominio.',
  own_domain: 'Ese enlace ya es de Gemelu. Pega el enlace del producto de la tienda.',
  not_a_product: 'La página no parece la ficha de un producto. Abre el producto concreto y copia su enlace.',
  store_blocked: 'La tienda no deja que programas automáticos lean esta página. No intentamos saltarnos ese bloqueo.',
  robots_disallowed: 'La tienda pide en su robots.txt que los programas automáticos no lean esta página, y lo respetamos.',
  fetch_failed: 'No hemos podido abrir la página de la tienda.',
  timeout: 'La tienda ha tardado demasiado en responder.',
  too_large: 'La página de la tienda es demasiado grande para analizarla.',
  unsupported_content: 'El enlace no lleva a una página web de producto.',
  provider_unavailable: 'El buscador de alternativas no responde ahora mismo. Prueba de nuevo en unos minutos.',
  rate_limited: 'Has hecho muchas búsquedas seguidas. Espera un minuto y vuelve a probar.',
  budget_exceeded: 'Hoy hemos alcanzado el límite de búsquedas nuevas. Las búsquedas ya hechas siguen disponibles.',
  internal: 'Algo ha fallado por nuestra parte. Vuelve a intentarlo.',
};

export function errorMessage(code: SearchErrorCode): string {
  return ERROR_MESSAGES[code];
}

const today = () => new Date().toISOString().slice(0, 10);

export class SearchService {
  private readonly sourceCache = new LruMemory<{ source: SourceProduct; expires: number }>(300);

  constructor(private readonly d: SearchServiceDeps) {}

  resultKey(cacheKey: string, providerId: string): string {
    return `${ALGORITHM_VERSION}:${providerId}:${cacheKey}`;
  }

  /** Validates input without I/O. */
  normalize(rawUrl: string): NormalizedProductUrl {
    const r = normalizeProductUrl(rawUrl, this.d.hostPolicy);
    if (!r.ok) {
      const code: SearchErrorCode = r.error === 'own_domain' ? 'own_domain' : r.error === 'blocked_host' ? 'blocked_host' : 'invalid_url';
      throw new SearchError(code, errorMessage(code));
    }
    return r.value;
  }

  /** Fast path used by SSR: cached results only, never computes. */
  async cached(rawUrl: string): Promise<SearchResultPayload | null> {
    let n: NormalizedProductUrl;
    try {
      n = this.normalize(rawUrl);
    } catch {
      return null;
    }
    const hit = await this.d.cache.get(this.resultKey(n.cacheKey, this.d.provider.id));
    if (!hit) return null;
    return { ...hit.payload, cache: { hit: true, ageSeconds: Math.round((Date.now() - Date.parse(hit.storedAt)) / 1000) } };
  }

  async searchUrl(rawUrl: string, ctx: SearchContext, emit: (e: SearchEvent) => void): Promise<SearchResultPayload> {
    emit({ type: 'stage', stage: 'validating' });
    const n = this.normalize(rawUrl);
    const key = this.resultKey(n.cacheKey, this.d.provider.id);

    const hit = await this.d.cache.get(key);
    if (hit) {
      const payload: SearchResultPayload = {
        ...hit.payload,
        cache: { hit: true, ageSeconds: Math.round((Date.now() - Date.parse(hit.storedAt)) / 1000) },
      };
      emit({ type: 'source', source: payload.source });
      this.track(ctx, { type: 'search_completed', searchId: payload.id, domain: n.domain, value: payload.items.length });
      this.recordCacheHit(payload, n, ctx);
      return payload;
    }

    return this.d.cache.dedupe(key, () => this.compute(n, ctx, emit, key));
  }

  /** Free-text search ("lámpara seta cristal blanco") for stores that can't be read. */
  async searchText(query: string, ctx: SearchContext, emit: (e: SearchEvent) => void): Promise<SearchResultPayload> {
    const q = query.replace(/\s+/g, ' ').trim().slice(0, 140);
    if (q.length < 4 || !/[a-záéíóúñü]{3,}/i.test(q)) throw new SearchError('invalid_query', errorMessage('invalid_query'));
    emit({ type: 'stage', stage: 'validating' });
    const key = `${ALGORITHM_VERSION}:${this.d.provider.id}:text:${q.toLowerCase()}`;
    const hit = await this.d.cache.get(key);
    if (hit) return { ...hit.payload, cache: { hit: true, ageSeconds: Math.round((Date.now() - Date.parse(hit.storedAt)) / 1000) } };
    return this.d.cache.dedupe(key, async () => {
      const used = await this.d.store.incrementUsage(today(), 'uncached_search').catch(() => 0);
      if (used > this.d.dailyBudget) throw new SearchError('budget_exceeded', errorMessage('budget_exceeded'));
      const source = textSource(q);
      emit({ type: 'source', source: toPublicSource(source) });
      const result = await this.match(source, null, this.d.provider, ctx, emit, randomId(9), Date.now(), {}, { categoryId: null, providerCalls: 0 });
      await this.d.cache.set(key, result).catch(() => undefined);
      return result;
    });
  }

  /** Example pages: fictional source product, always the DEMO catalogue. */
  async searchExample(source: SourceProduct, ctx: SearchContext, emit: (e: SearchEvent) => void): Promise<SearchResultPayload> {
    const key = `${ALGORITHM_VERSION}:demo:example:${source.canonicalUrl}`;
    const hit = await this.d.cache.get(key);
    if (hit) return { ...hit.payload, cache: { hit: true, ageSeconds: Math.round((Date.now() - Date.parse(hit.storedAt)) / 1000) } };
    return this.d.cache.dedupe(key, async () => {
      const result = await this.match(source, null, this.d.demoProvider, ctx, emit, randomId(9), Date.now(), {}, { categoryId: null, providerCalls: 0 });
      await this.d.cache.set(key, result).catch(() => undefined);
      return result;
    });
  }

  private async compute(n: NormalizedProductUrl, ctx: SearchContext, emit: (e: SearchEvent) => void, key: string) {
    const started = Date.now();
    const searchId = randomId(9);
    const timings: Record<string, number> = {};

    // Cost control: cap uncached searches per day.
    const used = await this.d.store.incrementUsage(today(), 'uncached_search').catch(() => 0);
    if (used > this.d.dailyBudget) throw new SearchError('budget_exceeded', errorMessage('budget_exceeded'));

    const job: SearchJobRecord = {
      id: searchId,
      createdAt: new Date(started).toISOString(),
      finishedAt: null,
      status: 'running',
      entryMode: ctx.entryMode,
      sourceUrl: n.original,
      canonicalUrl: n.canonical,
      domain: n.domain,
      storeId: n.store.id,
      provider: this.d.provider.id,
      readMode: null,
      sourceTitle: null,
      categoryId: null,
      resultCount: 0,
      lowConfidenceCount: 0,
      bestSavingsEur: null,
      errorCode: null,
      cacheHit: false,
      durationMs: null,
      timings,
      providerCalls: 0,
    };
    this.background(ctx, this.d.store.createSearchJob(job));
    this.track(ctx, { type: 'search_submitted', searchId, domain: n.domain });

    try {
      emit({ type: 'stage', stage: 'reading', detail: n.store.name });
      const t0 = Date.now();
      const source = await this.readSource(n);
      timings.read = Date.now() - t0;
      emit({ type: 'source', source: toPublicSource(source) });

      const meta = { categoryId: null as string | null, providerCalls: 0 };
      const result = await this.match(source, n, this.d.provider, ctx, emit, searchId, started, timings, meta);
      await this.d.cache.set(key, result).catch(() => undefined);
      this.background(
        ctx,
        this.d.store.finishSearchJob(searchId, {
          status: 'done',
          finishedAt: new Date().toISOString(),
          readMode: source.readMode,
          sourceTitle: source.title,
          categoryId: meta.categoryId,
          resultCount: result.items.length,
          lowConfidenceCount: result.lowConfidenceItems.length,
          bestSavingsEur: result.summary.maxSavings?.amount.amount ?? null,
          durationMs: Date.now() - started,
          timings,
          providerCalls: meta.providerCalls,
        }),
      );
      this.track(ctx, { type: 'search_completed', searchId, domain: n.domain, value: result.items.length });
      return result;
    } catch (err) {
      const code: SearchErrorCode = err instanceof SearchError ? err.code : 'internal';
      if (!(err instanceof SearchError)) this.d.logger.error('search failed', { error: (err as Error).message, domain: n.domain });
      this.background(
        ctx,
        this.d.store.finishSearchJob(searchId, { status: 'failed', finishedAt: new Date().toISOString(), errorCode: code, durationMs: Date.now() - started }),
      );
      this.track(ctx, { type: 'search_failed', searchId, domain: n.domain });
      throw err instanceof SearchError ? err : new SearchError('internal', errorMessage('internal'));
    }
  }

  private async readSource(n: NormalizedProductUrl): Promise<SourceProduct> {
    const cached = this.sourceCache.get(n.cacheKey);
    if (cached && cached.expires > Date.now()) return cached.source;
    const fromKv = await this.d.kvSource?.get(n.cacheKey).catch(() => null);
    if (fromKv) return fromKv;

    const result: ExtractionResult = await this.d.extraction.extract(n);
    if (result.ok) {
      this.sourceCache.set(n.cacheKey, { source: result.product, expires: Date.now() + 6 * 3600_000 });
      await this.d.kvSource?.put(n.cacheKey, result.product).catch(() => undefined);
      return result.product;
    }
    if (result.fallback) {
      // Readable name in the URL: continue honestly in "url-only" mode.
      return result.fallback;
    }
    const map: Record<string, SearchErrorCode> = {
      blocked: 'store_blocked',
      robots_disallowed: 'robots_disallowed',
      robots_unreachable: 'fetch_failed',
      not_product: 'not_a_product',
      http_error: 'fetch_failed',
      timeout: 'timeout',
      too_large: 'too_large',
      unsupported_content: 'unsupported_content',
      fetch_failed: 'fetch_failed',
      blocked_host: 'blocked_host',
    };
    const code = map[result.reason] ?? 'fetch_failed';
    if (code === 'not_a_product' || code === 'blocked_host' || code === 'unsupported_content') throw new SearchError(code, errorMessage(code));
    const issue: ReadIssue = { reason: result.reason, ...(result.detail ? { detail: result.detail } : {}), ...(result.blockKind ? { block: result.blockKind } : {}) };
    throw new SearchError(code, `${readIssueText(n.store.name, issue)} El enlace no incluye el nombre del producto, así que no podemos buscar solo con él.`);
  }

  private async match(
    source: SourceProduct,
    n: NormalizedProductUrl | null,
    provider: AffiliateProductProvider,
    ctx: SearchContext,
    emit: (e: SearchEvent) => void,
    searchId: string,
    started: number,
    timings: Record<string, number>,
    meta: { categoryId: string | null; providerCalls: number },
  ): Promise<SearchResultPayload> {
    emit({ type: 'stage', stage: 'analyzing' });
    const tA = Date.now();
    let analysis = analyzeSource(source);
    if (this.d.vision && (!analysis.categoryId || analysis.categoryConfidence < 0.6) && source.image) {
      analysis = (await this.d.vision.enrich(source, analysis).catch(() => null)) ?? analysis;
    }
    timings.analyze = Date.now() - tA;
    meta.categoryId = analysis.categoryId;

    emit({ type: 'stage', stage: 'searching' });
    const tS = Date.now();
    let providerCalls = 0;
    let output;
    try {
      output = await runMatching({
        source,
        analysis,
        provider,
        config: this.d.matching,
        visual: this.d.visual ?? null,
        callContext: { onCall: () => providerCalls++ },
        onProgress: (stage, done, total) => {
          if (stage === 'comparing' && done === 0) emit({ type: 'stage', stage: 'comparing' });
          emit({ type: 'progress', stage, done, total });
        },
      });
    } catch (err) {
      this.d.logger.warn('provider failure', { provider: provider.id, error: (err as Error).message });
      throw new SearchError('provider_unavailable', errorMessage('provider_unavailable'), source);
    }
    timings.search = Date.now() - tS;

    // Real shipping cost/delivery for the shortlisted items when the provider supports it.
    const enrich = (provider as { enrichShipping?: (p: unknown[], c: unknown) => Promise<void> }).enrichShipping;
    if (enrich && output.results.length) {
      await enrich.call(provider, output.results.map((r) => r.product), { onCall: () => providerCalls++ }).catch(() => undefined);
    }

    const shown = [...output.results, ...output.lowConfidence];
    const links = await this.d.links.resolve(
      shown.map((c) => c.product),
      provider,
      { onCall: () => providerCalls++ },
    );
    const labels = assignLabels(output.results, this.d.matching.mostSimilarMargin);
    // Never compute savings between a real store price and fictional demo prices.
    const hideSavings = provider.capabilities.isDemo && source.readMode !== 'example';

    const tierCode = { verified: 'v', very_similar: 'vs', similar: 's', low_confidence: 'l' } as const;
    const toItem = async (c: (typeof shown)[number], index: number) => {
      const link = links.get(c.product.providerProductId);
      const token = await createGoToken(
        {
          p: c.product.provider,
          i: c.product.providerProductId,
          u: link?.destination ?? null,
          a: link?.isAffiliate ? 1 : 0,
          s: searchId,
          r: index + 1,
          t: tierCode[c.tier],
        },
        this.d.linkSecret,
      );
      return toResultItem(c, {
        goUrl: `/go/${token}`,
        isAffiliate: !!link?.isAffiliate,
        labels: labels.get(`${c.product.provider}:${c.product.providerProductId}`) ?? [],
        showSimilarityPercent: this.d.showSimilarityPercent,
        hideSavings,
      });
    };
    const items = await Promise.all(output.results.map(toItem));
    const lowItems = await Promise.all(output.lowConfidence.map((c, i) => toItem(c, output.results.length + i)));

    const savings = items.map((i) => i.savings).filter((s): s is NonNullable<typeof s> => !!s);
    const maxSavings = savings.length ? savings.reduce((a, b) => (b.amount.amount > a.amount.amount ? b : a)) : null;
    const totals = items.map((i) => i.totalPrice ?? (i.priceIsFrom ? null : i.price)).filter((m): m is NonNullable<typeof m> => !!m);
    const cheapestTotal = totals.length ? totals.reduce((a, b) => (b.amount < a.amount ? b : a)) : null;

    const notices: Notice[] = [];
    if (provider.capabilities.isDemo) {
      notices.push({
        kind: 'demo',
        message: hideSavings
          ? 'Modo demostración: las alternativas y sus precios son ficticios, por eso no calculamos ahorro frente a este producto real.'
          : 'Ejemplo de demostración: el producto, la tienda, las alternativas y los precios son ficticios.',
      });
    }
    if (source.readMode === 'text') {
      notices.push({ kind: 'text_query', message: 'Buscamos a partir de tu descripción: sin foto ni precio del original no podemos calcular el ahorro.' });
    } else if (source.readMode === 'url-only') {
      notices.push({
        kind: 'url_only',
        message: `${readIssueText(source.store.name, source.readIssue)} Hemos buscado por el nombre que aparece en el enlace («${source.title}»), sin foto ni precio del original.`,
      });
    } else if (!source.price && source.readMode === 'page') {
      notices.push({ kind: 'no_source_price', message: 'No hemos podido leer el precio original, así que no calculamos el ahorro.' });
    }
    if (source.confidence === 'low' && source.readMode === 'page') {
      notices.push({ kind: 'partial_source', message: 'La página de la tienda tiene pocos datos estructurados; los resultados pueden ser menos precisos.' });
    }
    if (items.some((i) => i.caveats.includes('shipping_unknown'))) {
      notices.push({ kind: 'shipping_unknown', message: 'Algunos precios no incluyen el envío porque el proveedor no lo indica; lo marcamos en cada alternativa.' });
    }
    if (items.length > 0 && items.length < 3) notices.push({ kind: 'few_results', message: 'Solo hemos encontrado pocas alternativas fiables.' });
    if (items.length === 0 && lowItems.length > 0) {
      notices.push({ kind: 'low_confidence_only', message: 'No encontramos alternativas fiables; te mostramos coincidencias de baja confianza.' });
    }

    const status: SearchResultPayload['status'] = items.length >= 3 ? 'results' : items.length > 0 ? 'few_results' : 'no_reliable_results';
    emit({ type: 'stage', stage: 'done' });
    timings.total = Date.now() - started;
    meta.providerCalls = providerCalls;

    if (n) {
      this.background(ctx, this.d.store.upsertCatalogProducts(shown.map((c) => c.product).filter((p) => !p.isDemo)));
    }

    return {
      id: searchId,
      algorithmVersion: ALGORITHM_VERSION,
      status,
      source: toPublicSource(source),
      provider: { id: provider.id, label: provider.label, isDemo: provider.capabilities.isDemo },
      items,
      lowConfidenceItems: lowItems,
      summary: { count: items.length, maxSavings, cheapestTotal },
      notices,
      stats: output.stats,
      createdAt: new Date().toISOString(),
      cache: { hit: false, ageSeconds: 0 },
      timingsMs: { ...timings, providerCalls },
    };
  }

  private recordCacheHit(payload: SearchResultPayload, n: NormalizedProductUrl, ctx: SearchContext) {
    const now = new Date().toISOString();
    this.background(
      ctx,
      this.d.store.createSearchJob({
        id: randomId(9),
        createdAt: now,
        finishedAt: now,
        status: 'done',
        entryMode: ctx.entryMode,
        sourceUrl: n.original,
        canonicalUrl: n.canonical,
        domain: n.domain,
        storeId: n.store.id,
        provider: payload.provider.id,
        readMode: payload.source.readMode,
        sourceTitle: payload.source.title,
        categoryId: null,
        resultCount: payload.items.length,
        lowConfidenceCount: payload.lowConfidenceItems.length,
        bestSavingsEur: payload.summary.maxSavings?.amount.amount ?? null,
        errorCode: null,
        cacheHit: true,
        durationMs: 0,
        timings: {},
        providerCalls: 0,
      }),
    );
  }

  private track(ctx: SearchContext, e: { type: 'search_submitted' | 'search_completed' | 'search_failed'; searchId: string; domain: string; value?: number }) {
    this.background(
      ctx,
      this.d.store.logEvent({
        type: e.type,
        at: new Date().toISOString(),
        searchId: e.searchId,
        domain: e.domain,
        entryMode: ctx.entryMode,
        deviceClass: ctx.deviceClass ?? null,
        country: ctx.country ?? null,
        referrerDomain: ctx.referrerDomain ?? null,
        utmSource: ctx.utm?.source ?? null,
        utmMedium: ctx.utm?.medium ?? null,
        utmCampaign: ctx.utm?.campaign ?? null,
        value: e.value ?? null,
      }),
    );
  }

  private background(ctx: SearchContext, p: Promise<unknown>) {
    const safe = p.catch((err) => this.d.logger.warn('background task failed', { error: (err as Error).message }));
    if (ctx.waitUntil) ctx.waitUntil(safe);
  }
}


/** Source record for a typed description (no page was read; nothing invented). */
export function textSource(q: string): SourceProduct {
  return {
    originalUrl: '',
    canonicalUrl: `text:${q.toLowerCase()}`,
    finalUrl: null,
    host: 'texto',
    domain: 'texto',
    store: { id: 'texto', name: 'Tu descripción', known: false },
    title: q.charAt(0).toUpperCase() + q.slice(1),
    description: null,
    image: null,
    images: [],
    price: null,
    priceHigh: null,
    availability: 'unknown',
    brand: null,
    category: null,
    breadcrumbs: [],
    color: null,
    material: null,
    shape: null,
    dimensions: null,
    variant: null,
    gtin: null,
    mpn: null,
    sku: null,
    rating: null,
    checkedAt: new Date().toISOString(),
    confidence: 'low',
    fieldSources: { title: 'user-input' },
    methods: ['user-input'],
    readMode: 'text',
  };
}
