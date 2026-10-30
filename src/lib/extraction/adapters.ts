import type { SourceProduct } from '../../types/product';

/**
 * Store-specific post-processing. Adapters only clean up data that was
 * actually read from the page (titles with store suffixes, model names…);
 * they never add information that the page did not contain.
 */
export interface StoreAdapter {
  id: string;
  postProcess(product: SourceProduct): SourceProduct;
}

const STORE_SUFFIX_RE =
  /\s*(?:[|\-–—:·]\s*)(?:comprar\s+)?(?:ikea(?: españa)?|zara home(?: españa)?|kave home|sklum|maisons du monde|westwing(?: collection)?|leroy merlin|el corte ingl[eé]s|amazon\.es[^|]*|amazon(?:\.\w+)?(?::[^|]*)?)\s*$/i;

export function cleanStoreTitle(title: string | null, storeName: string): string | null {
  if (!title) return null;
  let t = title.replace(STORE_SUFFIX_RE, '').trim();
  // Generic "Product | Store" pattern when the store name is known.
  const escaped = storeName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  t = t.replace(new RegExp(`\\s*[|\\-–—:·]\\s*${escaped}\\s*$`, 'i'), '').trim();
  // Amazon style: "Name : Amazon.es : Hogar y cocina".
  t = t.replace(/\s*:\s*Amazon\.[a-z.]+\s*:.*$/i, '').trim();
  return t || title;
}

const adapters: Record<string, StoreAdapter> = {
  ikea: {
    id: 'ikea',
    postProcess(p) {
      // IKEA JSON-LD names read "AKTERSPRING Lámpara de mesa - blanco ópalo…".
      // Keep them, but make sure the category from the breadcrumb is used.
      if (!p.category && p.breadcrumbs.length) p.category = p.breadcrumbs[p.breadcrumbs.length - 1] ?? null;
      return p;
    },
  },
  amazon: {
    id: 'amazon',
    postProcess(p) {
      if (p.brand && /^(visita la tienda de|visit the|marca:)\s*/i.test(p.brand)) {
        p.brand = p.brand.replace(/^(visita la tienda de|visit the|marca:)\s*/i, '').replace(/\s*store$/i, '');
      }
      return p;
    },
  },
};

export function applyAdapter(product: SourceProduct): SourceProduct {
  product.title = cleanStoreTitle(product.title, product.store.name);
  const adapter = adapters[product.store.id];
  return adapter ? adapter.postProcess(product) : product;
}
