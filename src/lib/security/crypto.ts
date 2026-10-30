/**
 * Small Web Crypto helpers that work identically in Workers, Node ≥ 20 and browsers.
 */

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function base64UrlDecode(input: string): Uint8Array<ArrayBuffer> {
  if (!/^[A-Za-z0-9_-]*$/.test(input)) throw new Error('Invalid base64url');
  const padded = input.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (input.length % 4)) % 4);
  const binary = atob(padded);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

export function utf8(s: string): Uint8Array<ArrayBuffer> {
  return encoder.encode(s);
}

export function fromUtf8(bytes: Uint8Array): string {
  return decoder.decode(bytes);
}

export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(input));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const keyCache = new Map<string, Promise<CryptoKey>>();

function hmacKey(secret: string): Promise<CryptoKey> {
  let key = keyCache.get(secret);
  if (!key) {
    key = crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
      'sign',
      'verify',
    ]);
    keyCache.set(secret, key);
  }
  return key;
}

export async function hmacSign(secret: string, data: string): Promise<string> {
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(secret), encoder.encode(data));
  return base64UrlEncode(new Uint8Array(sig));
}

/** Constant-time verification (delegated to WebCrypto). */
export async function hmacVerify(secret: string, data: string, signature: string): Promise<boolean> {
  let sigBytes: Uint8Array<ArrayBuffer>;
  try {
    sigBytes = base64UrlDecode(signature);
  } catch {
    return false;
  }
  return crypto.subtle.verify('HMAC', await hmacKey(secret), sigBytes, encoder.encode(data));
}

/** Constant-time string comparison for secrets of possibly different length. */
export async function timingSafeEqual(a: string, b: string): Promise<boolean> {
  const [ha, hb] = await Promise.all([sha256Hex(a), sha256Hex(b)]);
  let diff = 0;
  for (let i = 0; i < ha.length; i++) diff |= ha.charCodeAt(i) ^ hb.charCodeAt(i);
  return diff === 0 && a.length === b.length;
}

/** Short random id (URL-safe), e.g. for click ids. */
export function randomId(bytes = 12): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return base64UrlEncode(buf);
}
