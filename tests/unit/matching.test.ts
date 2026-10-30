import { describe, expect, it } from 'vitest';
import { DEFAULT_MATCHING_CONFIG } from '../../src/config/matching';
import { analyzeProduct, detectPackSize } from '../../src/lib/matching/analyze';
import { buildQueries } from '../../src/lib/matching/queries';
import { brandMisuse, counterfeitSignal, isAccessoryListing, verifyCandidate } from '../../src/lib/matching/filters';
import { computeShopping, computeSimilarity } from '../../src/lib/matching/score';
import { comparablePrice, computeSavings } from '../../src/lib/matching/savings';
import { dedupeCandidates, imageKey } from '../../src/lib/matching/dedupe';
import { assignLabels, assignTier, sortCandidates } from '../../src/lib/matching/rank';
import { analyzeSource, runMatching } from '../../src/lib/matching/pipeline';
import { DemoCatalogProvider, demoItemToProduct } from '../../src/lib/providers/demo/provider';
import { DEMO_ITEMS } from '../../src/lib/providers/demo/catalog';
import { exampleSource } from '../../src/lib/search/examples';
import type { CatalogProduct } from '../../src/types/product';
import type { ScoredCandidate } from '../../src/types/matching';

const NOW = '2026-10-30T00:00:00.000Z';
const item = (id: string) => demoItemToProduct(DEMO_ITEMS.find((i) => i.id === id)!, NOW);
const product = (over: Partial<CatalogProduct>): CatalogProduct => ({ ...item('lamp-01'), ...over });

describe('analysis (deterministic, ES/EN)', () => {
  it('understands a Spanish product title', () => {
    const a = analyzeProduct({ title: 'Lámpara de mesa seta de vidrio ópalo y latón, 38 cm' });
    expect(a.categoryId).toBe('table-lamp');
    expect(a.groupId).toBe('lighting');
    expect(a.shapes).toContain('mushroom');
    expect(a.materials).toEqual(expect.arrayContaining(['opal-glass', 'brass']));
    expect(a.colors).toContain('white');
    expect(a.dimensions?.lengthCm).toBe(38);
    expect(a.keywordsEn).toEqual(expect.arrayContaining(['mushroom', 'table lamp']));
  });

  it('understands an English marketplace title and plurals', () => {
    const a = analyzeProduct({ title: 'Nordic Rattan Pendant Lights Woven Globe Lampshades 45cm' });
    expect(a.categoryId).toBe('pendant-lamp');
    expect(a.materials).toContain('rattan');
    expect(a.shapes).toContain('globe');
    expect(a.styles).toContain('scandinavian');
  });

  it('prefers the product noun before "for/para"', () => {
    expect(analyzeProduct({ title: 'Lampshade for table lamp, linen' }).categoryId).toBe('lamp-shade');
    expect(analyzeProduct({ title: 'Funda para cojín 45x45 lino' }).categoryId).toBe('cushion-cover');
  });

  it('ignores description sentences about bulbs and accessories', () => {
    const a = analyzeProduct({
      title: 'Lámpara de mesa - blanco ópalo vidrio/latón 39 cm',
      description: 'Crea una suave luz ambiental. Las bombillas se venden aparte. IKEA recomienda la bombilla LED E14 ópalo con forma de globo.',
    });
    expect(a.shapes).not.toContain('globe');
    expect(a.categoryId).toBe('table-lamp');
  });

  it('uses breadcrumbs when the title is generic', () => {
    expect(analyzeProduct({ title: 'AKTERSPRING', breadcrumbs: ['Iluminación', 'Lámparas de mesa'] }).categoryId).toBe('table-lamp');
  });

  it('detects pack sizes without confusing dimensions', () => {
    expect(detectPackSize('Set de 2 fundas de cojín')).toBe(2);
    expect(detectPackSize('Wicker Baskets Set of 3')).toBe(3);
    expect(detectPackSize('Cushion cover 4 pcs')).toBe(4);
    expect(detectPackSize('Funda de cojín 45 x 45 cm')).toBeNull();
  });

  it('flags model names and brands so they never reach queries', () => {
    const a = analyzeProduct({ title: 'AKTERSPRING Lámpara de mesa seta', brand: 'IKEA' });
    expect(a.brandTokens).toEqual(expect.arrayContaining(['akterspring', 'ikea']));
    const qs = buildQueries(a, { maxQueries: 4, sourcePrice: 39.99 });
    expect(qs.length).toBeGreaterThan(0);
    for (const q of qs) expect(q.text.toLowerCase()).not.toMatch(/ikea|akterspring/);
    expect(qs[0]!.maxPrice).toBeCloseTo(43.99, 2);
  });
});

describe('verification filters', () => {
  const src = analyzeProduct({ title: 'Lámpara de mesa seta de vidrio ópalo', breadcrumbs: ['Lámparas de mesa'] });
  const verify = (p: CatalogProduct, sourcePrice = 89) =>
    verifyCandidate(p, analyzeProduct({ title: p.title, categoryPath: p.categoryPath, attributes: p.attributes }), {
      sourceAnalysis: src,
      sourcePrice: { amount: sourcePrice, currency: 'EUR' },
      comparable: comparablePrice(p).price,
      config: DEFAULT_MATCHING_CONFIG,
    });

  it('rejects accessories presented as the main product', () => {
    expect(verify(item('lamp-09'))).toContain('accessory'); // replacement shade
    expect(verify(item('lamp-10'))).toEqual(expect.arrayContaining(['category_mismatch'])); // bulbs
    expect(isAccessoryListing('Cable textil para lámpara de mesa', analyzeProduct({ title: 'Cable textil para lámpara de mesa' }), src)).toBe(true);
    expect(isAccessoryListing('Lámpara de mesa seta con cable de tela', analyzeProduct({ title: 'Lámpara de mesa seta con cable de tela' }), src)).toBe(false);
  });

  it('rejects brand misuse and replicas', () => {
    expect(verify(item('lamp-11'))).toContain('brand_misuse');
    expect(brandMisuse('Panthella Replica Mushroom Lamp', src)).toBe(true);
    expect(counterfeitSignal('Panthella Replica Mushroom Lamp')).toBe(true);
    expect(counterfeitSignal('Mushroom lamp opal glass')).toBe(false);
  });

  it('rejects out-of-stock, not-cheaper, misleading prices and other categories', () => {
    expect(verify(item('lamp-13'))).toContain('out_of_stock');
    expect(verify(item('lamp-15'))).toContain('not_cheaper');
    expect(verify(item('lamp-08'))).toContain('price_not_representative');
    expect(verify(item('lamp-14'))).toContain('category_mismatch');
    expect(verify(product({ price: { amount: 20, currency: 'USD' } }))).toContain('currency_mismatch');
    expect(verify(product({ shipsToSpain: false }))).toContain('not_shipping_to_spain');
    expect(verify(item('lamp-01'))).toEqual([]);
  });
});

describe('scoring uses only existing data', () => {
  const src = analyzeProduct({ title: 'Lámpara de mesa seta de vidrio ópalo blanco 38 cm' });
  const ids = { gtin: null, mpn: null };

  it('missing signals reduce evidence instead of being invented', () => {
    const bare = analyzeProduct({ title: 'Table lamp' });
    const rich = analyzeProduct({ title: 'Mushroom table lamp opal glass white 36cm' });
    const simBare = computeSimilarity(src, ids, bare, ids, DEFAULT_MATCHING_CONFIG.similarityWeights);
    const simRich = computeSimilarity(src, ids, rich, ids, DEFAULT_MATCHING_CONFIG.similarityWeights);
    expect(simRich.similarity).toBeGreaterThan(simBare.similarity);
    expect(simBare.evidence).toBeLessThan(simRich.evidence);
    expect(simRich.signals.find((s) => s.name === 'visual')).toBeUndefined(); // no image model configured
  });

  it('identical GTIN means verified', () => {
    const sim = computeSimilarity(src, { gtin: '8412345678905', mpn: null }, src, { gtin: '8412345678905', mpn: null }, DEFAULT_MATCHING_CONFIG.similarityWeights);
    expect(sim.identity).toBe(true);
    expect(assignTier(sim.similarity, sim.evidence, sim.identity, null, DEFAULT_MATCHING_CONFIG.tiers)).toBe('verified');
  });

  it('shopping score ignores unknown rating, orders and delivery', () => {
    const unknown = product({ rating: null, orders: null, deliveryDays: null, shippingCost: null });
    const r = computeShopping(unknown, unknown.price, { amount: 89, currency: 'EUR' }, [], DEFAULT_MATCHING_CONFIG.shoppingWeights);
    expect(r.signals.map((s) => s.name).sort()).toEqual(['data_quality', 'price', 'shipping_known']);
  });
});

describe('savings', () => {
  it('uses total price when shipping is known, item price otherwise', () => {
    const withShip = comparablePrice(product({ price: { amount: 20, currency: 'EUR' }, shippingCost: { amount: 3, currency: 'EUR' } }));
    expect(withShip).toMatchObject({ price: { amount: 23 }, basis: 'total_with_shipping' });
    const noShip = comparablePrice(product({ price: { amount: 20, currency: 'EUR' }, shippingCost: null }));
    expect(noShip).toMatchObject({ basis: 'item_price_only', caveats: ['shipping_unknown'] });
  });

  it('only computes savings for comparable prices', () => {
    expect(computeSavings({ amount: 100, currency: 'EUR' }, { amount: 40, currency: 'EUR' }, 'total_with_shipping')).toEqual({
      amount: { amount: 60, currency: 'EUR' },
      percent: 60,
      basis: 'total_with_shipping',
    });
    expect(computeSavings({ amount: 100, currency: 'EUR' }, { amount: 40, currency: 'USD' }, 'item_price_only')).toBeNull();
    expect(computeSavings(null, { amount: 40, currency: 'EUR' }, 'item_price_only')).toBeNull();
    expect(computeSavings({ amount: 40, currency: 'EUR' }, { amount: 45, currency: 'EUR' }, 'item_price_only')).toBeNull();
    // A set of 3 for 30 € vs one unit at 20 €: 10 € per unit → 10 € saving per unit.
    expect(computeSavings({ amount: 20, currency: 'EUR' }, { amount: 30, currency: 'EUR' }, 'item_price_only', 1 / 3)?.amount.amount).toBe(10);
  });
});

describe('dedupe, ranking and labels', () => {
  const scored = (id: string, over: Partial<ScoredCandidate> = {}): ScoredCandidate => {
    const p = item(id);
    return {
      product: p,
      analysis: analyzeProduct({ title: p.title }),
      similarity: 0.8,
      evidence: 0.7,
      shopping: 0.5,
      final: 0.7,
      tier: 'very_similar',
      signals: [],
      shoppingSignals: [],
      comparablePrice: comparablePrice(p).price,
      savings: null,
      caveats: comparablePrice(p).caveats,
      matchedQueries: [],
      duplicates: 0,
      ...over,
    };
  };

  it('merges duplicate listings (same photo / near-identical title and price)', () => {
    const { kept, removed } = dedupeCandidates([scored('lamp-01', { final: 0.9 }), scored('lamp-07', { final: 0.8 }), scored('lamp-02')]);
    expect(kept.map((k) => k.product.providerProductId)).toEqual(['demo-lamp-01', 'demo-lamp-02']);
    expect(removed).toBe(1);
    expect(kept[0]!.duplicates).toBe(1);
    expect(imageKey('https://ae01.alicdn.com/kf/abc.jpg_220x220.jpg_.webp')).toBe(imageKey('https://ae04.alicdn.com/kf/abc.jpg'));
  });

  it('orders by tier first, then by final score', () => {
    const order = sortCandidates([scored('lamp-02', { tier: 'similar', final: 0.99 }), scored('lamp-01', { tier: 'very_similar', final: 0.6 }), scored('lamp-06', { tier: 'very_similar', final: 0.8 })]);
    expect(order.map((o) => o.product.providerProductId)).toEqual(['demo-lamp-06', 'demo-lamp-01', 'demo-lamp-02']);
  });

  it('labels "más parecido" / "más barato" only when justified', () => {
    const a = scored('lamp-01', { similarity: 0.9 });
    const b = scored('lamp-06', { similarity: 0.8 });
    const labels = assignLabels([a, b], 0.03);
    expect(labels.get('demo:demo-lamp-01')).toEqual(['most_similar', 'cheapest']);
    // Tie on similarity → no "más parecido" claim.
    expect(assignLabels([scored('lamp-01', { similarity: 0.8 }), scored('lamp-06', { similarity: 0.8 })], 0.03).get('demo:demo-lamp-01')).toEqual(['cheapest']);
    // Mixed price bases (with / without shipping) → no "más barato" claim.
    const mixed = assignLabels([scored('lamp-01', { similarity: 0.8 }), scored('lamp-04', { similarity: 0.8 })], 0.03);
    expect([...mixed.values()].flat()).not.toContain('cheapest');
  });
});

describe('full pipeline with the demo catalogue', () => {
  it('finds very similar, cheaper alternatives and rejects traps', async () => {
    const source = exampleSource('lampara-seta')!;
    const out = await runMatching({ source, analysis: analyzeSource(source), provider: new DemoCatalogProvider(() => new Date(NOW)), config: DEFAULT_MATCHING_CONFIG });
    const ids = out.results.map((r) => r.product.providerProductId);
    expect(ids[0]).toBe('demo-lamp-01');
    expect(out.results.every((r) => r.tier !== 'low_confidence')).toBe(true);
    expect(out.results.every((r) => r.product.price!.amount < 89)).toBe(true);
    for (const trap of ['lamp-07', 'lamp-08', 'lamp-09', 'lamp-10', 'lamp-11', 'lamp-12', 'lamp-13', 'lamp-14', 'lamp-15']) {
      expect(ids).not.toContain(`demo-${trap}`);
    }
    expect(out.results[0]!.savings?.basis).toBe('total_with_shipping');
    expect(out.stats.rejectedByReason.brand_misuse).toBeGreaterThanOrEqual(1);
  });

  it('works across categories (mirror, armchair, basket)', async () => {
    for (const [slug, top] of [
      ['espejo-ratan', 'demo-mir-01'],
      ['sillon-boucle', 'demo-arm-01'],
      ['cesta-mimbre', 'demo-bas-01'],
    ] as const) {
      const source = exampleSource(slug)!;
      const out = await runMatching({ source, analysis: analyzeSource(source), provider: new DemoCatalogProvider(() => new Date(NOW)), config: DEFAULT_MATCHING_CONFIG });
      expect(out.results.length, slug).toBeGreaterThanOrEqual(3);
      expect(out.results.map((r) => r.product.providerProductId), slug).toContain(top);
    }
  });
});
