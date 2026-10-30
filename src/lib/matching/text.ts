/**
 * Text normalisation shared by the analyser and the lexicon, so that
 * "Lámparas de Mesa", "lampara de mesa" and "LAMPARA MESA" compare equal.
 */

export function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/** Lightweight ES/EN singularisation. Must be idempotent on singular forms. */
export function singularize(token: string): string {
  const t = token;
  if (t.length <= 3) return t;
  if (/(ss|us|is)$/.test(t)) return t;
  if (t.endsWith('sses')) return t.slice(0, -2); // glasses → glass
  if (t.endsWith('ies') && t.length > 4) return `${t.slice(0, -3)}y`; // accessories → accessory
  if (t.endsWith('ces') && t.length > 4) return `${t.slice(0, -3)}z`; // luces → luz
  if (t.endsWith('lves')) return `${t.slice(0, -3)}f`; // shelves → shelf
  if (/(x|ch|sh|z)es$/.test(t)) return t.slice(0, -2); // boxes, benches, dishes
  if (/(on|in|an)es$/.test(t) && t.length >= 7) return t.slice(0, -2); // sillones, cojines, jarrones
  if (t.endsWith('ores') && t.length >= 6) return t.slice(0, -2); // colores, interiores
  if (t.endsWith('s') && !t.endsWith('ss')) return t.slice(0, -1);
  return t;
}

/** Lower-case, accent-free, punctuation → spaces, collapsed. */
export function normalizeText(s: string | null | undefined): string {
  if (!s) return '';
  return stripAccents(s.toLowerCase())
    .replace(/&/g, ' y ')
    .replace(/[^a-z0-9ñ\s.,x×/-]/g, ' ')
    .replace(/[/_-]+/g, ' ')
    .replace(/(\d)[.,](\d)/g, '$1_$2')
    .replace(/[.,]/g, ' ')
    .replace(/_/g, '.')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Tokens, singularised. Numbers are kept (sizes, pack counts). */
export function tokenize(s: string | null | undefined): string[] {
  const norm = normalizeText(s);
  if (!norm) return [];
  return norm.split(' ').filter(Boolean).map(singularize);
}

/** " a b c " — padded, singularised token string for whole-phrase matching. */
export function phraseText(s: string | null | undefined): string {
  const tokens = tokenize(s);
  return tokens.length ? ` ${tokens.join(' ')} ` : ' ';
}

/** Normalises a lexicon phrase the same way as text, for consistent matching. */
export function normalizePhrase(phrase: string): string {
  return tokenize(phrase).join(' ');
}

export const STOPWORDS = new Set(
  [
    // Spanish
    'de', 'del', 'la', 'el', 'lo', 'los', 'las', 'y', 'e', 'o', 'u', 'con', 'sin', 'para', 'en', 'por', 'un', 'una',
    'uno', 'al', 'a', 'su', 'sus', 'tu', 'mi', 'muy', 'mas', 'tipo', 'estilo', 'modelo', 'nuevo', 'nueva', 'gran',
    'grande', 'pequeno', 'pequena', 'mediano', 'mediana', 'ideal', 'perfecto', 'regalo', 'oferta', 'envio', 'gratis',
    'calidad', 'alta', 'alto', 'ancho', 'fondo', 'unidad', 'ud', 'uds', 'cm', 'mm', 'm', 'kg', 'g', 'w', 'v', 'pza',
    'pieza', 'hogar', 'casa', 'decoracion', 'decorativo', 'decorativa', 'interior', 'salon', 'dormitorio', 'habitacion',
    'cocina', 'bano', 'oficina', 'comedor', 'recibidor', 'producto', 'articulo', 'diseno', 'moderno', 'moderna',
    // English
    'the', 'and', 'or', 'with', 'without', 'for', 'of', 'in', 'on', 'to', 'by', 'from', 'a', 'an', 'new', 'hot',
    'sale', 'free', 'shipping', 'quality', 'high', 'best', 'style', 'type', 'home', 'house', 'decor', 'decoration',
    'decorative', 'room', 'living', 'bedroom', 'kitchen', 'bathroom', 'office', 'modern', 'design', 'creative',
    'nordic', 'luxury', 'simple', 'piece', 'pc', 'pcs', 'set', 'gift', 'ins', 'cm', 'inch', 'size', 'large', 'small',
    'medium', 'big', 'mini', 'product', 'item', 'diy', 'unique', 'beautiful', 'cute', 'fashion', 'popular', 'original',
    '2023', '2024', '2025', '2026', '2027',
  ].map((w) => singularize(stripAccents(w))),
);

export function informativeTokens(s: string | null | undefined): string[] {
  return tokenize(s).filter((t) => t.length > 1 && !STOPWORDS.has(t) && !/^\d+(\.\d+)?$/.test(t));
}

/** Jaccard similarity of two token sets. */
export function jaccard(a: readonly string[], b: readonly string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const A = new Set(a);
  const B = new Set(b);
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  return inter / (A.size + B.size - inter);
}
