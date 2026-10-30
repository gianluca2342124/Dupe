import type { CatalogProduct } from '../../../types/product';
import { mapAvailability } from '../../extraction/jsonld';
import { parseAmount } from '../../extraction/price';
import { cleanImageUrl, cleanText, cleanUrl } from '../../security/sanitize';

/**
 * Awin product feed parsing (classic "Create-a-Feed" CSV and Enhanced JSONL).
 *
 * Column names follow Awin's publisher feed reference: `aw_product_id`
 * (unique across programmes), `product_name`, `search_price` (publisher
 * price), `aw_deep_link` (publisher-only trackable link), `merchant_image_url`
 * / `aw_image_url`, `currency`, `delivery_cost`, `in_stock`, `ean`… Enhanced
 * feeds nest fields under `product_basic`. Unknown columns are ignored.
 */

export type FeedRow = Record<string, string>;

/** Streaming-friendly CSV line splitter (RFC 4180 quotes, configurable delimiter). */
export function parseCsvLine(line: string, delimiter = ','): string[] {
  const out: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (quoted) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else quoted = false;
      } else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delimiter) {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

/** Async iterator over CSV records from a text stream (handles quoted newlines). */
export async function* csvRecords(lines: AsyncIterable<string>, delimiter = ','): AsyncGenerator<FeedRow> {
  let header: string[] | null = null;
  let pending = '';
  for await (const raw of lines) {
    const line = pending ? `${pending}\n${raw}` : raw;
    const quotes = (line.match(/"/g) ?? []).length;
    if (quotes % 2 === 1) {
      pending = line;
      continue;
    }
    pending = '';
    if (!line.trim()) continue;
    const cells = parseCsvLine(line, delimiter);
    if (!header) {
      header = cells.map((h) => h.trim().replace(/^\uFEFF/, '').toLowerCase());
      continue;
    }
    const row: FeedRow = {};
    header.forEach((h, idx) => {
      row[h] = cells[idx] ?? '';
    });
    yield row;
  }
}

/** Flattens an Enhanced-feed JSON object (product_basic.* etc.) into a FeedRow. */
export function flattenEnhanced(obj: Record<string, unknown>): FeedRow {
  const row: FeedRow = {};
  const walk = (o: Record<string, unknown>) => {
    for (const [k, v] of Object.entries(o)) {
      if (v && typeof v === 'object' && !Array.isArray(v)) walk(v as Record<string, unknown>);
      else if (Array.isArray(v)) row[k.toLowerCase()] = v.map(String).join('|');
      else if (v !== null && v !== undefined) row[k.toLowerCase()] = String(v);
    }
  };
  walk(obj);
  // Enhanced names → classic names.
  row.product_name ??= row.title ?? '';
  row.merchant_image_url ??= row.image_link ?? '';
  row.search_price ??= row.sale_price ?? row.price ?? '';
  row.aw_product_id ??= row.id ?? '';
  return row;
}

const pick = (row: FeedRow, ...keys: string[]) => {
  for (const k of keys) {
    const v = row[k];
    if (v !== undefined && v.trim() !== '') return v.trim();
  }
  return '';
};

export interface FeedMappingOptions {
  /** Only rows from this advertiser (AliExpress' Awin advertiser id). */
  advertiserId?: string | null;
  currency: string;
}

export function mapFeedRow(row: FeedRow, opts: FeedMappingOptions, nowIso: string): CatalogProduct | null {
  const id = pick(row, 'aw_product_id', 'merchant_product_id');
  const title = cleanText(pick(row, 'product_name'), 300);
  if (!id || !title) return null;
  if (opts.advertiserId && pick(row, 'merchant_id', 'advertiser_id') && pick(row, 'merchant_id', 'advertiser_id') !== opts.advertiserId) {
    return null;
  }
  const currency = (pick(row, 'currency') || opts.currency).toUpperCase();
  const amount = parseAmount(pick(row, 'search_price', 'store_price', 'display_price'));
  const high = parseAmount(pick(row, 'rrp_price', 'base_price'));
  const delivery = pick(row, 'delivery_cost');
  const deliveryAmount = delivery === '' ? null : delivery === '0' || /free|gratis/i.test(delivery) ? 0 : parseAmount(delivery);
  const days = /(\d{1,2})\s*(?:-|a|to)?\s*(\d{1,2})?/.exec(pick(row, 'delivery_time'));
  const affiliateUrl = cleanUrl(pick(row, 'aw_deep_link'));
  const inStock = pick(row, 'in_stock', 'availability', 'is_for_sale');
  const rating = Number(pick(row, 'average_rating', 'rating'));
  const reviews = Number(pick(row, 'reviews', 'number_of_reviews'));

  return {
    provider: 'awin',
    providerProductId: id,
    title,
    description: cleanText(pick(row, 'description', 'product_short_description'), 1200),
    image: cleanImageUrl(pick(row, 'merchant_image_url', 'large_image', 'aw_image_url')),
    images: [pick(row, 'merchant_image_url'), pick(row, 'large_image'), ...pick(row, 'alternate_image', 'additional_image_link').split('|')]
      .map((u) => cleanImageUrl(u))
      .filter((u): u is string => !!u)
      .slice(0, 6),
    price: amount !== null ? { amount, currency } : null,
    priceHigh: null,
    listPrice: high !== null && amount !== null && high > amount ? { amount: high, currency } : null,
    shippingCost: deliveryAmount !== null ? { amount: deliveryAmount, currency } : null,
    deliveryDays: days?.[1] ? { min: Number(days[1]), max: Number(days[2] ?? days[1]) } : null,
    shipsToSpain: null,
    availability: inStock === '1' || /^(yes|true|in stock|instock)$/i.test(inStock) ? 'in_stock' : inStock === '0' || /^(no|false)$/i.test(inStock) ? 'out_of_stock' : mapAvailability(inStock),
    rating: Number.isFinite(rating) && rating > 0 ? { value: rating > 5 ? Math.round((rating / 20) * 10) / 10 : rating, count: Number.isFinite(reviews) && reviews > 0 ? reviews : null } : null,
    orders: null,
    categoryPath: [pick(row, 'category_name'), ...pick(row, 'merchant_category', 'product_type').split(/\s*[>|/]\s*/)].filter(Boolean),
    attributes: Object.fromEntries(
      [
        ['color', pick(row, 'colour', 'color')],
        ['material', pick(row, 'material')],
        ['size', pick(row, 'size', 'dimensions')],
      ].filter(([, v]) => v),
    ),
    variants: [],
    productUrl: cleanUrl(pick(row, 'merchant_deep_link', 'link')),
    affiliateUrl,
    affiliateSource: affiliateUrl ? 'feed' : null,
    gtin: pick(row, 'ean', 'gtin', 'upc').replace(/\D/g, '') || null,
    mpn: cleanText(pick(row, 'mpn', 'product_model', 'model_number'), 40),
    sellerName: cleanText(pick(row, 'merchant_name'), 80),
    priceCheckedAt: nowIso,
    availabilityCheckedAt: nowIso,
    isDemo: false,
  };
}
