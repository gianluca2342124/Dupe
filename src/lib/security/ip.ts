/**
 * IP address parsing and classification for SSRF protection.
 *
 * Hostnames should be passed through the WHATWG URL parser first: it already
 * canonicalises exotic IPv4 notations (`0x7f.1`, `2130706433`, `017700000001`)
 * into dotted decimal, and IPv6 into bracketed compressed form. We still parse
 * defensively here because values may also come from DNS answers.
 */

type CidrV4 = readonly [number, number, number, number, number];

/** Special-purpose / non-public IPv4 ranges (RFC 6890 and friends). */
const BLOCKED_V4: readonly CidrV4[] = [
  [0, 0, 0, 0, 8], // "this" network
  [10, 0, 0, 0, 8], // private
  [100, 64, 0, 0, 10], // carrier-grade NAT
  [127, 0, 0, 0, 8], // loopback
  [169, 254, 0, 0, 16], // link-local (cloud metadata lives here)
  [172, 16, 0, 0, 12], // private
  [192, 0, 0, 0, 24], // IETF protocol assignments
  [192, 0, 2, 0, 24], // TEST-NET-1
  [192, 31, 196, 0, 24], // AS112
  [192, 52, 193, 0, 24], // AMT
  [192, 88, 99, 0, 24], // 6to4 relay anycast
  [192, 168, 0, 0, 16], // private
  [192, 175, 48, 0, 24], // AS112
  [198, 18, 0, 0, 15], // benchmarking
  [198, 51, 100, 0, 24], // TEST-NET-2
  [203, 0, 113, 0, 24], // TEST-NET-3
  [224, 0, 0, 0, 4], // multicast
  [240, 0, 0, 0, 4], // reserved + broadcast
];

export function parseIPv4(input: string): [number, number, number, number] | null {
  const parts = input.split('.');
  if (parts.length !== 4) return null;
  const out: number[] = [];
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    // Leading zeros are ambiguous (octal in some parsers) — refuse them.
    if (part.length > 1 && part.startsWith('0')) return null;
    const n = Number(part);
    if (n > 255) return null;
    out.push(n);
  }
  return out as [number, number, number, number];
}

function inCidrV4(ip: readonly number[], cidr: CidrV4): boolean {
  const [a, b, c, d, bits] = cidr;
  const ipNum = ((ip[0]! << 24) | (ip[1]! << 16) | (ip[2]! << 8) | ip[3]!) >>> 0;
  const netNum = ((a << 24) | (b << 16) | (c << 8) | d) >>> 0;
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return (ipNum & mask) === (netNum & mask);
}

export function isPublicIPv4(ip: readonly number[]): boolean {
  return !BLOCKED_V4.some((cidr) => inCidrV4(ip, cidr));
}

/** Parses an IPv6 address (without brackets) into 16 bytes. */
export function parseIPv6(input: string): number[] | null {
  let s = input.trim().toLowerCase();
  if (s.startsWith('[') && s.endsWith(']')) s = s.slice(1, -1);
  // Zone ids (fe80::1%eth0) are never acceptable for outbound fetches.
  if (s.includes('%')) return null;
  if (!/^[0-9a-f:.]+$/.test(s)) return null;

  let tailV4: number[] | null = null;
  const lastColon = s.lastIndexOf(':');
  if (s.includes('.')) {
    const v4 = parseIPv4(s.slice(lastColon + 1));
    if (!v4) return null;
    tailV4 = v4;
    s = s.slice(0, lastColon + 1) + '0:0';
  }

  const doubleColon = s.indexOf('::');
  if (doubleColon !== s.lastIndexOf('::')) return null;

  let groups: string[];
  if (doubleColon >= 0) {
    const head = s.slice(0, doubleColon).split(':').filter(Boolean);
    const tail = s.slice(doubleColon + 2).split(':').filter(Boolean);
    const missing = 8 - head.length - tail.length;
    if (missing < 1) return null;
    groups = [...head, ...Array<string>(missing).fill('0'), ...tail];
  } else {
    groups = s.split(':');
  }
  if (groups.length !== 8) return null;

  const bytes: number[] = [];
  for (const g of groups) {
    if (!/^[0-9a-f]{1,4}$/.test(g)) return null;
    const n = parseInt(g, 16);
    bytes.push((n >> 8) & 0xff, n & 0xff);
  }
  if (tailV4) {
    bytes.splice(12, 4, ...tailV4);
  }
  return bytes;
}

function startsWith(bytes: readonly number[], prefix: readonly number[], bits: number): boolean {
  const fullBytes = Math.floor(bits / 8);
  for (let i = 0; i < fullBytes; i++) if (bytes[i] !== prefix[i]) return false;
  const rem = bits % 8;
  if (rem === 0) return true;
  const mask = (0xff << (8 - rem)) & 0xff;
  return ((bytes[fullBytes] ?? 0) & mask) === ((prefix[fullBytes] ?? 0) & mask);
}

export function isPublicIPv6(bytes: readonly number[]): boolean {
  const z = (n: number) => Array<number>(n).fill(0);
  const embedded = (offset: number) => bytes.slice(offset, offset + 4);

  // :: and ::1
  if (bytes.every((b) => b === 0)) return false;
  if (startsWith(bytes, [...z(15), 1], 128)) return false;
  // IPv4-mapped ::ffff:0:0/96 and IPv4-compatible ::/96 → judge the embedded IPv4.
  if (startsWith(bytes, [...z(10), 0xff, 0xff], 96)) return isPublicIPv4(embedded(12));
  if (startsWith(bytes, z(12), 96)) return isPublicIPv4(embedded(12));
  // NAT64 well-known prefix 64:ff9b::/96 and local-use 64:ff9b:1::/48.
  if (startsWith(bytes, [0, 0x64, 0xff, 0x9b, ...z(8)], 96)) return isPublicIPv4(embedded(12));
  if (startsWith(bytes, [0, 0x64, 0xff, 0x9b, 0, 1], 48)) return false;
  // Discard-only 100::/64.
  if (startsWith(bytes, [1, 0, ...z(6)], 64)) return false;
  // 2001::/23 IETF protocol assignments (incl. Teredo 2001::/32), 2001:db8::/32 docs.
  if (startsWith(bytes, [0x20, 0x01, 0x00], 23)) return false;
  if (startsWith(bytes, [0x20, 0x01, 0x0d, 0xb8], 32)) return false;
  // 6to4 2002::/16 → embedded IPv4 in bytes 2..5.
  if (startsWith(bytes, [0x20, 0x02], 16)) return isPublicIPv4(embedded(2));
  // Unique local fc00::/7, link-local fe80::/10, site-local fec0::/10, multicast ff00::/8.
  if (startsWith(bytes, [0xfc], 7)) return false;
  if (startsWith(bytes, [0xfe, 0x80], 10)) return false;
  if (startsWith(bytes, [0xfe, 0xc0], 10)) return false;
  if (startsWith(bytes, [0xff], 8)) return false;
  // Only global unicast 2000::/3 is acceptable.
  return startsWith(bytes, [0x20], 3);
}

export type IpKind = 'v4' | 'v6';

/** Returns the IP kind if `host` is an IP literal (bracketed or not), else null. */
export function ipLiteralKind(host: string): IpKind | null {
  if (parseIPv4(host)) return 'v4';
  if (/^\[?[0-9a-f:.]+\]?$/i.test(host) && host.includes(':') && parseIPv6(host)) return 'v6';
  return null;
}

/** True when `ip` (v4 dotted or v6 text) is a globally routable public address. */
export function isPublicIp(ip: string): boolean {
  const v4 = parseIPv4(ip);
  if (v4) return isPublicIPv4(v4);
  const v6 = parseIPv6(ip);
  if (v6) return isPublicIPv6(v6);
  return false;
}
