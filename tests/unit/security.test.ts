import { describe, expect, it, vi } from 'vitest';
import { isPublicIp, parseIPv6 } from '../../src/lib/security/ip';
import { checkHostname, type HostPolicyConfig } from '../../src/lib/security/host-policy';
import { createSafeFetcher, SafeFetchError, validateOutboundUrl } from '../../src/lib/security/safe-fetch';
import { StaticResolver } from '../../src/lib/security/dns';
import { isAllowedByRobots, parseRobots, RobotsChecker } from '../../src/lib/security/robots';
import { cleanText, cleanUrl } from '../../src/lib/security/sanitize';
import { redact } from '../../src/lib/server/logger';
import { CircuitBreaker, CircuitOpenError, withRetry } from '../../src/lib/security/resilience';
import { MemoryRateLimiter } from '../../src/lib/security/rate-limit';

const policy: HostPolicyConfig = { mode: 'public', allowlist: [], denylist: ['blocked.example.org'], ownHosts: ['gemelu.com'] };

describe('IP classification', () => {
  it('blocks private, loopback, link-local, CGNAT, multicast and reserved IPv4', () => {
    for (const ip of ['10.0.0.1', '127.0.0.1', '169.254.169.254', '172.16.5.4', '172.31.255.255', '192.168.1.1', '100.64.0.1', '0.0.0.0', '224.0.0.1', '255.255.255.255', '198.18.0.1', '192.0.2.10']) {
      expect(isPublicIp(ip), ip).toBe(false);
    }
    for (const ip of ['8.8.8.8', '1.1.1.1', '93.184.215.14', '172.32.0.1']) expect(isPublicIp(ip), ip).toBe(true);
  });

  it('blocks private IPv6 including mapped, NAT64, 6to4, ULA, link-local', () => {
    for (const ip of ['::1', '::', '::ffff:127.0.0.1', '::ffff:7f00:1', '64:ff9b::a9fe:a9fe', '2002:c0a8:0101::1', 'fc00::1', 'fd12:3456::1', 'fe80::1', 'ff02::1', '2001:db8::1', '2001::1']) {
      expect(isPublicIp(ip), ip).toBe(false);
    }
    expect(isPublicIp('2606:4700:4700::1111')).toBe(true);
    expect(isPublicIp('::ffff:8.8.8.8')).toBe(true);
  });

  it('parses IPv6 forms', () => {
    expect(parseIPv6('[::1]')).toHaveLength(16);
    expect(parseIPv6('fe80::1%eth0')).toBeNull();
    expect(parseIPv6('1::2::3')).toBeNull();
  });
});

describe('host policy', () => {
  it('rejects IP literals in any notation, internal names and own domain', () => {
    for (const h of ['127.0.0.1', '0x7f.1', '2130706433', '[::1]', 'localhost', 'api.localhost', 'printer.local', 'metadata.google.internal', 'intranet', 'db.svc.cluster.local', 'gemelu.com', 'www.gemelu.com', 'blocked.example.org']) {
      expect(checkHostname(h, policy).ok, h).toBe(false);
    }
    expect(checkHostname('www.ikea.com', policy)).toEqual({ ok: true, hostname: 'www.ikea.com', domain: 'ikea.com' });
  });

  it('supports allowlist mode', () => {
    const strict = { ...policy, mode: 'allowlist' as const, allowlist: ['ikea.com'] };
    expect(checkHostname('www.ikea.com', strict).ok).toBe(true);
    expect(checkHostname('www.random-shop.es', strict).ok).toBe(false);
  });

  it('validates outbound URLs (scheme, credentials, ports)', () => {
    expect(() => validateOutboundUrl('file:///etc/passwd', policy)).toThrow(SafeFetchError);
    expect(() => validateOutboundUrl('https://a:b@shop.es/', policy)).toThrow(/Credentials/);
    expect(() => validateOutboundUrl('https://shop.es:22/', policy)).toThrow(/Port/);
    expect(() => validateOutboundUrl('http://[::ffff:127.0.0.1]/', policy)).toThrow(/Host not allowed/);
    expect(validateOutboundUrl('https://shop.es/p#x', policy).href).toBe('https://shop.es/p');
  });
});

function htmlResponse(body: string, init: ResponseInit = {}) {
  return new Response(body, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' }, ...init });
}

describe('safe fetch', () => {
  it('re-validates every redirect hop and blocks redirects to internal hosts', async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 302, headers: { location: 'http://169.254.169.254/latest/meta-data/' } }));
    const sf = createSafeFetcher({ fetch: fetchMock as unknown as typeof fetch, resolver: null, policy });
    await expect(sf('https://shop.es/p/1', { userAgent: 'test' })).rejects.toMatchObject({ code: 'blocked_host' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('blocks hostnames that resolve to private addresses (DNS rebinding)', async () => {
    const fetchMock = vi.fn();
    const sf = createSafeFetcher({ fetch: fetchMock as unknown as typeof fetch, resolver: new StaticResolver({ 'evil.example.net': ['10.0.0.5'] }), policy });
    await expect(sf('https://evil.example.net/', { userAgent: 'test' })).rejects.toMatchObject({ code: 'private_address' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('follows safe redirects and limits their number', async () => {
    let n = 0;
    const fetchMock = vi.fn(async () => (n++ < 10 ? new Response(null, { status: 301, headers: { location: `/hop${n}` } }) : htmlResponse('<html></html>')));
    const sf = createSafeFetcher({ fetch: fetchMock as unknown as typeof fetch, resolver: null, policy });
    await expect(sf('https://shop.es/', { userAgent: 't', maxRedirects: 3 })).rejects.toMatchObject({ code: 'too_many_redirects' });
  });

  it('caps the body size and rejects non-HTML content', async () => {
    const big = 'x'.repeat(5000);
    const sf = createSafeFetcher({ fetch: (async () => htmlResponse(`<html>${big}</html>`)) as unknown as typeof fetch, resolver: null, policy });
    const r = await sf('https://shop.es/', { userAgent: 't', maxBytes: 1000 });
    expect(r.truncated).toBe(true);
    expect(r.bytes).toBe(1000);
    await expect(sf('https://shop.es/', { userAgent: 't', maxBytes: 1000, allowTruncation: false })).rejects.toMatchObject({ code: 'too_large' });

    const pdf = createSafeFetcher({ fetch: (async () => new Response('%PDF', { headers: { 'content-type': 'application/pdf' } })) as unknown as typeof fetch, resolver: null, policy });
    await expect(pdf('https://shop.es/x.pdf', { userAgent: 't' })).rejects.toMatchObject({ code: 'unsupported_content' });
  });

  it('times out slow servers', async () => {
    const slow = (async (_u: string, init: RequestInit) =>
      new Promise((_r, reject) => init.signal?.addEventListener('abort', () => reject(new Error('aborted'))))) as unknown as typeof fetch;
    const sf = createSafeFetcher({ fetch: slow, resolver: null, policy });
    await expect(sf('https://shop.es/', { userAgent: 't', timeoutMs: 50 })).rejects.toMatchObject({ code: 'timeout' });
  });

  it('sends an honest user agent and no cookies', async () => {
    const fetchMock = vi.fn(async () => htmlResponse('<html></html>'));
    const sf = createSafeFetcher({ fetch: fetchMock as unknown as typeof fetch, resolver: null, policy });
    await sf('https://shop.es/', { userAgent: 'Mozilla/5.0 (compatible; GemeluBot/1.0)' });
    const init = (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1];
    const headers = init.headers as Record<string, string>;
    expect(headers['user-agent']).toContain('GemeluBot');
    expect(headers.cookie).toBeUndefined();
    expect(init.redirect).toBe('manual');
  });

  it('lets the caller veto a redirect and reports where it was going', async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 301, headers: { location: 'https://www.shop.es/p/lampara-seta' } }));
    const sf = createSafeFetcher({ fetch: fetchMock as unknown as typeof fetch, resolver: null, policy });
    const err = await sf('https://short.shop.es/x1', { userAgent: 't', beforeRedirect: async () => 'disallowed' }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(SafeFetchError);
    expect(err).toMatchObject({ code: 'redirect_refused', detail: 'disallowed', url: 'https://www.shop.es/p/lampara-seta' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('errors carry the URL that failed, after redirects', async () => {
    let n = 0;
    const fetchMock = vi.fn(async () => {
      if (n++ === 0) return new Response(null, { status: 302, headers: { location: 'https://www.shop.es/p/mesa-roble' } });
      throw new Error('connection reset');
    });
    const sf = createSafeFetcher({ fetch: fetchMock as unknown as typeof fetch, resolver: null, policy });
    await expect(sf('https://short.shop.es/m', { userAgent: 't' })).rejects.toMatchObject({ code: 'network', url: 'https://www.shop.es/p/mesa-roble' });
  });
});

describe('robots.txt', () => {
  const rules = parseRobots(`User-agent: *\nDisallow: /search\nAllow: /search/ok\nDisallow: /*?sort=\n\nUser-agent: GemeluBot\nDisallow: /private$\n`);
  it('applies the most specific group and longest-match precedence', () => {
    expect(isAllowedByRobots(rules, 'GemeluBot', '/search')).toBe(true); // specific group wins
    expect(isAllowedByRobots(rules, 'GemeluBot', '/private')).toBe(false);
    expect(isAllowedByRobots(rules, 'GemeluBot', '/private/x')).toBe(true);
    expect(isAllowedByRobots(rules, 'OtherBot', '/search/x')).toBe(false);
    expect(isAllowedByRobots(rules, 'OtherBot', '/search/ok')).toBe(true);
    expect(isAllowedByRobots(rules, 'OtherBot', '/p?sort=price')).toBe(false);
  });
});

describe('robots.txt checker', () => {
  const page = new URL('https://shop.es/p/lampara-seta');
  const checkWith = (respond: () => Response) =>
    new RobotsChecker(createSafeFetcher({ fetch: (async () => respond()) as unknown as typeof fetch, resolver: null, policy }), 'GemeluBot/1.0', 'GemeluBot').check(page);

  it('applies the rules, and reads 4xx as "no rules"', async () => {
    expect(await checkWith(() => new Response('User-agent: *\nDisallow: /p/'))).toEqual({ verdict: 'disallowed' });
    expect(await checkWith(() => new Response('User-agent: *\nDisallow: /cart'))).toEqual({ verdict: 'allowed' });
    expect(await checkWith(() => new Response('', { status: 404 }))).toEqual({ verdict: 'allowed' });
  });

  it('reports server and network errors as unreachable, not as a ban', async () => {
    expect(await checkWith(() => new Response('error', { status: 503 }))).toEqual({ verdict: 'unreachable', detail: 'HTTP 503' });
    expect(
      await checkWith(() => {
        throw new Error('connection reset');
      }),
    ).toEqual({ verdict: 'unreachable', detail: 'network' });
  });

  it('recognises bot walls and rate limits on robots.txt itself', async () => {
    const captcha = '<html><body><form action="/errors/validateCaptcha"></form></body></html>';
    expect(await checkWith(() => new Response(captcha, { status: 503 }))).toEqual({ verdict: 'blocked', detail: 'HTTP 503', block: 'amazon_captcha' });
    expect(await checkWith(() => new Response('', { status: 429 }))).toEqual({ verdict: 'blocked', detail: 'HTTP 429', block: 'rate_limited' });
  });
});

describe('sanitisation and logging', () => {
  it('strips markup, scripts and control characters from third-party text', () => {
    expect(cleanText('<b>Lámpara</b> <script>alert(1)</script>de&nbsp;mesa\u0000')).toBe('Lámpara de mesa');
    expect(cleanText('x'.repeat(50), 10)).toHaveLength(10);
  });
  it('only accepts http(s) URLs', () => {
    expect(cleanUrl('javascript:alert(1)')).toBeNull();
    expect(cleanUrl('data:text/html,hi')).toBeNull();
    expect(cleanUrl('//cdn.shop.es/a.jpg')).toBe('https://cdn.shop.es/a.jpg');
  });
  it('redacts secrets from logs', () => {
    const out = redact({ msg: 'call https://api-sg.aliexpress.com/sync?app_key=123&sign=ABC&method=x', ADMIN_PASSWORD: 'p', nested: { token: 'z', text: 'my-secret-value here' } }, ['my-secret-value']) as Record<string, unknown>;
    expect(JSON.stringify(out)).not.toMatch(/sign=ABC|app_key=123|my-secret-value/);
    expect(out.ADMIN_PASSWORD).toBe('[redacted]');
  });
});

describe('resilience', () => {
  it('retries retryable errors with backoff', async () => {
    let calls = 0;
    const r = await withRetry(
      async () => {
        if (++calls < 3) throw new Error('flaky');
        return 'ok';
      },
      { retries: 3, baseDelayMs: 1, maxDelayMs: 2, shouldRetry: () => true, sleep: async () => {} },
    );
    expect(r).toBe('ok');
    expect(calls).toBe(3);
  });
  it('opens the circuit after repeated failures and half-opens after cooldown', async () => {
    let now = 0;
    const cb = new CircuitBreaker(2, 1000, () => now);
    const fail = () => cb.run('p', async () => Promise.reject(new Error('x')));
    await expect(fail()).rejects.toThrow('x');
    await expect(fail()).rejects.toThrow('x');
    await expect(fail()).rejects.toBeInstanceOf(CircuitOpenError);
    now = 2000;
    await expect(cb.run('p', async () => 'ok')).resolves.toBe('ok');
  });
  it('rate limits per key', async () => {
    const rl = new MemoryRateLimiter(2, 60_000);
    expect((await rl.limit('a')).success).toBe(true);
    expect((await rl.limit('a')).success).toBe(true);
    expect((await rl.limit('a')).success).toBe(false);
    expect((await rl.limit('b')).success).toBe(true);
  });
});
