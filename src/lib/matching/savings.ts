import type { CatalogProduct, Money } from '../../types/product';
import type { CandidateCaveat, Savings, SavingsBasis } from '../../types/matching';

export interface ComparablePrice {
  price: Money | null;
  basis: SavingsBasis | null;
  caveats: CandidateCaveat[];
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * The price we compare against the original: item + shipping when the
 * provider reports shipping to Spain, otherwise the item price alone
 * (flagged so the UI can say "envío no incluido").
 */
export function comparablePrice(c: CatalogProduct): ComparablePrice {
  const caveats: CandidateCaveat[] = [];
  if (!c.price) return { price: null, basis: null, caveats };
  if (c.shippingCost && c.shippingCost.currency === c.price.currency) {
    return {
      price: { amount: round2(c.price.amount + c.shippingCost.amount), currency: c.price.currency },
      basis: 'total_with_shipping',
      caveats,
    };
  }
  caveats.push('shipping_unknown');
  return { price: c.price, basis: 'item_price_only', caveats };
}

/**
 * Savings are only computed when both prices exist, share a currency and the
 * candidate is cheaper. `unitRatio` adjusts for pack sizes (source units /
 * candidate units) so a set of 2 is compared per unit.
 */
export function computeSavings(
  source: Money | null,
  comparable: Money | null,
  basis: SavingsBasis | null,
  unitRatio = 1,
): Savings | null {
  if (!source || !comparable || !basis) return null;
  if (source.currency !== comparable.currency) return null;
  if (!(source.amount > 0) || !(comparable.amount > 0)) return null;
  const equivalent = comparable.amount * unitRatio;
  const diff = source.amount - equivalent;
  if (diff <= 0.5) return null; // not meaningfully cheaper
  return {
    amount: { amount: round2(diff), currency: source.currency },
    percent: Math.round((diff / source.amount) * 100),
    basis,
  };
}
