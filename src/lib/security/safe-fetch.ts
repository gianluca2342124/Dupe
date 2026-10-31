import { assertResolvesToPublic, DnsError, type DnsResolver } from './dns';
import { checkHostname, type HostPolicyConfig, type HostRejection } from './host-policy';

/**
 * The only way server code fetches third-party URLs.
 *
 * Guarantees:
 * - http/https only, default ports only, no credentials in the URL;
 * - host policy (no IPs, no internal names, no own domain, optional allowlist);
 * - DNS answers must all be public (when a resolver is configured);
 * - redirects are followed manually and every hop is re-validated;
 * - hard timeout for the whole operation and a byte cap on the body;
 * - only HTML-like content types are accepted for page fetches;
 * - no cookies are sent or stored.
 *
 * The fetched body is never returned to the browser: callers only expose
 * structured, sanitised fields, so the service cannot act as an open proxy.
 */

export type SafeFetchErrorCode =
  | 'invalid_url'
  | 'unsupported_scheme'
  | 'credentials_in_url'
  | 'forbidden_port'
  | 'blocked_host'
  | 'dns_failed'
  | 'private_address'
  | 'too_many_redirects'
  | 'timeout'
  | 'too_large'
  | 'unsupported_content'
  | 'redirect_refused'
  | 'network';

export class SafeFetchError extends Error {
  constructor(
    public readonly code: SafeFetchErrorCode,
    message: string,
    public readonly detail?: HostRejection | string,
    /** URL being fetched when the error happened (after redirects). */
    public readonly url?: string,
  ) {
    super(message);
    this.name = 'SafeFetchError';
  }
}

export interface SafeFetchOptions {
  userAgent: string;
  timeoutMs?: number;
  maxRedirects?: number;
  maxBytes?: number;
  accept?: string;
  acceptLanguage?: string;
  /** Lower-case MIME types accepted (prefix match). Empty = accept anything textual. */
  allowedContentTypes?: readonly string[];
  /** When the body exceeds maxBytes, keep the first maxBytes instead of failing. */
  allowTruncation?: boolean;
  /**
   * Called before following each redirect, with the validated target.
   * Return null to follow it, or a reason to stop (e.g. robots.txt).
   */
  beforeRedirect?: (next: URL) => Promise<string | null>;
}

export interface SafeFetchResult {
  status: number;
  ok: boolean;
  finalUrl: string;
  redirects: string[];
  contentType: string | null;
  body: string;
  bytes: number;
  truncated: boolean;
  headers: Headers;
}

export interface SafeFetcherDeps {
  fetch: typeof fetch;
  resolver: DnsResolver | null;
  policy: HostPolicyConfig;
}

export type SafeFetcher = (url: string, options: SafeFetchOptions) => Promise<SafeFetchResult>;

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

/** Validates scheme/credentials/port/host of a URL without performing I/O. */
export function validateOutboundUrl(raw: string | URL, policy: HostPolicyConfig): URL {
  let url: URL;
  try {
    url = typeof raw === 'string' ? new URL(raw) : new URL(raw.href);
  } catch {
    throw new SafeFetchError('invalid_url', 'URL could not be parsed');
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new SafeFetchError('unsupported_scheme', `Scheme ${url.protocol} is not allowed`);
  }
  if (url.username || url.password) {
    throw new SafeFetchError('credentials_in_url', 'Credentials in URLs are not allowed');
  }
  if (url.port && !['80', '443'].includes(url.port)) {
    throw new SafeFetchError('forbidden_port', `Port ${url.port} is not allowed`);
  }
  const check = checkHostname(url.hostname, policy);
  if (!check.ok) {
    throw new SafeFetchError('blocked_host', `Host not allowed (${check.reason})`, check.reason);
  }
  url.hash = '';
  return url;
}

export function createSafeFetcher(deps: SafeFetcherDeps): SafeFetcher {
  return async function safeFetch(rawUrl, options) {
    const {
      userAgent,
      timeoutMs = 9000,
      maxRedirects = 5,
      maxBytes = 4_500_000,
      accept = 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5',
      acceptLanguage = 'es-ES,es;q=0.9,en;q=0.6',
      allowedContentTypes = ['text/html', 'application/xhtml+xml'],
      allowTruncation = true,
      beforeRedirect,
    } = options;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const redirects: string[] = [];
    let current: URL | null = null;

    try {
      current = validateOutboundUrl(rawUrl, deps.policy);
      for (let hop = 0; ; hop++) {
        if (deps.resolver) {
          try {
            await assertResolvesToPublic(current.hostname, deps.resolver);
          } catch (err) {
            if (err instanceof DnsError && err.code === 'private_address') {
              throw new SafeFetchError('private_address', 'Host resolves to a private address');
            }
            throw new SafeFetchError('dns_failed', `DNS resolution failed for ${current.hostname}`, (err as Error).message);
          }
        }

        let response: Response;
        try {
          response = await deps.fetch(current.href, {
            method: 'GET',
            redirect: 'manual',
            signal: controller.signal,
            headers: {
              'user-agent': userAgent,
              accept,
              'accept-language': acceptLanguage,
            },
          });
        } catch (err) {
          if (controller.signal.aborted) throw new SafeFetchError('timeout', 'Request timed out');
          throw new SafeFetchError('network', `Network error: ${(err as Error).message}`);
        }

        if (REDIRECT_STATUSES.has(response.status)) {
          const location = response.headers.get('location');
          await response.body?.cancel().catch(() => undefined);
          if (!location) throw new SafeFetchError('network', 'Redirect without Location header');
          if (hop >= maxRedirects) throw new SafeFetchError('too_many_redirects', 'Too many redirects');
          let next: URL;
          try {
            next = new URL(location, current);
          } catch {
            throw new SafeFetchError('invalid_url', 'Invalid redirect target');
          }
          redirects.push(current.href);
          next = validateOutboundUrl(next, deps.policy);
          const refusal = beforeRedirect ? await beforeRedirect(next) : null;
          if (refusal) throw new SafeFetchError('redirect_refused', `Redirect to ${next.host} not followed`, refusal, next.href);
          current = next;
          continue;
        }

        const contentType = response.headers.get('content-type');
        const declaredLength = Number(response.headers.get('content-length') ?? '0');
        if (!allowTruncation && declaredLength > maxBytes) {
          await response.body?.cancel().catch(() => undefined);
          throw new SafeFetchError('too_large', 'Response too large');
        }

        const { bytes, truncated, data } = await readCapped(response, maxBytes, controller);
        if (truncated && !allowTruncation) throw new SafeFetchError('too_large', 'Response too large');

        const body = decodeBody(data, contentType);
        if (response.ok && allowedContentTypes.length > 0 && !isAllowedType(contentType, body, allowedContentTypes)) {
          throw new SafeFetchError('unsupported_content', `Unsupported content type: ${contentType ?? 'none'}`);
        }

        return {
          status: response.status,
          ok: response.ok,
          finalUrl: current.href,
          redirects,
          contentType,
          body,
          bytes,
          truncated,
          headers: response.headers,
        };
      }
    } catch (err) {
      const at = current?.href;
      if (err instanceof SafeFetchError) throw err.url || !at ? err : new SafeFetchError(err.code, err.message, err.detail, at);
      if (controller.signal.aborted) throw new SafeFetchError('timeout', 'Request timed out', undefined, at);
      throw new SafeFetchError('network', (err as Error).message, undefined, at);
    } finally {
      clearTimeout(timer);
    }
  };
}

async function readCapped(
  response: Response,
  maxBytes: number,
  controller: AbortController,
): Promise<{ data: Uint8Array; bytes: number; truncated: boolean }> {
  if (!response.body) return { data: new Uint8Array(0), bytes: 0, truncated: false };
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  let truncated = false;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      if (total + value.byteLength > maxBytes) {
        chunks.push(value.subarray(0, maxBytes - total));
        total = maxBytes;
        truncated = true;
        await reader.cancel().catch(() => undefined);
        break;
      }
      chunks.push(value);
      total += value.byteLength;
    }
  } catch (err) {
    if (controller.signal.aborted) throw new SafeFetchError('timeout', 'Body read timed out');
    throw new SafeFetchError('network', `Body read failed: ${(err as Error).message}`);
  }
  const data = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    data.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { data, bytes: total, truncated };
}

function charsetFrom(contentType: string | null, head: string): string {
  const fromHeader = /charset=["']?([\w-]+)/i.exec(contentType ?? '')?.[1];
  if (fromHeader) return fromHeader.toLowerCase();
  const fromMeta = /<meta[^>]+charset=["']?([\w-]+)/i.exec(head)?.[1];
  return (fromMeta ?? 'utf-8').toLowerCase();
}

function decodeBody(data: Uint8Array, contentType: string | null): string {
  const sniff = new TextDecoder('utf-8').decode(data.subarray(0, 2048));
  const charset = charsetFrom(contentType, sniff);
  if (charset === 'utf-8' || charset === 'utf8') return new TextDecoder('utf-8').decode(data);
  try {
    return new TextDecoder(charset).decode(data);
  } catch {
    return new TextDecoder('utf-8').decode(data);
  }
}

function isAllowedType(contentType: string | null, body: string, allowed: readonly string[]): boolean {
  const type = (contentType ?? '').split(';')[0]?.trim().toLowerCase() ?? '';
  if (type) return allowed.some((a) => type.startsWith(a));
  // No content-type: sniff for HTML.
  return /^\s*(<!doctype html|<html|<head|<!--)/i.test(body.slice(0, 512));
}
