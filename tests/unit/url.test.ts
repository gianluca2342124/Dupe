import { describe, expect, it } from 'vitest';
import { capturePrefixedUrl } from '../../src/lib/url/capture';
import { extractUrlFromText, normalizeProductUrl, normalizePercentEncoding, toPrefixUrl } from '../../src/lib/url/normalize';
import type { HostPolicyConfig } from '../../src/lib/security/host-policy';
import { publicOrigin, referrerDomain } from '../../src/lib/server/request';

const policy: HostPolicyConfig = { mode: 'public', allowlist: [], denylist: [], ownHosts: ['gemelu.com', 'localhost'] };
const capture = (path: string) => capturePrefixedUrl(`https://gemelu.com${path}`);

describe('prefix capture (gemelu.com/<url>)', () => {
  it('captures https:// URLs including deep paths and query strings', () => {
    expect(capture('/https://www.ikea.com/es/es/p/lampara-mesa-00586548/?a=1&b=2')).toEqual({
      target: 'https://www.ikea.com/es/es/p/lampara-mesa-00586548/?a=1&b=2',
      form: 'scheme',
    });
  });

  it('captures http:// and upper-case schemes', () => {
    expect(capture('/http://tienda.es/p/1')?.target).toBe('http://tienda.es/p/1');
    expect(capture('/HTTPS://www.amazon.es/dp/B0ABC12345')?.target).toBe('https://www.amazon.es/dp/B0ABC12345');
  });

  it('repairs "https:/" when an intermediary merged the double slash', () => {
    expect(capture('/https:/www.zarahome.com/es/jarron-l1234')?.target).toBe('https://www.zarahome.com/es/jarron-l1234');
  });

  it('keeps double slashes inside the embedded path untouched', () => {
    expect(capture('/https://shop.es/a//b/c')?.target).toBe('https://shop.es/a//b/c');
  });

  it('accepts fully percent-encoded URLs', () => {
    expect(capture('/https%3A%2F%2Fwww.zarahome.com%2Fes%2Fx.html%3Fv%3D1')?.target).toBe('https://www.zarahome.com/es/x.html?v=1');
  });

  it('keeps percent-encoded accents as sent by the browser', () => {
    expect(capture('/https://www.zarahome.com/es/jarr%C3%B3n-cer%C3%A1mica-l4232?colorId=001')?.target).toBe(
      'https://www.zarahome.com/es/jarr%C3%B3n-cer%C3%A1mica-l4232?colorId=001',
    );
  });

  it('accepts bare hosts (www. and plain domains)', () => {
    expect(capture('/www.ikea.com/es/es/p/x-1/')).toEqual({ target: 'https://www.ikea.com/es/es/p/x-1/', form: 'bare-host' });
    expect(capture('/kavehome.com/es/es/p/silla')?.target).toBe('https://kavehome.com/es/es/p/silla');
  });

  it('drops the fragment (never sent by browsers anyway)', () => {
    expect(capturePrefixedUrl('https://gemelu.com/https://shop.es/p/1#reviews')?.target).toBe('https://shop.es/p/1');
  });

  it('handles very long URLs', () => {
    const long = `/https://www.tienda.es/p/${'a'.repeat(1500)}?q=${'b'.repeat(300)}`;
    expect(capture(long)?.target.length).toBeGreaterThan(1800);
  });

  it('never captures app routes or static files', () => {
    for (const p of ['/', '/buscar?url=x', '/api/search', '/go/abc.def', '/como-funciona', '/robots.txt', '/sitemap-index.xml', '/favicon.svg', '/manifest.webmanifest', '/_astro/x.js', '/og/default.png', '/demo-img/lamp-01.svg']) {
      expect(capture(p), p).toBeNull();
    }
  });
});

describe('URL normalisation', () => {
  const ok = (input: string) => {
    const r = normalizeProductUrl(input, policy);
    if (!r.ok) throw new Error(`expected ok for ${input}: ${r.error}`);
    return r.value;
  };

  it('removes tracking and attribution parameters but keeps product parameters', () => {
    const v = ok('https://www.ikea.com/es/es/p/lampara-00586548/?utm_source=ig&fbclid=x&gclid=y&srsltid=z&color=blanco');
    expect(v.canonical).toBe('https://www.ikea.com/es/es/p/lampara-00586548/?color=blanco');
    expect(v.original).toContain('utm_source=ig');
  });

  it('keeps store-specific variant parameters (Zara Home colorId)', () => {
    expect(ok('https://www.zarahome.com/es/jarron-l42?colorId=001&utm_medium=social').canonical).toBe('https://www.zarahome.com/es/jarron-l42?colorId=001');
  });

  it('canonicalises Amazon product URLs to /dp/ASIN and strips affiliate tags', () => {
    const v = ok('https://www.amazon.es/Lampara-Mesa-Moderna/dp/b0abc12345/ref=sr_1_3?keywords=lampara&qid=1&sr=8-3&tag=other-21');
    expect(v.canonical).toBe('https://www.amazon.es/dp/B0ABC12345');
    expect(v.store.name).toBe('Amazon');
  });

  it('produces the same cache key regardless of parameter order and hex case', () => {
    expect(ok('https://shop.es/p/x?b=2&a=1').cacheKey).toBe(ok('https://shop.es/p/x?a=1&b=2').cacheKey);
    expect(ok('https://shop.es/p/jarr%c3%b3n').cacheKey).toBe(ok('https://shop.es/p/jarr%C3%B3n').cacheKey);
  });

  it('recognises stores and short links', () => {
    expect(ok('https://www.westwing.es/x-1.html').store).toEqual({ id: 'westwing', name: 'Westwing', known: true });
    expect(ok('https://amzn.eu/d/abc123').isShortLink).toBe(true);
    expect(ok('https://www.tiendaxyz.es/p/1').store.known).toBe(false);
  });

  it('extracts the URL from app share text', () => {
    expect(extractUrlFromText('Mira esto en Zara Home: https://www.zarahome.com/es/jarron-l1. ¡Me encanta!')).toBe('https://www.zarahome.com/es/jarron-l1');
    expect(ok('Mira este producto de IKEA https://www.ikea.com/es/es/p/x-1/').canonical).toBe('https://www.ikea.com/es/es/p/x-1/');
    expect(ok('www.sklum.com/es/123-silla.html').canonical).toBe('https://www.sklum.com/es/123-silla.html');
  });

  it('rejects invalid, unsafe and own-domain input', () => {
    const err = (input: string) => {
      const r = normalizeProductUrl(input, policy);
      return r.ok ? null : r.error;
    };
    expect(err('')).toBe('empty');
    expect(err('hola que tal')).toBe('invalid_url');
    expect(err('javascript:alert(1)')).toBe('unsupported_scheme');
    expect(err('ftp://shop.es/p/1')).toBe('unsupported_scheme');
    expect(err('https://user:pass@shop.es/p/1')).toBe('credentials_in_url');
    expect(err('https://shop.es:8443/p/1')).toBe('forbidden_port');
    expect(err('http://localhost/p/1')).toBe('blocked_host');
    expect(err('http://127.0.0.1/p/1')).toBe('blocked_host');
    expect(err('http://169.254.169.254/latest/meta-data/')).toBe('blocked_host');
    expect(err('http://metadata.google.internal/computeMetadata/v1/')).toBe('blocked_host');
    expect(err('https://gemelu.com/https://shop.es/p/1')).toBe('own_domain');
  });

  it('normalises percent-encoding per RFC 3986', () => {
    expect(normalizePercentEncoding('/a%2db%7e%c3%b3')).toBe('/a-b~%C3%B3');
  });

  it('builds the shareable prefix URL', () => {
    expect(toPrefixUrl('https://gemelu.com/', 'https://www.ikea.com/es/es/p/x/')).toBe('https://gemelu.com/https://www.ikea.com/es/es/p/x/');
  });
});

describe('share links and referrers', () => {
  it('uses the configured site when serving it, the serving host otherwise', () => {
    expect(publicOrigin('https://gemelu.com/', new URL('https://gemelu.com/buscar?url=x'))).toBe('https://gemelu.com');
    expect(publicOrigin('https://gemelu.com', new URL('https://www.gemelu.com/ejemplo/a'))).toBe('https://gemelu.com');
    expect(publicOrigin('https://gemelu.com', new URL('https://gemelu.ana.workers.dev/buscar'))).toBe('https://gemelu.ana.workers.dev');
    expect(publicOrigin('https://gemelu.com', new URL('http://localhost:4321/buscar'))).toBe('http://localhost:4321');
  });

  it('treats every own host as internal traffic', () => {
    const req = (ref: string) => new Request('https://gemelu.ana.workers.dev/api/search', { headers: { referer: ref } });
    const own = ['gemelu.com', 'gemelu.ana.workers.dev'];
    expect(referrerDomain(req('https://gemelu.ana.workers.dev/buscar'), own)).toBeNull();
    expect(referrerDomain(req('https://www.gemelu.com/'), own)).toBeNull();
    expect(referrerDomain(req('https://www.tiktok.com/@x'), own)).toBe('tiktok.com');
  });
});
