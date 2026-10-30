/**
 * Imports an authorised Awin product feed into the Supabase catalogue.
 *
 *   AWIN_FEED_URL=… SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… npx tsx scripts/sync-awin-feed.ts
 *
 * - AWIN_FEED_URL: the download URL copied from Awin → Toolbox → Create-a-Feed
 *   (CSV, optionally gzip) or an Enhanced feed URL (.jsonl, gzip optional).
 * - AWIN_API_TOKEN: only needed when the feed URL requires a bearer token (Enhanced feeds).
 * - AWIN_ALIEXPRESS_ADVERTISER_ID: keep only that advertiser's rows (optional).
 * - FEED_GROUPS: comma list of lexicon groups to keep (default: home & decor groups).
 * - MAX_ROWS: stop after N accepted rows (useful for a first test).
 *
 * Streams the file (no full download in memory), maps rows with the same
 * code the Worker uses, filters to in-stock EUR home products and upserts in
 * batches of 500. Rows not seen for 7 days are marked out of stock.
 * Runs from GitHub Actions on a schedule (.github/workflows/awin-feed-sync.yml).
 */
import { csvRecords, flattenEnhanced, mapFeedRow } from '../src/lib/providers/awin/feed';
import { SupabaseStore } from '../src/lib/data/supabase-store';
import { analyzeProduct } from '../src/lib/matching/analyze';
import { randomId } from '../src/lib/security/crypto';
import type { CatalogProduct } from '../src/types/product';

const env = process.env;
const required = ['AWIN_FEED_URL', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'] as const;
for (const k of required) {
  if (!env[k]) {
    console.error(`Missing ${k}. See docs/AWIN_SETUP.md`);
    process.exit(1);
  }
}

const GROUPS = new Set((env.FEED_GROUPS ?? 'lighting,seating,tables,mirrors,storage,decor,textiles,tableware').split(',').map((s) => s.trim()));
const MAX_ROWS = Number(env.MAX_ROWS ?? Number.POSITIVE_INFINITY);
const store = new SupabaseStore(env.SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!);
const startedAt = new Date().toISOString();
const run = {
  id: randomId(9),
  provider: 'awin' as const,
  kind: 'feed_import' as const,
  status: 'running' as const,
  startedAt,
  finishedAt: null as string | null,
  rowsRead: 0,
  rowsUpserted: 0,
  rowsRejected: 0,
  error: null as string | null,
};

async function* lines(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.pipeThrough(new TextDecoderStream() as unknown as ReadableWritablePair<string, Uint8Array>).getReader();
  let buffer = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;
    let idx: number;
    while ((idx = buffer.indexOf('\n')) >= 0) {
      yield buffer.slice(0, idx).replace(/\r$/, '');
      buffer = buffer.slice(idx + 1);
    }
  }
  if (buffer) yield buffer;
}

function keep(p: CatalogProduct): boolean {
  if (!p.price || p.price.currency !== 'EUR') return false;
  if (p.availability === 'out_of_stock') return false;
  if (!p.image) return false;
  const a = analyzeProduct({ title: p.title, categoryPath: p.categoryPath, attributes: p.attributes });
  return a.groupId !== null && GROUPS.has(a.groupId);
}

async function main() {
  await store.saveSyncRun({ ...run });
  const res = await fetch(env.AWIN_FEED_URL!, {
    headers: env.AWIN_API_TOKEN ? { authorization: `Bearer ${env.AWIN_API_TOKEN}` } : {},
  });
  if (!res.ok || !res.body) throw new Error(`Feed download failed: HTTP ${res.status}`);
  const gz = /gzip/i.test(res.headers.get('content-type') ?? '') || /\.gz(\?|$)|compression\/gzip/i.test(env.AWIN_FEED_URL!);
  const body: ReadableStream<Uint8Array> = gz
    ? res.body.pipeThrough(new DecompressionStream('gzip') as unknown as ReadableWritablePair<Uint8Array, Uint8Array>)
    : res.body;
  const jsonl = /\.jsonl(\.gz)?(\?|$)/i.test(env.AWIN_FEED_URL!);
  const now = new Date().toISOString();

  const rows: AsyncIterable<Record<string, string>> = jsonl
    ? (async function* () {
        for await (const line of lines(body)) if (line.trim()) yield flattenEnhanced(JSON.parse(line) as Record<string, unknown>);
      })()
    : csvRecords(lines(body), env.AWIN_FEED_DELIMITER ?? ',');

  let batch: CatalogProduct[] = [];
  for await (const row of rows) {
    run.rowsRead++;
    const p = mapFeedRow(row, { currency: 'EUR', advertiserId: env.AWIN_ALIEXPRESS_ADVERTISER_ID ?? null }, now);
    if (!p || !keep(p)) {
      run.rowsRejected++;
      continue;
    }
    batch.push(p);
    if (batch.length >= 500) {
      await store.upsertCatalogProducts(batch);
      run.rowsUpserted += batch.length;
      batch = [];
      console.log(`… ${run.rowsUpserted} upserted / ${run.rowsRead} read`);
    }
    if (run.rowsUpserted + batch.length >= MAX_ROWS) break;
  }
  if (batch.length) {
    await store.upsertCatalogProducts(batch);
    run.rowsUpserted += batch.length;
  }

  // Products that disappeared from the feed for a week are no longer offered.
  const staleBefore = new Date(Date.now() - 7 * 86400_000).toISOString();
  await store.db.from('catalog_products').update({ availability: 'out_of_stock' }).eq('provider', 'awin').lt('last_seen_at', staleBefore);
}

main()
  .then(async () => {
    await store.saveSyncRun({ ...run, status: 'success', finishedAt: new Date().toISOString() });
    console.log(`Done: ${run.rowsUpserted} products upserted, ${run.rowsRejected} rejected, ${run.rowsRead} read.`);
  })
  .catch(async (err: Error) => {
    console.error(err.message);
    await store.saveSyncRun({ ...run, status: 'failed', finishedAt: new Date().toISOString(), error: err.message.slice(0, 500) }).catch(() => undefined);
    process.exit(1);
  });
