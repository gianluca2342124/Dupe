import type { ProviderId } from '../../types/product';
import { base64UrlDecode, base64UrlEncode, fromUtf8, hmacSign, utf8 } from '../security/crypto';

/**
 * Outbound links go through /go/<token>. The token is a signed, compact
 * description of the destination: only URLs we produced (and signed) can be
 * redirected to, and only to allow-listed merchant/affiliate hosts — so /go/
 * can never be used as an open redirect.
 */
export interface GoPayload {
  v: 1;
  /** provider */
  p: ProviderId;
  /** provider product id */
  i: string;
  /** destination URL (null for demo items) */
  u: string | null;
  /** 1 = affiliate tracking link */
  a: 0 | 1;
  /** search id */
  s: string;
  /** rank (1-based) */
  r: number;
  /** tier code: v | vs | s | l */
  t: 'v' | 'vs' | 's' | 'l';
  /** issued at (unix seconds) */
  ts: number;
}

/** Hosts we are willing to redirect to. Extend via GO_ALLOWED_HOSTS. */
export const DEFAULT_GO_HOSTS = ['aliexpress.com', 'aliexpress.es', 'aliexpress.us', 's.click.aliexpress.com', 'awin1.com', 'www.awin1.com'];

export function isAllowedDestination(url: string, extraHosts: readonly string[] = []): boolean {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return false;
  if (u.username || u.password) return false;
  const host = u.hostname.toLowerCase();
  return [...DEFAULT_GO_HOSTS, ...extraHosts].some((h) => host === h || host.endsWith(`.${h}`));
}

export async function createGoToken(payload: Omit<GoPayload, 'v' | 'ts'>, secret: string, now = Date.now()): Promise<string> {
  const full: GoPayload = { v: 1, ...payload, ts: Math.floor(now / 1000) };
  const body = base64UrlEncode(utf8(JSON.stringify(full)));
  const sig = (await hmacSign(secret, body)).slice(0, 32);
  return `${body}.${sig}`;
}

export type GoVerification =
  | { ok: true; payload: GoPayload }
  | { ok: false; reason: 'malformed' | 'bad_signature' | 'expired' | 'destination_not_allowed' };

export async function verifyGoToken(
  token: string,
  secret: string,
  opts: { maxAgeDays?: number; extraHosts?: readonly string[]; now?: number } = {},
): Promise<GoVerification> {
  if (!token || token.length > 4096) return { ok: false, reason: 'malformed' };
  const dot = token.lastIndexOf('.');
  if (dot <= 0) return { ok: false, reason: 'malformed' };
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = (await hmacSign(secret, body)).slice(0, 32);
  // Double-HMAC comparison: timing differences on the HMAC outputs reveal
  // nothing about the expected signature.
  const [a, b] = await Promise.all([hmacSign(secret, expected), hmacSign(secret, sig)]);
  if (a !== b) return { ok: false, reason: 'bad_signature' };

  let payload: GoPayload;
  try {
    payload = JSON.parse(fromUtf8(base64UrlDecode(body))) as GoPayload;
  } catch {
    return { ok: false, reason: 'malformed' };
  }
  if (payload.v !== 1 || typeof payload.i !== 'string' || typeof payload.p !== 'string') return { ok: false, reason: 'malformed' };
  const maxAge = (opts.maxAgeDays ?? 90) * 86400;
  const now = Math.floor((opts.now ?? Date.now()) / 1000);
  if (typeof payload.ts !== 'number' || now - payload.ts > maxAge) return { ok: false, reason: 'expired' };
  if (payload.u !== null && !isAllowedDestination(payload.u, opts.extraHosts)) {
    return { ok: false, reason: 'destination_not_allowed' };
  }
  return { ok: true, payload };
}
