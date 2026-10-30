/**
 * Verifies AliExpress Open Platform credentials with one real, read-only call.
 *
 *   ALIEXPRESS_APP_KEY=… ALIEXPRESS_APP_SECRET=… ALIEXPRESS_TRACKING_ID=… npx tsx scripts/aliexpress-smoke.ts "mushroom table lamp"
 *
 * Prints how many products came back, whether they carry promotion links
 * (i.e. the tracking id is accepted) and the first result. Never prints secrets.
 */
import { AliExpressClient } from '../src/lib/providers/aliexpress/client';
import { AliExpressDirectProvider } from '../src/lib/providers/aliexpress/provider';

const { ALIEXPRESS_APP_KEY, ALIEXPRESS_APP_SECRET, ALIEXPRESS_TRACKING_ID } = process.env;
if (!ALIEXPRESS_APP_KEY || !ALIEXPRESS_APP_SECRET) {
  console.error('Set ALIEXPRESS_APP_KEY and ALIEXPRESS_APP_SECRET (see docs/ALIEXPRESS_SETUP.md).');
  process.exit(1);
}
const keywords = process.argv[2] ?? 'mushroom table lamp';
const client = new AliExpressClient({ appKey: ALIEXPRESS_APP_KEY, appSecret: ALIEXPRESS_APP_SECRET, trackingId: ALIEXPRESS_TRACKING_ID ?? null }, fetch, { timeoutMs: 15_000 });
const provider = new AliExpressDirectProvider(client, { language: 'ES', currency: 'EUR', shipTo: 'ES', usePriceFilter: false, shippingLookups: 1 });

try {
  const results = await provider.searchByText({ text: keywords, lang: 'en', limit: 10, shipTo: 'ES', currency: 'EUR' });
  console.log(`product.query "${keywords}": ${results.length} products`);
  console.log(`with promotion_link: ${results.filter((r) => r.affiliateUrl).length}`);
  if (results[0]) {
    await provider.enrichShipping(results.slice(0, 1));
    const r = results[0];
    console.log({ id: r.providerProductId, title: r.title, price: r.price, shipping: r.shippingCost, delivery: r.deliveryDays, affiliate: !!r.affiliateUrl });
  }
  if (!ALIEXPRESS_TRACKING_ID) console.warn('No ALIEXPRESS_TRACKING_ID: links will not carry affiliate tracking.');
} catch (err) {
  console.error(`AliExpress call failed: ${(err as Error).message}`);
  process.exit(1);
}
