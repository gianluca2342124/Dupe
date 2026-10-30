import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';
import { unaccent } from '@electric-sql/pglite/contrib/unaccent';

/**
 * Applies every Supabase migration to an in-process Postgres (PGlite) and
 * exercises the SQL functions. pgvector isn't bundled with PGlite, so the
 * `vector` column is swapped for `real[]` in this test only.
 */
const dir = join(import.meta.dirname, '../../supabase/migrations');
let db: PGlite;

beforeAll(async () => {
  db = new PGlite({ extensions: { pg_trgm, unaccent } });
  await db.exec(`create schema extensions; create role anon; create role authenticated; create role service_role;`);
  for (const file of readdirSync(dir).sort()) {
    const sql = readFileSync(join(dir, file), 'utf8')
      .replace(/create extension if not exists vector with schema extensions;/, '')
      .replace(/extensions\.vector\(512\)/g, 'real[]');
    await db.exec(sql);
  }
}, 60_000);

afterAll(async () => db?.close());

describe('database schema', () => {
  it('enables RLS on every table', async () => {
    const { rows } = await db.query<{ relname: string; relrowsecurity: boolean }>(
      `select c.relname, c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r'`,
    );
    expect(rows.length).toBeGreaterThanOrEqual(13);
    for (const r of rows) expect(r.relrowsecurity, r.relname).toBe(true);
  });

  it('searches the catalogue with OR semantics, accents ignored, out-of-stock excluded', async () => {
    await db.exec(`insert into public.catalog_products (provider, provider_product_id, title, category_path, price, currency, availability) values
      ('awin','1','Mushroom Table Lamp Opal Glass Brass','{Home,Lighting}',27.9,'EUR','in_stock'),
      ('awin','2','Rattan Pendant Light Natural','{Home,Lighting}',34.9,'EUR','in_stock'),
      ('awin','3','Lámpara de mesa cerámica','{Hogar}',19.9,'EUR','in_stock'),
      ('awin','4','Lámpara de mesa agotada','{Hogar}',9.9,'EUR','out_of_stock')`);
    const q = async (text: string, max: number | null = null) =>
      (await db.query<{ provider_product_id: string }>(`select provider_product_id from public.search_catalog($1, 'awin', $2, 10)`, [text, max])).rows.map(
        (r) => r.provider_product_id,
      );
    expect((await q('mushroom glass table lamp'))[0]).toBe('1');
    expect(await q('lampara mesa')).toEqual(['3']);
    expect(await q('pendant light', 20)).toEqual([]);
    expect(await q('   ')).toEqual([]);
  });

  it('increments usage counters atomically', async () => {
    await db.query(`select public.increment_usage(current_date, 'searches', 1)`);
    const { rows } = await db.query<{ v: number }>(`select public.increment_usage(current_date, 'searches', 2) as v`);
    expect(rows[0]!.v).toBe(3);
  });

  it('purges expired data per retention policy', async () => {
    await db.exec(`insert into public.search_results (cache_key, payload, expires_at) values ('old', '{}', now() - interval '1 day'), ('new', '{}', now() + interval '1 day');
      insert into public.search_events (type, at) values ('pageview', now() - interval '14 months'), ('pageview', now());`);
    const { rows } = await db.query<{ n: number }>(`select public.purge_expired_data() as n`);
    expect(rows[0]!.n).toBe(2);
    expect((await db.query(`select cache_key from public.search_results`)).rows).toEqual([{ cache_key: 'new' }]);
  });
});
