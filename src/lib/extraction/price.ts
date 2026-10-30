import type { Money } from '../../types/product';

const SYMBOLS: [RegExp, string][] = [
  [/€|\beur(?:os?)?\b/i, 'EUR'],
  [/£|\bgbp\b/i, 'GBP'],
  [/US\$|\busd\b|\$/i, 'USD'],
  [/\bchf\b/i, 'CHF'],
  [/\bpln\b|zł/i, 'PLN'],
  [/\bsek\b/i, 'SEK'],
  [/\bdkk\b/i, 'DKK'],
];

export function currencyFromText(text: string): string | null {
  for (const [re, code] of SYMBOLS) if (re.test(text)) return code;
  return null;
}

export function normalizeCurrency(code: unknown): string | null {
  if (typeof code !== 'string') return null;
  const c = code.trim().toUpperCase();
  if (/^[A-Z]{3}$/.test(c)) return c;
  return currencyFromText(code);
}

/**
 * Parses a numeric amount written in European or US notation.
 * "1.299,00" → 1299, "1,299.00" → 1299, "39,99" → 39.99, "39.99" → 39.99,
 * "1.299" → 1299 (3 digits after the only separator ⇒ thousands).
 */
export function parseAmount(input: unknown): number | null {
  if (typeof input === 'number') return Number.isFinite(input) && input > 0 && input < 1_000_000 ? input : null;
  if (typeof input !== 'string') return null;
  const match = /\d[\d.,\s\u00a0\u202f']*/.exec(input);
  if (!match) return null;
  let s = match[0].replace(/[\s\u00a0\u202f']/g, '').replace(/[.,]+$/, '');
  if (!s) return null;

  const lastDot = s.lastIndexOf('.');
  const lastComma = s.lastIndexOf(',');
  let decimalSep: '.' | ',' | null = null;
  if (lastDot >= 0 && lastComma >= 0) {
    decimalSep = lastDot > lastComma ? '.' : ',';
  } else if (lastDot >= 0 || lastComma >= 0) {
    const sep = lastDot >= 0 ? '.' : ',';
    const parts = s.split(sep);
    const tail = parts[1] ?? '';
    // "1.299.000" → thousands; a single separator followed by exactly 3 digits
    // ("1.299") is also a thousands separator; otherwise it is the decimal mark.
    decimalSep = parts.length === 2 && tail.length !== 3 ? sep : null;
  }

  if (decimalSep) {
    const thousands = decimalSep === '.' ? ',' : '.';
    s = s.split(thousands).join('');
    s = s.replace(decimalSep, '.');
  } else {
    s = s.replace(/[.,]/g, '');
  }
  const n = Number(s);
  if (!Number.isFinite(n) || n <= 0 || n >= 1_000_000) return null;
  return Math.round(n * 100) / 100;
}

export function parsePrice(input: unknown, currencyHint?: string | null): Money | null {
  const amount = parseAmount(input);
  if (amount === null) return null;
  const fromText = typeof input === 'string' ? currencyFromText(input) : null;
  const currency = fromText ?? normalizeCurrency(currencyHint ?? null);
  if (!currency) return null;
  return { amount, currency };
}

export function formatMoney(m: Money, locale = 'es-ES'): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency: m.currency }).format(m.amount);
}
