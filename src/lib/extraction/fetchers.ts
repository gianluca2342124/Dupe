import type { SafeFetcher } from '../security/safe-fetch';
import type { FetchedPage, PageFetcher } from './service';

export const BOT_USER_AGENT_TOKEN = 'GemeluBot';

export function botUserAgent(siteUrl: string): string {
  return `Mozilla/5.0 (compatible; ${BOT_USER_AGENT_TOKEN}/1.0; +${siteUrl.replace(/\/+$/, '')}/bot)`;
}

/** Live fetcher: SSRF-safe, honest user agent, size and time limits. */
export class LivePageFetcher implements PageFetcher {
  constructor(
    private readonly safeFetch: SafeFetcher,
    private readonly userAgent: string,
    private readonly limits: { timeoutMs: number; maxBytes: number },
  ) {}

  async fetchPage(url: string): Promise<FetchedPage> {
    const res = await this.safeFetch(url, {
      userAgent: this.userAgent,
      timeoutMs: this.limits.timeoutMs,
      maxBytes: this.limits.maxBytes,
      allowTruncation: true,
    });
    return { status: res.status, finalUrl: res.finalUrl, html: res.body, truncated: res.truncated };
  }
}

/**
 * Deterministic fetcher for tests and FETCH_MODE=fixtures: serves bundled
 * HTML fixtures keyed by canonical URL. Unknown URLs behave like a 404.
 */
export class FixturePageFetcher implements PageFetcher {
  constructor(private readonly pages: Record<string, { status?: number; html: string }>) {}

  async fetchPage(url: string): Promise<FetchedPage> {
    const strip = (u: string) => u.replace(/\?.*$/, '').replace(/\/$/, '');
    const key =
      Object.keys(this.pages).find((k) => k === url || k.replace(/\/$/, '') === url.replace(/\/$/, '')) ??
      Object.keys(this.pages).find((k) => strip(k) === strip(url));
    const page = key ? this.pages[key] : undefined;
    if (!page) return { status: 404, finalUrl: url, html: '<html><head><title>404</title></head></html>', truncated: false };
    return { status: page.status ?? 200, finalUrl: url, html: page.html, truncated: false };
  }
}
