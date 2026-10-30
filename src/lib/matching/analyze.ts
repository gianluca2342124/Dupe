import type { Dimensions } from '../../types/product';
import type { AnalysisSource, ProductAnalysis } from '../../types/matching';
import { mergeDimensions, parseDimensionsFromText } from '../extraction/dimensions';
import { nameFromUrl } from '../extraction/url-slug';
import {
  CATEGORIES,
  COLORS,
  FEATURES,
  MATERIALS,
  PACK_PATTERNS,
  SHAPES,
  STYLES,
  type CategoryDef,
  type ConceptDef,
} from './lexicon';
import { informativeTokens, normalizePhrase, phraseText, stripAccents, tokenize } from './text';

interface CompiledTerm {
  phrase: string;
  id: string;
  words: number;
}

function compile(defs: { id: string; terms: string[] }[]): CompiledTerm[] {
  const out: CompiledTerm[] = [];
  for (const def of defs) {
    for (const term of def.terms) {
      const phrase = normalizePhrase(term);
      if (phrase) out.push({ phrase, id: def.id, words: phrase.split(' ').length });
    }
  }
  return out.sort((a, b) => b.words - a.words || b.phrase.length - a.phrase.length);
}

let compiled: {
  categories: CompiledTerm[];
  colors: CompiledTerm[];
  materials: CompiledTerm[];
  shapes: CompiledTerm[];
  styles: CompiledTerm[];
  features: CompiledTerm[];
  lexiconWords: Set<string>;
} | null = null;

function lexicon() {
  if (!compiled) {
    const categories = compile(CATEGORIES);
    const colors = compile(COLORS);
    const materials = compile(MATERIALS);
    const shapes = compile(SHAPES);
    const styles = compile(STYLES);
    const features = compile(FEATURES);
    const lexiconWords = new Set<string>();
    for (const list of [categories, colors, materials, shapes, styles, features]) {
      for (const t of list) for (const w of t.phrase.split(' ')) lexiconWords.add(w);
    }
    compiled = { categories, colors, materials, shapes, styles, features, lexiconWords };
  }
  return compiled;
}

export const CATEGORY_BY_ID = new Map<string, CategoryDef>(CATEGORIES.map((c) => [c.id, c]));
const COLOR_BY_ID = new Map<string, ConceptDef>(COLORS.map((c) => [c.id, c]));
const MATERIAL_BY_ID = new Map<string, ConceptDef>(MATERIALS.map((c) => [c.id, c]));
const SHAPE_BY_ID = new Map<string, ConceptDef>(SHAPES.map((c) => [c.id, c]));
const STYLE_BY_ID = new Map<string, ConceptDef>(STYLES.map((c) => [c.id, c]));
const FEATURE_BY_ID = new Map<string, ConceptDef>(FEATURES.map((c) => [c.id, c]));

export const CONCEPTS = {
  colors: COLOR_BY_ID,
  materials: MATERIAL_BY_ID,
  shapes: SHAPE_BY_ID,
  styles: STYLE_BY_ID,
  features: FEATURE_BY_ID,
};

const GENERIC_CATEGORIES = new Set(['lamp', 'table']);

interface Hit {
  id: string;
  pos: number;
  words: number;
}

/** Finds concept ids in a padded phrase text; longer phrases consume shorter overlaps. */
export function findConcepts(text: string, terms: CompiledTerm[]): Hit[] {
  let working = text;
  const hits: Hit[] = [];
  for (const term of terms) {
    const needle = ` ${term.phrase} `;
    let idx = working.indexOf(needle);
    while (idx >= 0) {
      hits.push({ id: term.id, pos: idx, words: term.words });
      working = working.slice(0, idx + 1) + ' '.repeat(term.phrase.length) + working.slice(idx + 1 + term.phrase.length);
      idx = working.indexOf(needle, idx + 1);
    }
  }
  return hits.sort((a, b) => a.pos - b.pos);
}

function uniqueIds(hits: Hit[]): string[] {
  return [...new Set(hits.map((h) => h.id))];
}

/** Picks the main category of a phrase: before "para/for" if possible, then longest, then earliest. */
function pickCategory(text: string): string | null {
  const hits = findConcepts(text, lexicon().categories);
  if (hits.length === 0) return null;
  const boundary = Math.min(
    ...[' para ', ' for ', ' compatible '].map((b) => {
      const i = text.indexOf(b);
      return i < 0 ? Number.POSITIVE_INFINITY : i;
    }),
  );
  const before = hits.filter((h) => h.pos < boundary);
  const pool = before.length ? before : hits;
  const specific = pool.filter((h) => !GENERIC_CATEGORIES.has(h.id));
  const ranked = (specific.length ? specific : pool).sort((a, b) => b.words - a.words || a.pos - b.pos);
  return ranked[0]?.id ?? null;
}

export function detectPackSize(rawTitle: string | null | undefined): number | null {
  if (!rawTitle) return null;
  const t = stripAccents(rawTitle);
  for (const re of PACK_PATTERNS) {
    const m = re.exec(t);
    if (m?.[1]) {
      const n = Number(m[1]);
      if (n >= 1 && n <= 24) return n;
    }
  }
  return null;
}

export interface AnalysisInput {
  title: string | null;
  description?: string | null;
  breadcrumbs?: string[];
  category?: string | null;
  color?: string | null;
  material?: string | null;
  attributes?: Record<string, string>;
  categoryPath?: string[];
  url?: string | null;
  brand?: string | null;
  dimensions?: Dimensions | null;
  /** Extra brand-like tokens to exclude from queries (e.g. store name). */
  extraBrandTokens?: string[];
}

/** Upper-case model names (e.g. "AKTERSPRING") that aren't vocabulary words. */
function modelNameTokens(rawTitle: string | null): string[] {
  if (!rawTitle) return [];
  const lex = lexicon().lexiconWords;
  return (rawTitle.match(/\b[A-ZÁÉÍÓÚÑÜ]{4,}\b/g) ?? [])
    .map((w) => tokenize(w)[0] ?? '')
    .filter((w) => w && !lex.has(w) && !['led', 'usb', 'set'].includes(w));
}

export function analyzeProduct(input: AnalysisInput): ProductAnalysis {
  const lex = lexicon();
  const sources = new Set<AnalysisSource>();
  const title = input.title ?? '';
  const titleText = phraseText(title);
  const descText = phraseText((input.description ?? '').slice(0, 500));
  const crumbs = input.breadcrumbs ?? input.categoryPath ?? [];
  const lastCrumbText = phraseText(crumbs[crumbs.length - 1] ?? '');
  const crumbsText = phraseText(crumbs.join(' '));
  const catText = phraseText(input.category ?? '');
  const attrValues = Object.entries(input.attributes ?? {})
    .filter(([k]) => !/brand|marca|model|modelo|origin|origen|certif/i.test(k))
    .map(([, v]) => v);
  const attrText = phraseText([input.color, input.material, ...attrValues].filter(Boolean).join(' '));
  const urlText = input.url ? phraseText(nameFromUrl(input.url)) : ' ';

  // Category: specific beats generic; earlier sources win at equal specificity.
  const categorySources: [string, number, AnalysisSource][] = [
    [titleText, 0.9, 'title'],
    [lastCrumbText, 0.85, 'breadcrumbs'],
    [catText, 0.8, 'breadcrumbs'],
    [crumbsText, 0.75, 'breadcrumbs'],
    [urlText, 0.6, 'url'],
    [descText, 0.45, 'description'],
  ];
  let categoryId: string | null = null;
  let categoryConfidence = 0;
  for (const [text, conf, source] of categorySources) {
    const found = pickCategory(text);
    if (!found) continue;
    const isGeneric = GENERIC_CATEGORIES.has(found);
    const currentGeneric = categoryId ? GENERIC_CATEGORIES.has(categoryId) : true;
    const sameGroup = categoryId && CATEGORY_BY_ID.get(categoryId)?.group === CATEGORY_BY_ID.get(found)?.group;
    if (!categoryId || (currentGeneric && !isGeneric && (sameGroup || conf >= 0.75))) {
      categoryId = found;
      categoryConfidence = categoryConfidence ? Math.max(categoryConfidence * 0.95, conf * 0.95) : conf;
      sources.add(source);
    }
    if (categoryId && !GENERIC_CATEGORIES.has(categoryId)) break;
  }
  if (categoryId && GENERIC_CATEGORIES.has(categoryId)) categoryConfidence = Math.min(categoryConfidence, 0.6);

  const attrsAndTitle = `${attrText}${titleText}`;
  const colors = uniqueIds(findConcepts(attrsAndTitle, lex.colors));
  const materials = uniqueIds(findConcepts(`${attrsAndTitle}${descText}`, lex.materials));
  const shapes = uniqueIds(findConcepts(`${titleText}${attrText}${descText}`, lex.shapes));
  const styles = uniqueIds(findConcepts(`${titleText}${crumbsText}${descText}`, lex.styles));
  const features = uniqueIds(findConcepts(`${titleText}${attrText}${descText}`, lex.features));
  if (colors.length || materials.length) sources.add(attrText.trim() ? 'attributes' : 'title');
  if (descText.trim()) sources.add('description');

  const dimensions = input.dimensions ?? mergeDimensions(parseDimensionsFromText(title), parseDimensionsFromText(input.description ?? null));

  const brandTokens = [
    ...tokenize(input.brand ?? ''),
    ...modelNameTokens(title),
    ...(input.extraBrandTokens ?? []).flatMap((t) => tokenize(t)),
  ].filter((t) => t.length > 1);
  const brandSet = new Set(brandTokens);
  const tokens = informativeTokens(title).filter((t) => !brandSet.has(t));

  const category = categoryId ? CATEGORY_BY_ID.get(categoryId) : undefined;
  const en = (map: Map<string, ConceptDef>, ids: string[], n: number) =>
    ids.slice(0, n).map((id) => map.get(id)?.en).filter((x): x is string => !!x);
  const es = (map: Map<string, ConceptDef>, ids: string[], n: number) =>
    ids.slice(0, n).map((id) => map.get(id)?.es).filter((x): x is string => !!x);

  const keywordsEn = [
    ...en(SHAPE_BY_ID, shapes, 2),
    ...en(MATERIAL_BY_ID, materials, 2),
    ...en(COLOR_BY_ID, colors, 1),
    ...(category ? [category.en] : []),
    ...en(FEATURE_BY_ID, features, 2),
    ...en(STYLE_BY_ID, styles, 1),
  ];
  const keywordsEs = [
    ...(category ? [category.es] : []),
    ...es(SHAPE_BY_ID, shapes, 2),
    ...es(MATERIAL_BY_ID, materials, 2),
    ...es(COLOR_BY_ID, colors, 1),
    ...es(FEATURE_BY_ID, features, 1),
  ];

  const flags: string[] = [];
  if (category?.accessory) flags.push('accessory');

  return {
    categoryId,
    groupId: category?.group ?? null,
    categoryConfidence: Math.round(categoryConfidence * 100) / 100,
    colors,
    materials,
    shapes,
    styles,
    features,
    dimensions: dimensions ?? null,
    packSize: detectPackSize(title),
    tokens,
    keywordsEs,
    keywordsEn,
    brandTokens: [...brandSet],
    flags,
    sources: [...sources],
  };
}
