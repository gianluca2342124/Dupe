import type { Dimensions } from '../../types/product';

/**
 * Extracts physical dimensions (normalised to cm) from Spanish/English text,
 * schema.org QuantitativeValue objects or "39 cm" strings.
 */

const UNIT_FACTORS: Record<string, number> = { mm: 0.1, cm: 1, m: 100, in: 2.54, '"': 2.54, pulgadas: 2.54 };

function toCm(value: number, unit: string | undefined): number | null {
  const u = (unit ?? 'cm').toLowerCase();
  const factor = UNIT_FACTORS[u] ?? UNIT_FACTORS[u.replace(/s$/, '')];
  if (factor === undefined) return null;
  const cm = value * factor;
  return cm > 0.5 && cm < 1000 ? Math.round(cm * 10) / 10 : null;
}

function num(s: string): number {
  return Number(s.replace(',', '.'));
}

export function emptyDimensions(): Dimensions {
  return { widthCm: null, heightCm: null, depthCm: null, diameterCm: null, lengthCm: null };
}

export function hasDimensions(d: Dimensions | null | undefined): boolean {
  return !!d && Object.values(d).some((v) => v !== null);
}

const N = String.raw`(\d{1,4}(?:[.,]\d{1,2})?)`;
const U = String.raw`\s*(mm|cm|m|in|"|pulgadas)(?![a-z])`;
const OPT_U = `(?:${U})?`;

const LABELLED: { field: keyof Dimensions; re: RegExp }[] = [
  { field: 'diameterCm', re: new RegExp(String.raw`(?:Ø|ø|⌀|di[aá]m(?:etro)?\.?|diameter|dia\.)\s*:?\s*${N}${OPT_U}`, 'i') },
  { field: 'heightCm', re: new RegExp(String.raw`(?:\balt(?:ura|o)?\.?|\bheight|\bH)\s*:?\s*${N}${OPT_U}`, 'i') },
  { field: 'widthCm', re: new RegExp(String.raw`(?:\banch(?:ura|o)\.?|\ban\.|\bwidth|\bW)\s*:?\s*${N}${OPT_U}`, 'i') },
  { field: 'depthCm', re: new RegExp(String.raw`(?:\bfondo|\bprof(?:undidad)?\.?|\bdepth|\bP)\s*:?\s*${N}${OPT_U}`, 'i') },
  { field: 'lengthCm', re: new RegExp(String.raw`(?:\blarg(?:o|ura)\.?|\blongitud|\blength|\bL)\s*:?\s*${N}${OPT_U}`, 'i') },
];

const SUFFIXED: { field: keyof Dimensions; re: RegExp }[] = [
  { field: 'heightCm', re: new RegExp(String.raw`${N}${U}\s*(?:de\s+)?(?:alto|altura|high|tall)`, 'i') },
  { field: 'widthCm', re: new RegExp(String.raw`${N}${U}\s*(?:de\s+)?(?:ancho|anchura|wide)`, 'i') },
  { field: 'depthCm', re: new RegExp(String.raw`${N}${U}\s*(?:de\s+)?(?:fondo|profundidad|deep)`, 'i') },
  { field: 'diameterCm', re: new RegExp(String.raw`${N}${U}\s*(?:de\s+)?(?:di[aá]metro|diameter)`, 'i') },
];

const TRIPLE = new RegExp(String.raw`${N}\s*[x×*]\s*${N}\s*[x×*]\s*${N}${U}`, 'i');
const DOUBLE = new RegExp(String.raw`${N}\s*[x×*]\s*${N}${U}`, 'i');
const SINGLE = new RegExp(String.raw`(?:^|[\s,(-])${N}${U}(?![\w²³])`, 'i');

export function parseDimensionsFromText(text: string | null | undefined): Dimensions | null {
  if (!text) return null;
  const t = text.replace(/\s+/g, ' ');
  const d = emptyDimensions();

  for (const { field, re } of [...LABELLED, ...SUFFIXED]) {
    if (d[field] !== null) continue;
    const m = re.exec(t);
    if (m?.[1]) {
      // Only accept labelled values when a unit is explicit, or the label is unambiguous.
      const unit = m[2];
      if (!unit && ['heightCm', 'widthCm', 'depthCm', 'lengthCm'].includes(field) && /\b[HWPL]\b/.test(m[0])) continue;
      d[field] = toCm(num(m[1]), unit);
    }
  }

  if (!hasDimensions(d)) {
    const triple = TRIPLE.exec(t);
    if (triple?.[1] && triple[2] && triple[3]) {
      d.widthCm = toCm(num(triple[1]), triple[4]);
      d.depthCm = toCm(num(triple[2]), triple[4]);
      d.heightCm = toCm(num(triple[3]), triple[4]);
    } else {
      const double = DOUBLE.exec(t);
      if (double?.[1] && double[2]) {
        d.widthCm = toCm(num(double[1]), double[3]);
        d.heightCm = toCm(num(double[2]), double[3]);
      } else {
        const single = SINGLE.exec(t);
        if (single?.[1]) d.lengthCm = toCm(num(single[1]), single[2]);
      }
    }
  }
  return hasDimensions(d) ? d : null;
}

const UNIT_CODES: Record<string, string> = { CMT: 'cm', MMT: 'mm', MTR: 'm', INH: 'in' };

/** schema.org width/height/depth: "39 cm" | 39 | { value, unitCode|unitText }. */
export function parseQuantitativeValue(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return toCm(v, 'cm');
  if (typeof v === 'string') {
    const m = new RegExp(`${N}${OPT_U}`, 'i').exec(v);
    return m?.[1] ? toCm(num(m[1]), m[2]) : null;
  }
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>;
    const value = typeof o.value === 'number' ? o.value : typeof o.value === 'string' ? num(o.value) : null;
    if (value === null || !Number.isFinite(value)) return null;
    const unit =
      typeof o.unitCode === 'string'
        ? UNIT_CODES[o.unitCode.toUpperCase()] ?? o.unitCode
        : typeof o.unitText === 'string'
          ? o.unitText
          : 'cm';
    return toCm(value, unit);
  }
  return null;
}

export function mergeDimensions(...items: (Dimensions | null)[]): Dimensions | null {
  const out = emptyDimensions();
  for (const item of items) {
    if (!item) continue;
    for (const key of Object.keys(out) as (keyof Dimensions)[]) {
      if (out[key] === null && item[key] !== null) out[key] = item[key];
    }
  }
  return hasDimensions(out) ? out : null;
}

/** All known measures, largest first — used for order-independent comparison. */
export function sortedMeasures(d: Dimensions | null): number[] {
  if (!d) return [];
  return Object.values(d)
    .filter((v): v is number => typeof v === 'number')
    .sort((a, b) => b - a);
}

export function formatDimensions(d: Dimensions | null): string | null {
  if (!d) return null;
  const f = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(1).replace('.', ',')} cm`;
  if (d.diameterCm) return `Ø ${f(d.diameterCm)}${d.heightCm ? ` · Alto ${f(d.heightCm)}` : ''}`;
  const parts: string[] = [];
  if (d.widthCm) parts.push(`An ${f(d.widthCm)}`);
  if (d.depthCm) parts.push(`Fondo ${f(d.depthCm)}`);
  if (d.heightCm) parts.push(`Alto ${f(d.heightCm)}`);
  if (parts.length) return parts.join(' · ');
  if (d.lengthCm) return f(d.lengthCm);
  return null;
}
