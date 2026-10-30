import { describe, expect, it, vi } from 'vitest';
import { createGoToken, isAllowedDestination, verifyGoToken } from '../../src/lib/affiliate/go-token';
import { AffiliateLinkService, MemoryLinkCache } from '../../src/lib/affiliate/links';
import { ResultCache } from '../../src/lib/data/cache';
import { MemoryStore } from '../../src/lib/data/memory-store';
import { demoItemToProduct } from '../../src/lib/providers/demo/provider';
import { DEMO_ITEMS } from '../../src/lib/providers/demo/catalog';
import type { AffiliateProductProvider } from '../../src/lib/providers/types';
import type { CatalogProduct } from '../../src/types/product';
import type { SearchResultPayload } from '../../src/types/search';

const SECRET = 'unit-test-secret';
const base = { p: 'aliexpress' as const, i: '123', a: 1 as const, s: 'search1', r: 1, t: 'vs' as const };

describe('/go/ tokens', () => {
  it('round-trips signed payloads', async () => {
    const token = await createGoToken({ ...base, u: 'https://s.click.aliexpress.com/e/_abc' }, SECRET);
    const v = await verifyGoToken(token, SECRET);
    expect(v.ok && v.payload.u).toBe('https://s.click.aliexpress.com/e/_abc');
  });

  it('rejects tampered payloads, wrong secrets and expired tokens', async () => {
    const token = await createGoToken({ ...base, u: 'https://s.click.aliexpress.com/e/_abc' }, SECRET);
    const [body, sig] = token.split('.');
    const forgedBody = btoa(JSON.stringify({ v: 1, ...base, u: 'https://evil.example/phish', ts: Math.floor(Date.now() / 1000) }))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    expect((await verifyGoToken(`${forgedBody}.${sig}`, SECRET)).ok).toBe(false);
    expect((await verifyGoToken(`${body}.${sig}x`, SECRET)).ok).toBe(false);
    expect((await verifyGoToken(token, 'other-secret')).ok).toBe(false);
    const old = await createGoToken({ ...base, u: null }, SECRET, Date.now() - 200 * 86400_000);
    expect(await verifyGoToken(old, SECRET)).toEqual({ ok: false, reason: 'expired' });
    expect((await verifyGoToken('garbage', SECRET)).ok).toBe(false);
  });

  it('never redirects outside the merchant/affiliate allow-list, even with a valid signature', async () => {
    const token = await createGoToken({ ...base, u: 'https://evil.example/phish' }, SECRET);
    expect(await verifyGoToken(token, SECRET)).toEqual({ ok: false, reason: 'destination_not_allowed' });
    expect(isAllowedDestination('https://www.awin1.com/cread.php?x=1')).toBe(true);
    expect(isAllowedDestination('https://aliexpress.com.evil.example/')).toBe(false);
    expect(isAllowedDestination('javascript:alert(1)')).toBe(false);
    expect(isAllowedDestination('https://user:pw@s.click.aliexpress.com/')).toBe(false);
  });
});

describe('affiliate link resolution', () => {
  const real = (id: string, over: Partial<CatalogProduct> = {}): CatalogProduct => ({
    ...demoItemToProduct(DEMO_ITEMS[0]!, 'now'),
    provider: 'aliexpress',
    providerProductId: id,
    isDemo: false,
    productUrl: `https://www.aliexpress.com/item/${id}.html`,
    affiliateUrl: null,
    affiliateSource: null,
    ...over,
  });
  const provider = (links: Record<string, string>): AffiliateProductProvider => ({
    id: 'aliexpress',
    label: 'AliExpress',
    capabilities: { textSearch: true, imageSearch: false, productDetails: false, affiliateLinks: true, isDemo: false },
    searchByText: async () => [],
    generateAffiliateLinks: vi.fn(async (ps: CatalogProduct[]) => new Map(ps.filter((p) => links[p.providerProductId]).map((p) => [p.providerProductId, links[p.providerProductId]!]))),
    healthCheck: async () => ({ ok: true, configured: true, message: '' }),
  });

  it('prefers provider links, generates missing ones, and falls back to plain links without faking tracking', async () => {
    const svc = new AffiliateLinkService(new MemoryLinkCache());
    const prov = provider({ b: 'https://s.click.aliexpress.com/e/_b' });
    const products = [real('a', { affiliateUrl: 'https://s.click.aliexpress.com/e/_a', affiliateSource: 'api' }), real('b'), real('c')];
    const out = await svc.resolve(products, prov);
    expect(out.get('a')).toEqual({ destination: 'https://s.click.aliexpress.com/e/_a', isAffiliate: true, source: 'api' });
    expect(out.get('b')).toEqual({ destination: 'https://s.click.aliexpress.com/e/_b', isAffiliate: true, source: 'api' });
    expect(out.get('c')).toEqual({ destination: 'https://www.aliexpress.com/item/c.html', isAffiliate: false, source: 'plain' });
    // Generated links are cached: a second resolve doesn't call the API for "b".
    await svc.resolve([real('b')], prov);
    expect(prov.generateAffiliateLinks).toHaveBeenCalledTimes(1);
  });

  it('gives demo products no destination', async () => {
    const out = await new AffiliateLinkService(new MemoryLinkCache()).resolve([demoItemToProduct(DEMO_ITEMS[0]!, 'now')], provider({}));
    expect(out.get('demo-lamp-01')).toEqual({ destination: null, isAffiliate: false, source: 'demo' });
  });
});

describe('result cache', () => {
  const payload = { id: 'x', items: [] } as unknown as SearchResultPayload;

  it('runs concurrent identical searches only once (in-flight dedupe)', async () => {
    const cache = new ResultCache(null, null, { memorySeconds: 60, kvSeconds: 60, storeSeconds: 60 });
    let calls = 0;
    const compute = async () => {
      calls++;
      await new Promise((r) => setTimeout(r, 20));
      return payload;
    };
    const results = await Promise.all([cache.dedupe('k', compute), cache.dedupe('k', compute), cache.dedupe('k', compute)]);
    expect(calls).toBe(1);
    expect(results.every((r) => r === payload)).toBe(true);
    expect(cache.inflightCount).toBe(0);
  });

  it('reads through memory → KV → store layers', async () => {
    const kvData = new Map<string, string>();
    const kv = {
      get: async (k: string) => (kvData.has(k) ? JSON.parse(kvData.get(k)!) : null),
      put: async (k: string, v: string) => void kvData.set(k, v),
    };
    const store = new MemoryStore();
    const writer = new ResultCache(kv, store, { memorySeconds: 60, kvSeconds: 60, storeSeconds: 60 });
    await writer.set('k1', payload);
    // A fresh isolate (empty memory) finds it in KV.
    const reader = new ResultCache(kv, store, { memorySeconds: 60, kvSeconds: 60, storeSeconds: 60 });
    expect((await reader.get('k1'))?.layer).toBe('kv');
    expect((await reader.get('k1'))?.layer).toBe('memory');
    // Without KV, the persistent store answers.
    const storeOnly = new ResultCache(null, store, { memorySeconds: 60, kvSeconds: 60, storeSeconds: 60 });
    expect((await storeOnly.get('k1'))?.layer).toBe('store');
    expect(await storeOnly.get('missing')).toBeNull();
  });
});
