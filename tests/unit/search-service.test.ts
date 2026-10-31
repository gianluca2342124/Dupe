import { beforeEach, describe, expect, it } from 'vitest';
import { getServices, resetServices } from '../../src/lib/server/services';
import { verifyGoToken } from '../../src/lib/affiliate/go-token';
import { exampleSource } from '../../src/lib/search/examples';
import type { SearchError } from '../../src/lib/search/service';
import type { SearchEvent } from '../../src/types/search';

const SECRETS = {
  LINK_SIGNING_SECRET: 'svc-test-link-secret-123',
  ADMIN_PASSWORD: 'svc-test-admin-password',
  ALIEXPRESS_APP_SECRET: 'svc-test-ae-secret-value',
};
const env = { FETCH_MODE: 'fixtures', PRODUCT_PROVIDER: 'demo', ...SECRETS };
const IKEA = 'https://www.ikea.com/es/es/p/fixture-lampara-mesa-vidrio-opalo-00000001/?utm_source=tiktok';

describe('SearchService (fixtures + demo provider)', () => {
  beforeEach(() => resetServices());

  it('runs the full pipeline, emitting real stages in order', async () => {
    const { search } = getServices(env);
    const events: SearchEvent[] = [];
    const result = await search.searchUrl(IKEA, { entryMode: 'prefix' }, (e) => events.push(e));
    const stages = events.filter((e) => e.type === 'stage').map((e) => (e as { stage: string }).stage);
    expect(stages).toEqual(['validating', 'reading', 'analyzing', 'searching', 'comparing', 'done']);
    expect(events.some((e) => e.type === 'source')).toBe(true);
    expect(result.status).toBe('results');
    expect(result.source.title).toContain('FIXTURE Lámpara de mesa');
    expect(result.items.length).toBeGreaterThanOrEqual(3);
    expect(result.provider.isDemo).toBe(true);
    // Fictional prices are never compared with a real store price.
    expect(result.items.every((i) => i.savings === null)).toBe(true);
    expect(result.summary.maxSavings).toBeNull();
    expect(result.notices.map((n) => n.kind)).toContain('demo');
    // Outbound links are signed internal redirects, never raw third-party URLs.
    for (const item of result.items) {
      expect(item.goUrl).toMatch(/^\/go\/[\w-]+\.[\w-]+$/);
      const v = await verifyGoToken(item.goUrl.slice(4), SECRETS.LINK_SIGNING_SECRET);
      expect(v.ok && v.payload.u).toBeNull();
    }
  });

  it('serves repeated searches from cache (tracking parameters ignored)', async () => {
    const { search } = getServices(env);
    const first = await search.searchUrl(IKEA, { entryMode: 'form' }, () => {});
    const second = await search.searchUrl(IKEA.replace('utm_source=tiktok', 'fbclid=abc'), { entryMode: 'share' }, () => {});
    expect(first.cache.hit).toBe(false);
    expect(second.cache.hit).toBe(true);
    expect(second.id).toBe(first.id);
    expect(await search.cached(IKEA)).not.toBeNull();
  });

  it('shows savings for the fictional example source (demo vs demo)', async () => {
    const { search } = getServices(env);
    const r = await search.searchExample(exampleSource('lampara-seta')!, { entryMode: 'example' }, () => {});
    expect(r.items[0]!.savings?.percent).toBeGreaterThan(50);
    expect(r.summary.maxSavings).not.toBeNull();
  });

  it('continues honestly in url-only mode when the store blocks reading', async () => {
    const { search } = getServices(env);
    const r = await search.searchUrl('https://www.zarahome.com/es/fixture-jarron-ceramica-texturizada-l00000006', { entryMode: 'prefix' }, () => {});
    expect(r.source.readMode).toBe('url-only');
    expect(r.source.price).toBeNull();
    expect(r.notices.map((n) => n.kind)).toContain('url_only');
    expect(r.source.readIssue).toMatchObject({ reason: 'blocked', block: 'akamai' });
    expect(r.notices.find((n) => n.kind === 'url_only')?.message).toBe(
      'Zara Home no deja que programas automáticos como Gemelu lean sus fichas (responde con la protección antibots de Akamai). No intentamos saltarnos ese bloqueo. Hemos buscado por el nombre que aparece en el enlace («Fixture jarron ceramica texturizada»), sin foto ni precio del original.',
    );
    expect(r.items.length).toBeGreaterThan(0);
  });

  it('maps failures to clear error codes without breaking', async () => {
    const { search } = getServices(env);
    const code = async (url: string) => {
      try {
        await search.searchUrl(url, { entryMode: 'form' }, () => {});
        return 'ok';
      } catch (e) {
        return (e as SearchError).code;
      }
    };
    expect(await code('https://www.amazon.es/dp/B0FIXTURE1')).toBe('store_blocked');
    expect(await code('https://www.ikea.com/es/es/cat/lamparas-de-mesa-10732/')).toBe('not_a_product');
    expect(await code('not a url')).toBe('invalid_url');
    expect(await code('http://127.0.0.1:8080/admin')).toBe('invalid_url');
    expect(await code('http://169.254.169.254/latest/meta-data/')).toBe('blocked_host');
    expect(await code('https://gemelu.com/https://www.ikea.com/x')).toBe('own_domain');
  });

  it('supports describing the product as text', async () => {
    const { search } = getServices(env);
    const r = await search.searchText('lámpara de mesa seta de cristal blanco', { entryMode: 'form' }, () => {});
    expect(r.source.readMode).toBe('text');
    expect(r.items.length).toBeGreaterThan(0);
    await expect(search.searchText('ab', { entryMode: 'form' }, () => {})).rejects.toMatchObject({ code: 'invalid_query' });
  });

  it('enforces the daily budget for uncached searches', async () => {
    const { search } = getServices({ ...env, DAILY_SEARCH_BUDGET: '1' });
    await search.searchUrl('https://www.sklum.com/es/000003-fixture-espejo-redondo-ratan.html', { entryMode: 'form' }, () => {});
    await expect(
      search.searchUrl('https://www.westwing.es/fixture-sillon-boucle-crema-000002.html', { entryMode: 'form' }, () => {}),
    ).rejects.toMatchObject({ code: 'budget_exceeded' });
  });

  it('never puts secrets into payloads sent to the browser', async () => {
    const { search } = getServices(env);
    const r = await search.searchUrl(IKEA, { entryMode: 'form' }, () => {});
    const json = JSON.stringify(r);
    for (const secret of Object.values(SECRETS)) expect(json).not.toContain(secret);
  });

  it('records analytics without personal data', async () => {
    const { search, store } = getServices(env);
    await search.searchUrl(IKEA, { entryMode: 'prefix', deviceClass: 'mobile', country: 'ES' }, () => {});
    const m = await store.getMetrics(new Date(Date.now() - 60_000).toISOString(), new Date(Date.now() + 60_000).toISOString());
    expect(m.searches).toBe(1);
    expect(m.topDomains[0]).toEqual({ domain: 'ikea.com', count: 1 });
    expect(m.commissions).toBeNull();
  });
});
