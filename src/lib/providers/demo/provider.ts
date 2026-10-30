import type { CatalogProduct } from '../../../types/product';
import { analyzeProduct } from '../../matching/analyze';
import { informativeTokens } from '../../matching/text';
import type { AffiliateProductProvider, ProviderHealth, ProviderSearchQuery } from '../types';
import { DEMO_ITEMS, type DemoItem } from './catalog';

/**
 * Local, deterministic provider backed by the fictional DEMO catalogue.
 * Search is language-independent: queries and items are compared through
 * the same concept analysis (category, material, shape, colour…), so a
 * Spanish query finds English listings like a real marketplace would.
 */

interface IndexedItem {
  item: DemoItem;
  concepts: Set<string>;
  tokens: Set<string>;
}

function concepts(a: ReturnType<typeof analyzeProduct>): string[] {
  return [
    ...(a.categoryId ? [`c:${a.categoryId}`, `g:${a.groupId}`] : []),
    ...a.colors.map((x) => `col:${x}`),
    ...a.materials.map((x) => `mat:${x}`),
    ...a.shapes.map((x) => `sh:${x}`),
    ...a.styles.map((x) => `st:${x}`),
    ...a.features.map((x) => `f:${x}`),
  ];
}

let index: IndexedItem[] | null = null;

function getIndex(): IndexedItem[] {
  if (!index) {
    index = DEMO_ITEMS.map((item) => {
      const a = analyzeProduct({ title: item.title, categoryPath: item.categoryPath, attributes: item.attributes });
      return {
        item,
        concepts: new Set(concepts(a)),
        tokens: new Set(informativeTokens(`${item.title} ${Object.values(item.attributes).join(' ')}`)),
      };
    });
  }
  return index;
}

export function demoItemToProduct(item: DemoItem, now: string): CatalogProduct {
  return {
    provider: 'demo',
    providerProductId: `demo-${item.id}`,
    title: item.title,
    description: null,
    image: `/demo-img/${item.id}.svg`,
    images: [`/demo-img/${item.id}.svg`],
    price: { amount: item.price, currency: 'EUR' },
    priceHigh: item.priceHigh ? { amount: item.priceHigh, currency: 'EUR' } : null,
    listPrice: null,
    shippingCost: item.shipping === null ? null : { amount: item.shipping, currency: 'EUR' },
    deliveryDays: item.delivery ? { min: item.delivery[0], max: item.delivery[1] } : null,
    shipsToSpain: item.shipsToSpain ?? true,
    availability: item.availability ?? 'in_stock',
    rating: item.rating ? { value: item.rating[0], count: item.rating[1] } : null,
    orders: item.orders,
    categoryPath: item.categoryPath,
    attributes: item.attributes,
    variants: [],
    productUrl: null,
    affiliateUrl: null,
    affiliateSource: null,
    gtin: null,
    mpn: null,
    sellerName: 'Tienda DEMO',
    priceCheckedAt: now,
    availabilityCheckedAt: now,
    isDemo: true,
  };
}

export class DemoCatalogProvider implements AffiliateProductProvider {
  readonly id = 'demo' as const;
  readonly label = 'Catálogo de demostración';
  readonly capabilities = {
    textSearch: true,
    imageSearch: false,
    productDetails: true,
    affiliateLinks: false,
    isDemo: true,
  };

  constructor(private readonly now: () => Date = () => new Date()) {}

  async searchByText(query: ProviderSearchQuery): Promise<CatalogProduct[]> {
    const q = analyzeProduct({ title: query.text });
    const qConcepts = concepts(q);
    const qTokens = informativeTokens(query.text);
    const scored = getIndex()
      .map((entry) => {
        let score = 0;
        for (const c of qConcepts) if (entry.concepts.has(c)) score += c.startsWith('c:') ? 3 : c.startsWith('g:') ? 1 : 1.5;
        for (const t of qTokens) if (entry.tokens.has(t)) score += 0.5;
        return { entry, score };
      })
      // A result must at least share the product family (or several attributes).
      .filter((s) => s.score >= 2.5 && (q.groupId === null || s.entry.concepts.has(`g:${q.groupId}`)))
      .sort((a, b) => b.score - a.score)
      .slice(0, query.limit);
    const now = this.now().toISOString();
    return scored.map((s) => demoItemToProduct(s.entry.item, now));
  }

  async getProductDetails(ids: string[]): Promise<CatalogProduct[]> {
    const now = this.now().toISOString();
    return DEMO_ITEMS.filter((i) => ids.includes(`demo-${i.id}`)).map((i) => demoItemToProduct(i, now));
  }

  async healthCheck(): Promise<ProviderHealth> {
    return { ok: true, configured: true, message: `Demo catalogue with ${DEMO_ITEMS.length} fictional items` };
  }
}
