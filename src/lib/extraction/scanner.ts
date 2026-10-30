import { decodeEntities } from './entities';

/**
 * Single-pass, allocation-light HTML scanner.
 *
 * Real product pages are big (IKEA ships ~1.2 MB of HTML with the JSON-LD
 * near the end). Building a DOM for that would burn the Worker CPU budget, so
 * we only pull out what extraction needs with linear-time regular expressions
 * that respect quoted attribute values.
 */

export interface PageScan {
  title: string | null;
  lang: string | null;
  /** meta name/property/itemprop (lower-case) → contents, in document order. */
  meta: Map<string, string[]>;
  canonical: string | null;
  /** Parsed JSON-LD blocks (each may be an object, array or @graph container). */
  jsonLd: unknown[];
  jsonLdErrors: number;
  /** Microdata itemprop → values (content/src/href attribute or short inner text). */
  microdata: Map<string, string[]>;
  /** Whether a schema.org Product itemscope exists. */
  hasProductItemscope: boolean;
  h1: string | null;
  /** First large-looking images (src + alt) for last-resort fallbacks. */
  images: { src: string; alt: string | null }[];
  bytes: number;
}

const TAG_ATTRS = String.raw`(?:[^>"']|"[^"]*"|'[^']*')*`;
const META_RE = new RegExp(String.raw`<meta\b(${TAG_ATTRS})>`, 'gi');
const LINK_RE = new RegExp(String.raw`<link\b(${TAG_ATTRS})>`, 'gi');
const JSONLD_RE = new RegExp(
  String.raw`<script\b(${TAG_ATTRS})>([\s\S]*?)<\/script\s*>`,
  'gi',
);
const ITEMPROP_RE = new RegExp(String.raw`<([a-z][a-z0-9-]*)\b(${TAG_ATTRS}\bitemprop\s*=${TAG_ATTRS})>`, 'gi');
const IMG_RE = new RegExp(String.raw`<img\b(${TAG_ATTRS})>`, 'gi');
const ATTR_RE = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*(?:=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

export function parseAttributes(fragment: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  ATTR_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = ATTR_RE.exec(fragment))) {
    const name = m[1]!.toLowerCase();
    if (name in attrs) continue;
    attrs[name] = decodeEntities(m[2] ?? m[3] ?? m[4] ?? '');
  }
  return attrs;
}

function push(map: Map<string, string[]>, key: string, value: string) {
  const list = map.get(key);
  if (list) {
    if (list.length < 20) list.push(value);
  } else map.set(key, [value]);
}

function stripTags(s: string): string {
  return decodeEntities(s.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

/** Parses JSON-LD leniently: strips HTML comments/CDATA and control characters. */
export function parseJsonLd(raw: string): unknown | undefined {
  let text = raw.trim();
  if (!text) return undefined;
  text = text.replace(/^<!--|-->$/g, '').replace(/^\/\*<!\[CDATA\[\*\/|\/\*\]\]>\*\/$/g, '').trim();
  try {
    return JSON.parse(text);
  } catch {
    try {
      // Common breakages: raw newlines/tabs inside strings, trailing commas.
      const repaired = text
        // eslint-disable-next-line no-control-regex -- raw control chars are what breaks JSON.parse here
        .replace(/[\u0000-\u001F]+/g, ' ')
        .replace(/,\s*([}\]])/g, '$1');
      return JSON.parse(repaired);
    } catch {
      return undefined;
    }
  }
}

export function scanHtml(html: string): PageScan {
  const meta = new Map<string, string[]>();
  const microdata = new Map<string, string[]>();
  const jsonLd: unknown[] = [];
  let jsonLdErrors = 0;

  const titleMatch = /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  const langMatch = /<html\b[^>]*\blang\s*=\s*["']?([a-zA-Z-]{2,10})/i.exec(html);
  const h1Match = /<h1\b[^>]*>([\s\S]{0,600}?)<\/h1>/i.exec(html);

  META_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = META_RE.exec(html))) {
    const attrs = parseAttributes(m[1] ?? '');
    const key = (attrs.property ?? attrs.name ?? attrs.itemprop ?? '').toLowerCase().trim();
    const content = attrs.content;
    if (key && content !== undefined && content.trim()) push(meta, key, content.trim());
    if (attrs.itemprop && content !== undefined) push(microdata, attrs.itemprop.toLowerCase(), content.trim());
  }

  let canonical: string | null = null;
  LINK_RE.lastIndex = 0;
  while ((m = LINK_RE.exec(html))) {
    const attrs = parseAttributes(m[1] ?? '');
    const rel = (attrs.rel ?? '').toLowerCase();
    if (!canonical && rel.split(/\s+/).includes('canonical') && attrs.href) canonical = attrs.href;
    if (rel === 'image_src' && attrs.href) push(meta, 'image_src', attrs.href);
    if (attrs.itemprop && attrs.href) push(microdata, attrs.itemprop.toLowerCase(), attrs.href);
  }

  JSONLD_RE.lastIndex = 0;
  while ((m = JSONLD_RE.exec(html))) {
    const attrs = parseAttributes(m[1] ?? '');
    if (!/application\/ld\+json/i.test(attrs.type ?? '')) continue;
    const parsed = parseJsonLd(m[2] ?? '');
    if (parsed === undefined) jsonLdErrors++;
    else jsonLd.push(parsed);
  }

  const hasProductItemscope = /itemtype\s*=\s*["']?https?:\/\/schema\.org\/Product\b/i.test(html);
  if (hasProductItemscope || /\bitemprop\s*=/i.test(html)) {
    ITEMPROP_RE.lastIndex = 0;
    let count = 0;
    while ((m = ITEMPROP_RE.exec(html)) && count < 400) {
      count++;
      const tag = m[1]!.toLowerCase();
      const attrs = parseAttributes(m[2] ?? '');
      const prop = attrs.itemprop?.toLowerCase();
      if (!prop) continue;
      let value = attrs.content ?? (tag === 'img' ? attrs.src : undefined) ?? (tag === 'a' || tag === 'link' ? attrs.href : undefined);
      if (value === undefined && tag !== 'meta') {
        // Short inner text right after the opening tag (e.g. <span itemprop="price">39,99</span>).
        const after = html.slice(ITEMPROP_RE.lastIndex, ITEMPROP_RE.lastIndex + 300);
        const end = after.search(new RegExp(`</${tag}\\s*>`, 'i'));
        if (end >= 0) value = stripTags(after.slice(0, end));
      }
      if (value) push(microdata, prop, value.trim());
    }
  }

  const images: { src: string; alt: string | null }[] = [];
  IMG_RE.lastIndex = 0;
  while ((m = IMG_RE.exec(html)) && images.length < 12) {
    const attrs = parseAttributes(m[1] ?? '');
    const src = attrs.src ?? attrs['data-src'] ?? attrs.srcset?.split(/\s+/)[0];
    if (!src || src.startsWith('data:')) continue;
    const width = Number(attrs.width ?? '0');
    if (width && width < 200) continue;
    images.push({ src, alt: attrs.alt?.trim() || null });
  }

  return {
    title: titleMatch?.[1] ? stripTags(titleMatch[1]) || null : null,
    lang: langMatch?.[1]?.toLowerCase() ?? null,
    meta,
    canonical,
    jsonLd,
    jsonLdErrors,
    microdata,
    hasProductItemscope,
    h1: h1Match?.[1] ? stripTags(h1Match[1]) || null : null,
    images,
    bytes: html.length,
  };
}

export function firstMeta(scan: PageScan, ...keys: string[]): string | null {
  for (const k of keys) {
    const v = scan.meta.get(k.toLowerCase())?.[0];
    if (v) return v;
  }
  return null;
}

export function firstMicrodata(scan: PageScan, ...keys: string[]): string | null {
  for (const k of keys) {
    const v = scan.microdata.get(k.toLowerCase())?.[0];
    if (v) return v;
  }
  return null;
}
