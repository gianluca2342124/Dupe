import type { ProductAnalysis, SearchQuery } from '../../types/matching';
import { CATEGORY_BY_ID, CONCEPTS } from './analyze';
import { PROTECTED_NAMES } from './lexicon';
import { normalizePhrase } from './text';

/**
 * Builds a few complementary search queries from an analysis, most specific
 * first. Brand, model and designer names are never included: searching for
 * them is how marketplaces surface counterfeits.
 */
export function buildQueries(a: ProductAnalysis, opts: { maxQueries: number; sourcePrice: number | null }): SearchQuery[] {
  const category = a.categoryId ? CATEGORY_BY_ID.get(a.categoryId) : undefined;
  const en = (kind: keyof typeof CONCEPTS, id: string | undefined) => (id ? CONCEPTS[kind].get(id)?.en : undefined);
  const es = (kind: keyof typeof CONCEPTS, id: string | undefined) => (id ? CONCEPTS[kind].get(id)?.es : undefined);

  const shape = en('shapes', a.shapes[0]);
  const material = en('materials', a.materials[0]);
  const material2 = en('materials', a.materials[1]);
  const color = en('colors', a.colors[0]);
  const style = en('styles', a.styles[0]);
  const feature = en('features', a.features[0]);
  const noun = category?.en ?? null;

  const blocked = new Set([...a.brandTokens, ...PROTECTED_NAMES.map(normalizePhrase)]);
  const clean = (parts: (string | undefined | null)[]) => {
    const words = parts
      .filter((p): p is string => !!p)
      .join(' ')
      .split(/\s+/)
      .filter((w) => w && !blocked.has(normalizePhrase(w)));
    return [...new Set(words)].join(' ').trim();
  };

  // Max price: a generous ceiling to avoid irrelevant premium listings.
  const maxPrice = opts.sourcePrice ? Math.round(opts.sourcePrice * 1.1 * 100) / 100 : undefined;
  const withPrice = (q: Omit<SearchQuery, 'maxPrice'>): SearchQuery => (maxPrice ? { ...q, maxPrice } : q);

  const queries: SearchQuery[] = [];
  if (noun) {
    queries.push(withPrice({ text: clean([shape, material, color && !shape ? color : null, noun]), lang: 'en', intent: 'precise' }));
    queries.push(withPrice({ text: clean([color, material ?? material2, noun, feature]), lang: 'en', intent: 'attribute' }));
    if (style || shape) queries.push(withPrice({ text: clean([style, shape, noun]), lang: 'en', intent: 'attribute' }));
    const esQuery = clean([category?.es, es('shapes', a.shapes[0]), es('materials', a.materials[0]), es('colors', a.colors[0])]);
    queries.push(withPrice({ text: esQuery, lang: 'es', intent: 'broad' }));
    queries.push(withPrice({ text: clean([noun, ...a.tokens.slice(0, 2)]), lang: 'en', intent: 'broad' }));
  } else if (a.tokens.length) {
    // Unknown category: fall back to the informative title tokens.
    queries.push(withPrice({ text: clean(a.tokens.slice(0, 5)), lang: 'es', intent: 'broad' }));
    if (a.keywordsEn.length) queries.push(withPrice({ text: clean(a.keywordsEn.slice(0, 4)), lang: 'en', intent: 'attribute' }));
  }

  const seen = new Set<string>();
  return queries
    .filter((q) => {
      const key = q.text.toLowerCase();
      if (!key || key.split(' ').length < 1 || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, opts.maxQueries);
}
