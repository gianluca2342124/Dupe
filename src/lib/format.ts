import type { Money } from '../types/product';
import type { CandidateCaveat, MatchTier, SavingsBasis } from '../types/matching';
import type { ResultLabel } from '../types/search';

/** Client-safe formatting helpers (no server imports). */

const moneyFmt = new Map<string, Intl.NumberFormat>();

export function money(m: Money | null | undefined, opts: { compact?: boolean } = {}): string {
  if (!m) return '—';
  const key = `${m.currency}:${opts.compact ? 1 : 0}`;
  let f = moneyFmt.get(key);
  if (!f) {
    f = new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: m.currency,
      minimumFractionDigits: opts.compact && Number.isInteger(m.amount) ? 0 : 2,
      maximumFractionDigits: 2,
    });
    moneyFmt.set(key, f);
  }
  return f.format(m.amount);
}

export function number(n: number): string {
  return new Intl.NumberFormat('es-ES').format(n);
}

export function relativeTime(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return '';
  const diff = Math.max(0, now - Date.parse(iso));
  const min = Math.round(diff / 60_000);
  if (min < 1) return 'ahora mismo';
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? 'ayer' : `hace ${d} días`;
}

export const TIER_LABEL: Record<MatchTier, string> = {
  verified: 'Mismo producto',
  very_similar: 'Muy similar',
  similar: 'Similar',
  low_confidence: 'Baja confianza',
};

export const TIER_HELP: Record<MatchTier, string> = {
  verified: 'Comparte código de producto (EAN o referencia) con el original.',
  very_similar: 'Coinciden tipo de producto, forma y material o color.',
  similar: 'Mismo tipo de producto con varias características en común.',
  low_confidence: 'Se parece en algunos aspectos; revísalo con calma.',
};

export const LABEL_TEXT: Record<ResultLabel, string> = {
  most_similar: 'Más parecido',
  cheapest: 'Más barato',
};

export const CAVEAT_TEXT: Partial<Record<CandidateCaveat, string>> = {
  price_from: 'Precio “desde”: varía según la opción elegida',
  shipping_unknown: 'Envío no indicado por la tienda',
  size_differs: 'Tamaño distinto al original',
  pack_differs: 'Distinto número de unidades',
};

export function savingsBasisText(basis: SavingsBasis): string {
  return basis === 'total_with_shipping' ? 'con envío incluido' : 'sin contar el envío';
}

export function deliveryText(d: { min: number | null; max: number | null } | null): string | null {
  if (!d || d.max === null) return null;
  if (d.min !== null && d.min !== d.max) return `Entrega en ${d.min}–${d.max} días`;
  return `Entrega en unos ${d.max} días`;
}
