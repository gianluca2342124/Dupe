import { describe, expect, it, vi } from 'vitest';
import { AliExpressClient, signAliExpress, signatureBaseString } from '../../src/lib/providers/aliexpress/client';
import { AliExpressDirectProvider, mapAliExpressProduct } from '../../src/lib/providers/aliexpress/provider';
import { csvRecords, flattenEnhanced, mapFeedRow, parseCsvLine } from '../../src/lib/providers/awin/feed';
import { AwinAliExpressProvider, buildAwinDeepLink } from '../../src/lib/providers/awin/provider';
import { DemoCatalogProvider } from '../../src/lib/providers/demo/provider';
import { ProviderError } from '../../src/lib/providers/types';

describe('AliExpress signature (official vectors, docId 1385)', () => {
  it('matches the system-interface example', async () => {
    const params = { app_key: '12345678', code: '3_500102_JxZ05Ux3cnnSSUm6dCxYg6Q26', sign_method: 'sha256', timestamp: '1517820392000' };
    expect(signatureBaseString(params, '/auth/token/create')).toBe(
      '/auth/token/createapp_key12345678code3_500102_JxZ05Ux3cnnSSUm6dCxYg6Q26sign_methodsha256timestamp1517820392000',
    );
    expect(await signAliExpress(params, 'helloworld', '/auth/token/create')).toBe('35607762342831B6A417A0DED84B79C05FEFBF116969C48AD6DC00279A9F4D81');
  });

  it('matches the business-interface example string', async () => {
    // The doc's example concatenation (sorted keys incl. `method`).
    const params = {
      access_token: 'test',
      aliexpress_category_id: '200135143',
      app_key: '123456',
      method: 'aliexpress.logistics.redefining.getonlinelogisticsinfo',
      sign_method: 'sha256',
      timestamp: '1517820392000',
    };
    expect(await signAliExpress(params, 'helloworld')).toBe('F7F7926B67316C9D1E8E15F7E66940ED3059B1638C497D77973F30046EFB5BBB');
  });
});

const apiProduct = {
  product_id: 1005001234567890,
  product_title: 'Mushroom Table Lamp Opal Glass Brass Base',
  product_main_image_url: 'https://ae01.alicdn.com/kf/abc.jpg',
  product_small_image_urls: { string: ['https://ae01.alicdn.com/kf/def.jpg'] },
  product_detail_url: 'https://www.aliexpress.com/item/1005001234567890.html',
  promotion_link: 'https://s.click.aliexpress.com/e/_abc123',
  target_sale_price: '27.90',
  target_sale_price_currency: 'EUR',
  target_original_price: '55.80',
  target_original_price_currency: 'EUR',
  evaluate_rate: '96.4%',
  lastest_volume: '312',
  first_level_category_name: 'Lights & Lighting',
  second_level_category_name: 'Table Lamps',
  shop_name: 'Some Store',
  ship_to_days: 'ship to ES in 9 days',
  sku_id: '12000000000001',
  tax_rate: '0.21',
};

describe('AliExpress provider', () => {
  it('maps API products without inventing fields', () => {
    const p = mapAliExpressProduct(apiProduct, '2026-10-30T00:00:00Z')!;
    expect(p.providerProductId).toBe('1005001234567890');
    expect(p.price).toEqual({ amount: 27.9, currency: 'EUR' });
    expect(p.listPrice).toEqual({ amount: 55.8, currency: 'EUR' });
    expect(p.shippingCost).toBeNull(); // unknown until product.shipping.get
    expect(p.deliveryDays).toEqual({ min: null, max: 9 });
    expect(p.rating).toEqual({ value: 4.8, count: null });
    expect(p.orders).toBe(312);
    expect(p.affiliateUrl).toBe('https://s.click.aliexpress.com/e/_abc123');
    expect(p.affiliateSource).toBe('api');
    expect(p.isDemo).toBe(false);
  });

  it('signs requests, sends documented parameters and parses the response envelope', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      const u = new URL(url);
      expect(u.origin + u.pathname).toBe('https://api-sg.aliexpress.com/sync');
      expect(u.searchParams.get('method')).toBe('aliexpress.affiliate.product.query');
      expect(u.searchParams.get('sign_method')).toBe('sha256');
      expect(u.searchParams.get('ship_to_country')).toBe('ES');
      expect(u.searchParams.get('target_currency')).toBe('EUR');
      expect(u.searchParams.get('tracking_id')).toBe('gemelu_es');
      expect(u.searchParams.get('sign')).toMatch(/^[0-9A-F]{64}$/);
      const params = Object.fromEntries(u.searchParams);
      const expected = await signAliExpress(params, 'secret');
      expect(params.sign).toBe(expected);
      return Response.json({
        aliexpress_affiliate_product_query_response: { resp_result: { resp_code: 200, resp_msg: 'success', result: { products: { product: [apiProduct] } } } },
      });
    });
    const client = new AliExpressClient({ appKey: 'key', appSecret: 'secret', trackingId: 'gemelu_es' }, fetchMock as unknown as typeof fetch, { timeoutMs: 1000, now: () => 1700000000000 });
    const provider = new AliExpressDirectProvider(client, { language: 'ES', currency: 'EUR', shipTo: 'ES', usePriceFilter: false, shippingLookups: 0 });
    const results = await provider.searchByText({ text: 'mushroom table lamp', lang: 'en', limit: 20, shipTo: 'ES', currency: 'EUR' });
    expect(results).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('turns API error envelopes into typed errors and refuses to run unconfigured', async () => {
    const client = new AliExpressClient(
      { appKey: 'key', appSecret: 'secret', trackingId: null },
      (async () => Response.json({ error_response: { code: 'IncompleteSignature', msg: 'The request signature does not conform' } })) as unknown as typeof fetch,
      { timeoutMs: 1000 },
    );
    await expect(client.call('aliexpress.affiliate.product.query', {})).rejects.toMatchObject({ code: 'auth' });
    const unconfigured = new AliExpressClient({ appKey: '', appSecret: '', trackingId: null });
    await expect(unconfigured.call('x', {})).rejects.toBeInstanceOf(ProviderError);
  });

  it('generates official links only through link.generate and never fabricates them', async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({
        aliexpress_affiliate_link_generate_response: {
          resp_result: { resp_code: 200, result: { promotion_links: { promotion_link: [{ source_value: 'https://www.aliexpress.com/item/1.html', promotion_link: 'https://s.click.aliexpress.com/e/_x' }] } } },
        },
      }),
    );
    const client = new AliExpressClient({ appKey: 'k', appSecret: 's', trackingId: 'tid' }, fetchMock as unknown as typeof fetch, { timeoutMs: 1000 });
    const provider = new AliExpressDirectProvider(client, { language: 'ES', currency: 'EUR', shipTo: 'ES', usePriceFilter: false, shippingLookups: 0 });
    const p1 = { ...mapAliExpressProduct({ ...apiProduct, product_id: 1, promotion_link: undefined, product_detail_url: 'https://www.aliexpress.com/item/1.html' }, 'now')! };
    const p2 = { ...mapAliExpressProduct({ ...apiProduct, product_id: 2, promotion_link: undefined, product_detail_url: 'https://www.aliexpress.com/item/2.html' }, 'now')! };
    const links = await provider.generateAffiliateLinks([p1, p2]);
    expect(links.get('1')).toBe('https://s.click.aliexpress.com/e/_x');
    expect(links.has('2')).toBe(false);

    const noTracking = new AliExpressDirectProvider(new AliExpressClient({ appKey: 'k', appSecret: 's', trackingId: null }, fetchMock as unknown as typeof fetch), {
      language: 'ES', currency: 'EUR', shipTo: 'ES', usePriceFilter: false, shippingLookups: 0,
    });
    expect((await noTracking.generateAffiliateLinks([p1])).size).toBe(0);
  });
});

describe('Awin feeds', () => {
  it('parses CSV with quotes, delimiters and quoted newlines', async () => {
    expect(parseCsvLine('a,"b,c","d ""e"""')).toEqual(['a', 'b,c', 'd "e"']);
    async function* lines() {
      yield 'aw_product_id,product_name,search_price,currency,aw_deep_link,merchant_image_url,in_stock,delivery_cost,ean,merchant_category';
      yield '1,"Rattan Pendant Light';
      yield 'Natural",34.90,EUR,https://www.awin1.com/pclick.php?p=1&a=2,https://img.example/1.jpg,1,0,8412345678905,Home > Lighting';
    }
    const rows = [];
    for await (const r of csvRecords(lines())) rows.push(r);
    expect(rows).toHaveLength(1);
    const p = mapFeedRow(rows[0]!, { currency: 'EUR' }, '2026-10-30T00:00:00Z')!;
    expect(p.title).toBe('Rattan Pendant Light Natural');
    expect(p.price).toEqual({ amount: 34.9, currency: 'EUR' });
    expect(p.shippingCost).toEqual({ amount: 0, currency: 'EUR' });
    expect(p.affiliateUrl).toBe('https://www.awin1.com/pclick.php?p=1&a=2');
    expect(p.affiliateSource).toBe('feed');
    expect(p.availability).toBe('in_stock');
    expect(p.gtin).toBe('8412345678905');
    expect(p.categoryPath).toEqual(['Home', 'Lighting']);
  });

  it('maps Enhanced (JSONL) feed objects', () => {
    const row = flattenEnhanced({ id: '9', title: 'Wicker basket', sale_price: '12.99', currency: 'EUR', product_basic: { aw_deep_link: 'https://www.awin1.com/cread.php?x=1' }, image_link: 'https://img/9.jpg' });
    const p = mapFeedRow(row, { currency: 'EUR' }, 'now')!;
    expect(p.providerProductId).toBe('9');
    expect(p.affiliateUrl).toBe('https://www.awin1.com/cread.php?x=1');
  });

  it('filters by advertiser and builds documented cread.php deep links', async () => {
    expect(mapFeedRow({ aw_product_id: '1', product_name: 'X', merchant_id: '999' }, { currency: 'EUR', advertiserId: '123' }, 'now')).toBeNull();
    const link = buildAwinDeepLink({ advertiserId: '123', publisherId: '456', destination: 'https://es.aliexpress.com/item/1.html' });
    expect(link).toBe('https://www.awin1.com/cread.php?awinmid=123&awinaffid=456&ued=https%3A%2F%2Fes.aliexpress.com%2Fitem%2F1.html');
    const provider = new AwinAliExpressProvider(null, { publisherId: '456', advertiserId: '123', deepLinkEnabled: false });
    await expect(provider.searchByText({ text: 'x', lang: 'en', limit: 5, shipTo: 'ES', currency: 'EUR' })).rejects.toMatchObject({ code: 'not_configured' });
  });
});

describe('demo provider', () => {
  it('is clearly flagged and has no real links', async () => {
    const results = await new DemoCatalogProvider().searchByText({ text: 'lámpara de mesa seta vidrio', lang: 'es', limit: 10, shipTo: 'ES', currency: 'EUR' });
    expect(results.length).toBeGreaterThan(3);
    for (const r of results) {
      expect(r.isDemo).toBe(true);
      expect(r.productUrl).toBeNull();
      expect(r.affiliateUrl).toBeNull();
      expect(r.image).toMatch(/^\/demo-img\//);
    }
  });
});
