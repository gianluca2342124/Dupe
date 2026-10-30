/**
 * When a store refuses automatic reading, the product URL itself is often
 * descriptive: `zarahome.com/es/jarron-ceramica-texturizada-l42345678`.
 * This derives a human-readable product name from the path, without any
 * network access. The result is clearly marked as `url-only` downstream.
 */

const NOISE_SEGMENTS = new Set([
  'es', 'es-es', 'es_es', 'en', 'p', 'pd', 'product', 'products', 'producto', 'productos', 'item', 'dp', 'gp',
  'shop', 'tienda', 'home', 'catalog', 'catalogo', 'detail', 'articulo', 'articulos', 'comprar', 'buy', 'www',
]);

const NOISE_WORDS = new Set(['html', 'htm', 'php', 'aspx', 'jsp', 'ref', 'sku', 'id', 'comprar', 'buy']);

function looksLikeId(token: string): boolean {
  // Pure numbers, product codes (l42345678, b0abc12345, 00586548, abc-123x) …
  return /^\d+$/.test(token) || /^[a-z]{0,3}\d{4,}[a-z]?$/i.test(token) || /^[a-z0-9]{10}$/i.test(token) && /\d/.test(token) && /[a-z]/i.test(token);
}

export function nameFromUrl(rawUrl: string): string | null {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  const segments = url.pathname
    .split('/')
    .map((s) => {
      try {
        return decodeURIComponent(s);
      } catch {
        return s;
      }
    })
    .map((s) => s.replace(/\.(html?|php|aspx?|jsp)$/i, '').toLowerCase())
    .filter((s) => s && !NOISE_SEGMENTS.has(s));

  // The most descriptive segment is the one with the most word-like tokens.
  let best: string[] = [];
  for (const segment of segments) {
    const tokens = segment
      .split(/[-_+.\s]+/)
      .filter((t) => t && !NOISE_WORDS.has(t) && !looksLikeId(t) && /[a-záéíóúñü]/i.test(t));
    if (tokens.length > best.length) best = tokens;
  }
  if (best.length < 2) return null;
  const text = best.join(' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}
