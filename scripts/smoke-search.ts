/**
 * Runs the full search pipeline locally (no Worker) and prints the results.
 *   npx tsx scripts/smoke-search.ts <url> [--fixtures]
 * Uses the DEMO provider unless PRODUCT_PROVIDER is set in the environment.
 */
import { getServices } from '../src/lib/server/services';

const args = process.argv.slice(2);
const url = args.find((a) => !a.startsWith('--')) ?? 'https://www.ikea.com/es/es/p/fixture-lampara-mesa-vidrio-opalo-00000001/';
const env: Record<string, unknown> = { ...process.env, FETCH_MODE: args.includes('--fixtures') ? 'fixtures' : (process.env.FETCH_MODE ?? 'live') };
const { search } = getServices(env);

const result = await search.searchUrl(url, { entryMode: 'direct' }, (e) => {
  if (e.type === 'stage') console.log(`· ${e.stage}${e.detail ? ` (${e.detail})` : ''}`);
});
console.log('\nSOURCE:', result.source.title, '|', result.source.price, '|', result.source.readMode, result.source.confidence, result.source.highlights);
console.log('STATUS:', result.status, 'provider', result.provider.id, 'stats', JSON.stringify(result.stats));
for (const n of result.notices) console.log('NOTICE:', n.kind, '-', n.message);
for (const i of result.items) {
  console.log(`  [${i.tier}] ${i.shortTitle} — ${i.price?.amount} ${i.price?.currency}${i.priceIsFrom ? ' (desde)' : ''} savings=${i.savings ? `${i.savings.amount.amount}€/${i.savings.percent}% ${i.savings.basis}` : '-'} labels=${i.labels.join(',')} caveats=${i.caveats.join(',')}`);
}
for (const i of result.lowConfidenceItems) console.log(`  (low) ${i.shortTitle}`);
console.log('timings', result.timingsMs);
