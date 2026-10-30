import { CircuitBreaker, withRetry } from '../../security/resilience';
import { ProviderError } from '../types';

/**
 * AliExpress Open Platform client (business interfaces).
 *
 * Implemented from the official documentation at openservice.aliexpress.com
 * (Affiliate Developers → "API endpoint URLs" docId 1388, "Signature
 * algorithm" docId 1386, "HTTP request sample" docId 1385), verified on
 * 2026-10-30:
 *   - endpoint:  https://api-sg.aliexpress.com/sync?method={api_path}&{query}
 *   - system params: app_key, timestamp (ms since epoch), sign_method=sha256, sign
 *   - sign: sort all params (incl. `method`, excl. `sign`) by name (ASCII),
 *     concatenate key+value, HMAC-SHA256 with the App Secret, upper-case hex.
 */

export const ALIEXPRESS_ENDPOINT = 'https://api-sg.aliexpress.com/sync';

export interface AliExpressCredentials {
  appKey: string;
  appSecret: string;
  trackingId: string | null;
}

const encoder = new TextEncoder();

/** Builds the string to sign. System interfaces prefix the API path (e.g. "/auth/token/create"). */
export function signatureBaseString(params: Record<string, string>, systemApiPath?: string): string {
  const keys = Object.keys(params)
    .filter((k) => k !== 'sign' && params[k] !== undefined && params[k] !== '')
    .sort();
  return (systemApiPath ?? '') + keys.map((k) => `${k}${params[k]}`).join('');
}

export async function signAliExpress(params: Record<string, string>, appSecret: string, systemApiPath?: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', encoder.encode(appSecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = await crypto.subtle.sign('HMAC', key, encoder.encode(signatureBaseString(params, systemApiPath)));
  return [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}

interface ErrorEnvelope {
  error_response?: { code?: string; msg?: string; sub_code?: string; sub_msg?: string };
  code?: string;
  message?: string;
  type?: string;
}

export class AliExpressClient {
  private readonly breaker = new CircuitBreaker(5, 60_000);

  constructor(
    private readonly creds: AliExpressCredentials,
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly opts: { timeoutMs: number; endpoint?: string; now?: () => number } = { timeoutMs: 8000 },
  ) {}

  get trackingId(): string | null {
    return this.creds.trackingId;
  }

  /** Calls a business API and returns the `<method>_response` payload. */
  async call(method: string, business: Record<string, string | number | undefined>, signal?: AbortSignal): Promise<Record<string, unknown>> {
    if (!this.creds.appKey || !this.creds.appSecret) {
      throw new ProviderError('aliexpress', 'not_configured', 'ALIEXPRESS_APP_KEY / ALIEXPRESS_APP_SECRET are not set');
    }
    return this.breaker
      .run(method, () =>
        withRetry(
          async () => {
            const params: Record<string, string> = {
              method,
              app_key: this.creds.appKey,
              timestamp: String((this.opts.now ?? Date.now)()),
              sign_method: 'sha256',
            };
            for (const [k, v] of Object.entries(business)) if (v !== undefined && v !== '') params[k] = String(v);
            params.sign = await signAliExpress(params, this.creds.appSecret);

            const url = `${this.opts.endpoint ?? ALIEXPRESS_ENDPOINT}?${new URLSearchParams(params).toString()}`;
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), this.opts.timeoutMs);
            signal?.addEventListener('abort', () => controller.abort(), { once: true });
            let res: Response;
            try {
              res = await this.fetchImpl(url, { method: 'GET', signal: controller.signal, headers: { accept: 'application/json' } });
            } catch (err) {
              throw new ProviderError('aliexpress', controller.signal.aborted ? 'timeout' : 'upstream', (err as Error).message, true);
            } finally {
              clearTimeout(timer);
            }
            if (res.status === 429) throw new ProviderError('aliexpress', 'rate_limited', 'HTTP 429', true);
            if (res.status >= 500) throw new ProviderError('aliexpress', 'upstream', `HTTP ${res.status}`, true);
            const json = (await res.json().catch(() => null)) as (Record<string, unknown> & ErrorEnvelope) | null;
            if (!json) throw new ProviderError('aliexpress', 'bad_response', 'Invalid JSON');

            const err = json.error_response;
            if (err) {
              const code = `${err.code ?? ''} ${err.sub_code ?? ''}`.trim();
              const retryable = /limit|frequency|isp\.|timeout/i.test(code + (err.msg ?? ''));
              throw new ProviderError('aliexpress', /sign|appkey|permission|access/i.test(code) ? 'auth' : retryable ? 'rate_limited' : 'upstream', `${code}: ${err.msg ?? ''}`, retryable);
            }
            if (json.code && json.code !== '0' && json.message) {
              throw new ProviderError('aliexpress', /sign|appkey|permission|token/i.test(json.code) ? 'auth' : 'upstream', `${json.code}: ${json.message}`);
            }
            const key = `${method.replace(/\./g, '_')}_response`;
            const payload = (json[key] ?? json) as Record<string, unknown>;
            return payload;
          },
          {
            retries: 2,
            baseDelayMs: 300,
            maxDelayMs: 2000,
            shouldRetry: (e) => e instanceof ProviderError && e.retryable,
          },
        ),
      )
      .catch((err) => {
        if (err instanceof ProviderError) throw err;
        if ((err as Error).name === 'CircuitOpenError') throw new ProviderError('aliexpress', 'circuit_open', 'AliExpress temporarily disabled after repeated failures');
        throw new ProviderError('aliexpress', 'upstream', (err as Error).message);
      });
  }
}
