import type { CatalogProduct, SourceProduct } from '../../types/product';
import type {
  FilterReason,
  MatchingStats,
  ProductAnalysis,
  RejectedCandidate,
  ScoredCandidate,
  SearchQuery,
} from '../../types/matching';
import type { MatchingConfig } from '../../config/matching';
import type { AffiliateProductProvider, ProviderCallContext } from '../providers/types';
import { analyzeProduct } from './analyze';
import { dedupeCandidates } from './dedupe';
import { verifyCandidate } from './filters';
import { buildQueries } from './queries';
import { assignTier, sortCandidates } from './rank';
import { comparablePrice, computeSavings } from './savings';
import { categorySimilarity, computeShopping, computeSimilarity, sizeRatio } from './score';

/** Optional visual similarity (image embeddings). Returns cosine-like 0–1 or null. */
export interface VisualSimilarity {
  score(sourceImage: string, candidateImage: string): Promise<number | null>;
}

export interface MatchingInput {
  source: SourceProduct;
  analysis: ProductAnalysis;
  provider: AffiliateProductProvider;
  config: MatchingConfig;
  visual?: VisualSimilarity | null;
  callContext?: ProviderCallContext;
  onProgress?: (stage: 'searching' | 'comparing', done: number, total: number) => void;
}

export interface MatchingOutput {
  results: ScoredCandidate[];
  lowConfidence: ScoredCandidate[];
  rejected: RejectedCandidate[];
  queries: SearchQuery[];
  stats: MatchingStats;
  providerErrors: string[];
}

export function analyzeSource(source: SourceProduct): ProductAnalysis {
  return analyzeProduct({
    title: source.title,
    description: source.description,
    breadcrumbs: source.breadcrumbs,
    category: source.category,
    color: source.color,
    material: source.material,
    url: source.readMode === 'url-only' ? null : source.canonicalUrl,
    brand: source.brand,
    dimensions: source.dimensions,
    extraBrandTokens: source.store.known ? [source.store.name] : [],
  });
}

export function analyzeCandidate(c: CatalogProduct): ProductAnalysis {
  return analyzeProduct({
    title: c.title,
    description: c.description,
    categoryPath: c.categoryPath,
    attributes: c.attributes,
    color: c.attributes.color ?? c.attributes.Color ?? null,
    material: c.attributes.material ?? c.attributes.Material ?? null,
  });
}

/** Pack-size ratio for unit price comparison (source units / candidate units). */
function unitRatio(src: ProductAnalysis, cand: ProductAnalysis): { ratio: number; differs: boolean } {
  const s = src.packSize ?? 1;
  const c = cand.packSize ?? 1;
  return { ratio: s / c, differs: s !== c };
}

export async function runMatching(input: MatchingInput): Promise<MatchingOutput> {
  const { source, analysis, provider, config } = input;
  const queries = buildQueries(analysis, { maxQueries: config.maxQueries, sourcePrice: source.price?.amount ?? null });
  const providerErrors: string[] = [];

  // 1) Retrieve candidates (queries in parallel; a failing query doesn't sink the search).
  let done = 0;
  input.onProgress?.('searching', 0, queries.length);
  const byId = new Map<string, { product: CatalogProduct; queries: string[] }>();
  const settled = await Promise.allSettled(
    queries.map(async (q) => {
      const found = await provider.searchByText(
        { text: q.text, lang: q.lang, limit: config.candidatesPerQuery, shipTo: 'ES', currency: 'EUR', ...(q.maxPrice ? { maxPrice: q.maxPrice } : {}) },
        input.callContext,
      );
      done++;
      input.onProgress?.('searching', done, queries.length);
      return { q, found };
    }),
  );
  let retrieved = 0;
  for (const s of settled) {
    if (s.status === 'rejected') {
      providerErrors.push((s.reason as Error)?.message ?? 'provider error');
      continue;
    }
    retrieved += s.value.found.length;
    for (const p of s.value.found) {
      const id = `${p.provider}:${p.providerProductId}`;
      const existing = byId.get(id);
      if (existing) existing.queries.push(s.value.q.text);
      else byId.set(id, { product: p, queries: [s.value.q.text] });
    }
  }
  if (settled.length > 0 && settled.every((s) => s.status === 'rejected')) {
    throw new Error(`All provider queries failed: ${providerErrors[0] ?? 'unknown'}`);
  }

  // 2) Verify, score.
  const rejected: RejectedCandidate[] = [];
  const rejectedByReason: Partial<Record<FilterReason, number>> = {};
  const reject = (p: CatalogProduct, reasons: FilterReason[]) => {
    rejected.push({ providerProductId: p.providerProductId, title: p.title, reasons });
    for (const r of reasons) rejectedByReason[r] = (rejectedByReason[r] ?? 0) + 1;
  };

  const entries = [...byId.values()];
  input.onProgress?.('comparing', 0, entries.length);
  const prepared = entries.map(({ product, queries: matched }) => {
    const candAnalysis = analyzeCandidate(product);
    const comp = comparablePrice(product);
    return { product, matched, candAnalysis, comp };
  });
  const peerPrices = prepared.map((p) => p.comp.price?.amount).filter((x): x is number => typeof x === 'number');

  const scored: ScoredCandidate[] = [];
  let compared = 0;
  for (const { product, matched, candAnalysis, comp } of prepared) {
    compared++;
    const reasons = verifyCandidate(product, candAnalysis, {
      sourceAnalysis: analysis,
      sourcePrice: source.price,
      comparable: comp.price,
      config,
    });
    if (reasons.length) {
      reject(product, reasons);
      continue;
    }

    let visualScore: number | null = null;
    if (input.visual && source.image && product.image) {
      visualScore = await input.visual.score(source.image, product.image).catch(() => null);
    }
    const sim = computeSimilarity(analysis, source, candAnalysis, product, config.similarityWeights, visualScore);
    const shapeAgrees =
      analysis.shapes.length && candAnalysis.shapes.length
        ? candAnalysis.shapes.some((s) => analysis.shapes.includes(s))
        : null;
    const catSim = categorySimilarity(analysis.categoryId, candAnalysis.categoryId);
    const tier = assignTier(sim.similarity, sim.evidence, sim.identity, shapeAgrees, config.tiers, catSim === null ? null : catSim >= 0.75);
    if (!tier) {
      reject(product, ['below_threshold']);
      continue;
    }

    const caveats = [...comp.caveats];
    const pack = unitRatio(analysis, candAnalysis);
    if (pack.differs) caveats.push('pack_differs');
    const ratio = sizeRatio(analysis, candAnalysis);
    if (ratio !== null && ratio < 0.75) caveats.push('size_differs');
    const priceFrom =
      !!product.price && !!product.priceHigh && product.priceHigh.amount / product.price.amount > config.priceFromSpread;
    if (priceFrom) caveats.push('price_from');
    if (!product.deliveryDays) caveats.push('delivery_unknown');
    if (product.rating?.count !== null && product.rating?.count !== undefined && product.rating.count < 10) caveats.push('few_reviews');

    // Savings only for comparable prices: no "desde" prices, no wildly different sizes.
    const savings =
      priceFrom || (ratio !== null && ratio < 0.6)
        ? null
        : computeSavings(source.price, comp.price, comp.basis, pack.ratio);
    const shopping = computeShopping(product, comp.price, source.price, peerPrices, config.shoppingWeights);
    const final = Math.round((config.alpha * sim.similarity + (1 - config.alpha) * shopping.shopping) * 1000) / 1000;

    scored.push({
      product,
      analysis: candAnalysis,
      similarity: sim.similarity,
      evidence: sim.evidence,
      shopping: shopping.shopping,
      final,
      tier,
      signals: sim.signals,
      shoppingSignals: shopping.signals,
      comparablePrice: comp.price,
      savings,
      caveats: [...new Set(caveats)],
      matchedQueries: matched,
      duplicates: 0,
    });
    if (compared % 10 === 0) input.onProgress?.('comparing', compared, entries.length);
  }
  input.onProgress?.('comparing', entries.length, entries.length);

  // 3) Rank, dedupe, cap.
  const sorted = sortCandidates(scored);
  const { kept, removed } = dedupeCandidates(sorted);
  if (removed) rejectedByReason.duplicate = (rejectedByReason.duplicate ?? 0) + removed;
  const results = kept.filter((c) => c.tier !== 'low_confidence').slice(0, config.maxResults);
  const lowConfidence = kept.filter((c) => c.tier === 'low_confidence').slice(0, config.maxLowConfidence);

  return {
    results,
    lowConfidence,
    rejected,
    queries,
    providerErrors,
    stats: {
      queries: queries.length,
      retrieved,
      uniqueAfterDedupe: kept.length,
      rejected: rejected.length + removed,
      rejectedByReason,
      shown: results.length,
    },
  };
}
