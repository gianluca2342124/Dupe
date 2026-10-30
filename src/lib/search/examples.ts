import type { SourceProduct } from '../../types/product';
import { DEMO_EXAMPLES, type DemoExample } from '../providers/demo/catalog';
import { parseDimensionsFromText } from '../extraction/dimensions';

/** Fictional "original" products used by /ejemplo/* and the home preview. */
export function exampleSource(slug: string): SourceProduct | null {
  const ex: DemoExample | undefined = DEMO_EXAMPLES.find((e) => e.slug === slug);
  if (!ex) return null;
  const image = `/demo-img/example-${ex.slug}.svg`;
  return {
    originalUrl: `/ejemplo/${ex.slug}`,
    canonicalUrl: `example:${ex.slug}`,
    finalUrl: null,
    host: 'ejemplo',
    domain: 'ejemplo',
    store: { id: 'ejemplo', name: 'Tienda de ejemplo', known: false },
    title: ex.title,
    description: ex.description,
    image,
    images: [image],
    price: { amount: ex.price, currency: 'EUR' },
    priceHigh: null,
    availability: 'in_stock',
    brand: null,
    category: ex.category,
    breadcrumbs: [ex.category],
    color: ex.color,
    material: ex.material,
    shape: null,
    dimensions: parseDimensionsFromText(`${ex.title} ${ex.description}`),
    variant: null,
    gtin: null,
    mpn: null,
    sku: null,
    rating: null,
    checkedAt: new Date('2026-10-01T09:00:00Z').toISOString(),
    confidence: 'high',
    fieldSources: { title: 'example', price: 'example', image: 'example' },
    methods: ['example'],
    readMode: 'example',
  };
}

export { DEMO_EXAMPLES };
