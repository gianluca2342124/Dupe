import type { FetchedPage } from './service';

/**
 * Optional headless rendering for client-side-rendered product pages.
 *
 * Used only when (1) it is configured, (2) the store's domain is explicitly
 * allow-listed in HEADLESS_HOSTS and (3) the plain HTML loaded fine but
 * contained no product data. It is never used to get past bot protection,
 * CAPTCHAs or logins.
 */
export interface HeadlessRenderer {
  render(url: string): Promise<FetchedPage>;
}

interface BrowserRenderingResponse {
  success: boolean;
  result?: string;
  errors?: { message: string }[];
}

/**
 * Cloudflare Browser Rendering REST API (`/browser-rendering/content`).
 * Requires CF_ACCOUNT_ID and a token with "Browser Rendering - Edit".
 * Pricing/limits: see https://developers.cloudflare.com/browser-rendering/ —
 * verify before enabling in production.
 */
export class CloudflareBrowserRendering implements HeadlessRenderer {
  constructor(
    private readonly accountId: string,
    private readonly apiToken: string,
    private readonly userAgent: string,
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly timeoutMs = 20_000,
  ) {}

  async render(url: string): Promise<FetchedPage> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await this.fetchImpl(
        `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(this.accountId)}/browser-rendering/content`,
        {
          method: 'POST',
          signal: controller.signal,
          headers: { authorization: `Bearer ${this.apiToken}`, 'content-type': 'application/json' },
          body: JSON.stringify({
            url,
            userAgent: this.userAgent,
            rejectResourceTypes: ['image', 'media', 'font', 'stylesheet'],
            gotoOptions: { waitUntil: 'networkidle2', timeout: 15_000 },
          }),
        },
      );
      const json = (await res.json()) as BrowserRenderingResponse;
      if (!res.ok || !json.success || typeof json.result !== 'string') {
        throw new Error(`Browser Rendering failed: ${json.errors?.[0]?.message ?? res.status}`);
      }
      return { status: 200, finalUrl: url, html: json.result, truncated: false };
    } finally {
      clearTimeout(timer);
    }
  }
}
