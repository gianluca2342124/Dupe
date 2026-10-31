import { describe, expect, it } from 'vitest';
import { FixturePageFetcher, LivePageFetcher } from '../../src/lib/extraction/fetchers';
import { FIXTURE_PAGES } from '../../src/lib/extraction/fixtures';
import { ProductExtractionService } from '../../src/lib/extraction/service';
import { parseAmount, parsePrice } from '../../src/lib/extraction/price';
import { parseDimensionsFromText, parseQuantitativeValue } from '../../src/lib/extraction/dimensions';
import { scanHtml } from '../../src/lib/extraction/scanner';
import { detectBlock } from '../../src/lib/extraction/challenge';
import { nameFromUrl } from '../../src/lib/extraction/url-slug';
import { normalizeProductUrl } from '../../src/lib/url/normalize';
import type { HostPolicyConfig } from '../../src/lib/security/host-policy';
import { createSafeFetcher } from '../../src/lib/security/safe-fetch';
import { RobotsChecker } from '../../src/lib/security/robots';

const policy: HostPolicyConfig = { mode: 'public', allowlist: [], denylist: [], ownHosts: ['gemelu.com'] };
const service = new ProductExtractionService({ fetcher: new FixturePageFetcher(FIXTURE_PAGES), robots: null, headless: null, headlessHosts: [] });
const normalized = (url: string) => {
  const n = normalizeProductUrl(url, policy);
  if (!n.ok) throw new Error(n.error);
  return n.value;
};
const extract = async (url: string) => service.extract(normalized(url));

describe('ProductExtractionService on fixtures', () => {
  it('reads schema.org JSON-LD (IKEA-like page, JSON-LD at the end of a large body)', async () => {
    const r = await extract('https://www.ikea.com/es/es/p/fixture-lampara-mesa-vidrio-opalo-00000001/');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const p = r.product;
    expect(p.title).toBe('FIXTURE Lámpara de mesa - blanco ópalo vidrio/chapado en latón 39 cm');
    expect(p.price).toEqual({ amount: 39.99, currency: 'EUR' });
    expect(p.availability).toBe('in_stock');
    expect(p.brand).toBe('IKEA');
    expect(p.color).toBe('blanco');
    expect(p.material).toBe('Metal, Vidrio');
    expect(p.dimensions).toMatchObject({ heightCm: 39, depthCm: 30 });
    expect(p.breadcrumbs).toEqual(['Iluminación', 'Lámparas de mesa']);
    expect(p.fieldSources.price).toBe('json-ld');
    expect(p.confidence).toBe('high');
    expect(p.readMode).toBe('page');
    // Personal data in reviews is never extracted.
    expect(JSON.stringify(p)).not.toContain('Persona Ficticia');
  });

  it('reads @graph JSON-LD and og:image:url (Westwing-like)', async () => {
    const r = await extract('https://www.westwing.es/fixture-sillon-boucle-crema-000002.html');
    expect(r.ok && r.product.price).toEqual({ amount: 449, currency: 'EUR' });
    expect(r.ok && r.product.title).toBe('Sillón con reposabrazos en tejido bouclé Fixture');
    expect(r.ok && r.product.image).toBe('https://cdn.example-cdn.com/fixture-sillon-boucle.jpg');
  });

  it('falls back to microdata', async () => {
    const r = await extract('https://www.sklum.com/es/000003-fixture-espejo-redondo-ratan.html');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.product.price).toEqual({ amount: 89.95, currency: 'EUR' });
    expect(r.product.fieldSources.price).toBe('microdata');
    expect(r.product.dimensions?.diameterCm).toBe(60);
  });

  it('falls back to Open Graph product tags (European decimal comma)', async () => {
    const r = await extract('https://www.decoracion-ejemplo.es/producto/jarron-ceramica-estriado');
    expect(r.ok && r.product.price).toEqual({ amount: 29.9, currency: 'EUR' });
    expect(r.ok && r.product.fieldSources.price).toBe('open-graph');
    expect(r.ok && r.product.confidence).toBe('medium');
  });

  it('handles incomplete pages without inventing data', async () => {
    const r = await extract('https://www.tienda-incompleta.es/p/mesa-centro-roble-redonda-80');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.product.price).toBeNull();
    expect(r.product.availability).toBe('unknown');
    expect(r.product.image).toBe('https://cdn.example-cdn.com/fixture-mesa.jpg');
    expect(r.product.confidence).toBe('medium');
  });

  it('reads AggregateOffer price ranges', async () => {
    const r = await extract('https://www.decoracion-ejemplo.es/producto/funda-cojin-lino');
    expect(r.ok && r.product.price?.amount).toBe(19.9);
    expect(r.ok && r.product.priceHigh?.amount).toBe(29.9);
  });

  it('detects bot walls and returns an honest URL-only fallback', async () => {
    const r = await extract('https://www.zarahome.com/es/fixture-jarron-ceramica-texturizada-l00000006');
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toBe('blocked');
    expect(r.blockKind).toBe('akamai');
    expect(r.fallback?.readMode).toBe('url-only');
    expect(r.fallback?.title).toBe('Fixture jarron ceramica texturizada');
    expect(r.fallback?.price).toBeNull();
  });

  it('reports CAPTCHAs, rate limits and non-product pages', async () => {
    const amazon = await extract('https://www.amazon.es/dp/B0FIXTURE1');
    expect(!amazon.ok && amazon.reason).toBe('blocked');
    expect(!amazon.ok && amazon.fallback).toBeNull();
    const kave = await extract('https://kavehome.com/es/es/p/fixture-silla-comedor-ratan-natural');
    expect(!kave.ok && kave.reason).toBe('blocked');
    const cat = await extract('https://www.ikea.com/es/es/cat/lamparas-de-mesa-10732/');
    expect(!cat.ok && cat.reason).toBe('not_product');
  });

  it('treats unknown pages as HTTP errors', async () => {
    const r = await extract('https://www.tienda-incompleta.es/p/no-existe-123');
    expect(!r.ok && r.reason).toBe('http_error');
  });
});

describe('parsers', () => {
  it('parses European and US price formats', () => {
    expect(parseAmount('1.299,00 €')).toBe(1299);
    expect(parseAmount('1,299.00')).toBe(1299);
    expect(parseAmount('39,99')).toBe(39.99);
    expect(parseAmount('39.99')).toBe(39.99);
    expect(parseAmount('1.299')).toBe(1299);
    expect(parseAmount('desde 12,50 €')).toBe(12.5);
    expect(parseAmount('gratis')).toBeNull();
    expect(parsePrice('89,95 €')).toEqual({ amount: 89.95, currency: 'EUR' });
    expect(parsePrice('89,95')).toBeNull(); // no currency → unknown, never assumed
    expect(parsePrice('89,95', 'eur')).toEqual({ amount: 89.95, currency: 'EUR' });
  });

  it('parses dimensions in Spanish and English', () => {
    expect(parseDimensionsFromText('Espejo redondo Ø 60 cm')).toMatchObject({ diameterCm: 60 });
    expect(parseDimensionsFromText('Alto: 45 cm. Ancho 30 cm')).toMatchObject({ heightCm: 45, widthCm: 30 });
    expect(parseDimensionsFromText('Mesa 120 x 60 x 75 cm')).toMatchObject({ widthCm: 120, depthCm: 60, heightCm: 75 });
    expect(parseDimensionsFromText('lámpara de 1,2 m de alto')).toMatchObject({ heightCm: 120 });
    expect(parseDimensionsFromText('Height 350 mm')).toMatchObject({ heightCm: 35 });
    expect(parseDimensionsFromText('sin medidas')).toBeNull();
    expect(parseQuantitativeValue({ value: 30, unitCode: 'CMT' })).toBe(30);
    expect(parseQuantitativeValue('39 cm')).toBe(39);
  });

  it('scans meta tags with quoted ">" and lenient JSON-LD', () => {
    const scan = scanHtml(`<html><head><meta property="og:title" content="A > B"><script type="application/ld+json">{"@type":"Product","name":"X",}</script></head></html>`);
    expect(scan.meta.get('og:title')).toEqual(['A > B']);
    expect(scan.jsonLd).toHaveLength(1);
  });

  it('detects common bot-protection signatures', () => {
    expect(detectBlock(403, '<title>Just a moment...</title><div id="cf-chl-widget"></div>')).toBe('cloudflare');
    expect(detectBlock(200, "<script>var dd={'rt':'c'}</script>")).toBe('datadome');
    expect(detectBlock(200, '<html><body>normal page</body></html>')).toBeNull();
  });

  it('derives names from product URL slugs', () => {
    expect(nameFromUrl('https://www.zarahome.com/es/jarron-ceramica-texturizada-l42345678')).toBe('Jarron ceramica texturizada');
    expect(nameFromUrl('https://www.ikea.com/es/es/p/akterspring-lampara-mesa-blanco-00586548/')).toBe('Akterspring lampara mesa blanco');
    expect(nameFromUrl('https://www.amazon.es/dp/B0ABC12345')).toBeNull();
  });
});

describe('ProductExtractionService over a (fake) network', () => {
  const productUrl = 'https://www.amazon.es/Lampara-Mesa-Seta-Cristal-Blanco/dp/B0ABCDEFGH';
  const shortLink = { 'https://amzn.eu/d/abc123': () => new Response(null, { status: 301, headers: { location: productUrl } }) };
  const captcha = '<html><head><title>Amazon.es</title></head><body><form action="/errors/validateCaptcha"></form></body></html>';

  function live(routes: Record<string, () => Response>) {
    const calls: string[] = [];
    const fetchImpl = (async (url: string) => {
      calls.push(url);
      return routes[url]?.() ?? new Response('', { status: 404 });
    }) as unknown as typeof fetch;
    const safeFetch = createSafeFetcher({ fetch: fetchImpl, resolver: null, policy });
    const robots = new RobotsChecker(safeFetch, 'GemeluBot/1.0', 'GemeluBot');
    const fetcher = new LivePageFetcher(safeFetch, 'GemeluBot/1.0', { timeoutMs: 2000, maxBytes: 1_000_000 }, robots);
    return { service: new ProductExtractionService({ fetcher, robots, headless: null, headlessHosts: [] }), calls };
  }

  it('names short links after the page they redirect to, and records why it was not read', async () => {
    const { service: s } = live({ ...shortLink, [productUrl]: () => new Response(captcha, { status: 503, headers: { 'content-type': 'text/html' } }) });
    const r = await s.extract(normalized('https://amzn.eu/d/abc123'));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toBe('blocked');
    expect(r.fallback?.title).toBe('Lampara mesa seta cristal blanco');
    expect(r.fallback?.readIssue).toEqual({ reason: 'blocked', detail: 'HTTP 503', block: 'amazon_captcha' });
  });

  it('honours robots.txt of a redirect target without fetching the page', async () => {
    const { service: s, calls } = live({
      ...shortLink,
      'https://www.amazon.es/robots.txt': () => new Response('User-agent: *\nDisallow: /Lampara-Mesa-Seta-Cristal-Blanco/'),
      [productUrl]: () => new Response('<html></html>', { headers: { 'content-type': 'text/html' } }),
    });
    const r = await s.extract(normalized('https://amzn.eu/d/abc123'));
    expect(!r.ok && r.reason).toBe('robots_disallowed');
    expect(!r.ok && r.fallback?.title).toBe('Lampara mesa seta cristal blanco');
    expect(calls).not.toContain(productUrl);
  });

  it('does not present a robots.txt server error as a ban', async () => {
    const { service: s, calls } = live({ 'https://www.ikea.com/robots.txt': () => new Response('error', { status: 500 }) });
    const r = await s.extract(normalized('https://www.ikea.com/es/es/p/akterspring-lampara-mesa-blanco-00586548/'));
    expect(!r.ok && r.reason).toBe('robots_unreachable');
    expect(!r.ok && r.fallback?.readIssue).toEqual({ reason: 'robots_unreachable', detail: 'HTTP 500' });
    expect(calls).toEqual(['https://www.ikea.com/robots.txt']);
  });
});
