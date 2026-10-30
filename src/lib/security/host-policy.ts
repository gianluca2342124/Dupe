import { ipLiteralKind } from './ip';
import { getRegistrableDomain } from '../url/domains';

export interface HostPolicyConfig {
  /**
   * `public`: any public internet host that passes the safety checks.
   * `allowlist`: only registrable domains listed in `allowlist`.
   */
  mode: 'public' | 'allowlist';
  allowlist: readonly string[];
  /** Registrable domains we never fetch (e.g. our own, known abusive hosts). */
  denylist: readonly string[];
  /** Hostnames that belong to this deployment (loop prevention). */
  ownHosts: readonly string[];
}

export type HostRejection =
  | 'invalid'
  | 'ip_literal'
  | 'reserved_name'
  | 'single_label'
  | 'own_domain'
  | 'denylisted'
  | 'not_allowlisted';

export type HostCheck = { ok: true; hostname: string; domain: string } | { ok: false; reason: HostRejection };

/** Suffixes that are never public internet hosts. */
const RESERVED_SUFFIXES = [
  'localhost',
  'local',
  'localdomain',
  'internal',
  'intranet',
  'lan',
  'home',
  'home.arpa',
  'corp',
  'private',
  'test',
  'example',
  'invalid',
  'onion',
  'arpa',
  'svc',
  'cluster.local',
];

const RESERVED_NAMES = new Set([
  'localhost',
  'metadata',
  'metadata.google.internal',
  'instance-data',
  'kubernetes',
  'kubernetes.default',
]);

const HOSTNAME_RE = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9-]{2,63}$/;

export function normalizeHostname(hostname: string): string {
  return hostname.trim().toLowerCase().replace(/\.+$/, '');
}

export function checkHostname(rawHostname: string, policy: HostPolicyConfig): HostCheck {
  const hostname = normalizeHostname(rawHostname);
  if (!hostname) return { ok: false, reason: 'invalid' };

  // Product pages never live on bare IP addresses; refusing them outright is
  // simpler and safer than classifying every literal.
  if (ipLiteralKind(hostname) || hostname.startsWith('[')) return { ok: false, reason: 'ip_literal' };
  // Purely numeric labels are IP-like notations some parsers accept (e.g. "0x7f.1").
  if (/^(0x[0-9a-f]+|\d+)(\.(0x[0-9a-f]+|\d+))*$/i.test(hostname)) {
    return { ok: false, reason: 'ip_literal' };
  }
  if (RESERVED_NAMES.has(hostname)) return { ok: false, reason: 'reserved_name' };
  if (RESERVED_SUFFIXES.some((s) => hostname === s || hostname.endsWith(`.${s}`))) {
    return { ok: false, reason: 'reserved_name' };
  }
  if (!hostname.includes('.')) return { ok: false, reason: 'single_label' };
  if (!HOSTNAME_RE.test(hostname)) return { ok: false, reason: 'invalid' };

  const domain = getRegistrableDomain(hostname);
  const own = policy.ownHosts.map(normalizeHostname);
  if (own.some((h) => hostname === h || hostname.endsWith(`.${h}`) || domain === getRegistrableDomain(h))) {
    return { ok: false, reason: 'own_domain' };
  }
  if (policy.denylist.some((d) => domain === d || hostname === d || hostname.endsWith(`.${d}`))) {
    return { ok: false, reason: 'denylisted' };
  }
  if (policy.mode === 'allowlist' && !policy.allowlist.some((d) => domain === d || hostname.endsWith(`.${d}`))) {
    return { ok: false, reason: 'not_allowlisted' };
  }
  return { ok: true, hostname, domain };
}
