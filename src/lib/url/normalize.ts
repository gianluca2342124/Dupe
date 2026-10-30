import { STORES, type StoreDefinition } from '../../config/stores';
import { checkHostname, type HostPolicyConfig, type HostRejection } from '../security/host-policy';
import type { StoreInfo } from '../../types/product';
import { getRegistrableDomain, stripWww } from './domains';

export type UrlInputError =
  | 'empty'
  | 'too_long'
  | 'invalid_url'
  | 'unsupported_scheme'
  | 'credentials_in_url'
  | 'forbidden_port'
  | 'blocked_host'
  | 'own_domain';

export interface NormalizedProductUrl {
  /** Cleaned user input (scheme added, fragment removed) — used for "go to store". */
  original: string;
  /** Canonical URL: tracking parameters removed, store-specific cleanup applied. */
  canonical: string;
  /** Canonical with sorted query parameters; stable cache/dedupe key. */
  cacheKey: string;
  host: string;
  domain: string;
  store: StoreInfo;
  storeDefinition: StoreDefinition | null;
  /** True for hosts that only redirect (amzn.eu, bit.ly…). */
  isShortLink: boolean;
}

export type NormalizeResult =
  | { ok: true; value: NormalizedProductUrl }
  | { ok: false; error: UrlInputError; hostReason?: HostRejection };

const MAX_URL_LENGTH = 2048;

/** Exact tracking/attribution parameters stripped from canonical URLs. */
const TRACKING_PARAMS = new Set(
  [
    'gclid', 'gclsrc', 'dclid', 'gbraid', 'wbraid', 'gad_source', 'gad_campaignid', 'fbclid', 'msclkid', 'yclid',
    'ttclid', 'twclid', 'li_fat_id', 'igshid', 'igsh', 'mc_cid', 'mc_eid', '_ga', '_gl', '_hsenc', '_hsmi',
    'hsctatracking', 'mkt_tok', 'oly_anon_id', 'oly_enc_id', 'rb_clickid', 's_cid', 's_kwcid', 'ef_id', 'srsltid',
    'spm', 'scm', 'pvid', 'algo_pvid', 'algo_exp_id', 'aff_fcid', 'aff_fsk', 'aff_platform', 'aff_trace_key', 'sk',
    'terminal_id', 'afsmartredirect', 'gatewayadapt', 'cm_mmc', 'trk', 'trkid', 'epik', 'irclickid', 'irgwc',
    'clickid', 'awc', 'sv1', 'sv_campaign_id', 'ranmid', 'raneaid', 'ransiteid', 'ito', 'campaignid', 'adgroupid',
    'adid', 'creative', 'matchtype', 'network', 'placement', 'device', 'wt.mc_id', 'cmpid', 'zanpid', 'affid',
    'affiliate', 'partner', 'source', 'share', 'shared', 'sharing', 'from', 'si', 'feature',
  ].map((p) => p.toLowerCase()),
);

/** Prefixes of tracking parameters (utm_source, pf_rd_p, pd_rd_w…). */
const TRACKING_PREFIXES = ['utm_', 'pf_rd_', 'pd_rd_', 'cm_mmca', 'mtm_', 'pk_', 'hsa_', 'vero_', 'oly_'];

/** Amazon-specific noise. */
const AMAZON_PARAMS = new Set([
  'ref', 'ref_', 'tag', 'linkcode', 'linkid', 'ascsubtag', 'camp', 'creativeasin', 'qid', 'sr', 'keywords', 'crid',
  'sprefix', 'dib', 'dib_tag', 'content-id', 'th', 'psc', 'smid', 'sbo', 'social_share', 'starsleft', 'skipheader',
]);

export function findStore(hostname: string): StoreDefinition | null {
  const domain = getRegistrableDomain(hostname);
  return STORES.find((s) => s.domains.includes(domain) || s.domains.includes(hostname)) ?? null;
}

export function storeInfoFor(hostname: string): { info: StoreInfo; def: StoreDefinition | null } {
  const def = findStore(hostname);
  if (def) return { info: { id: def.id, name: def.name, known: true }, def };
  const domain = getRegistrableDomain(hostname);
  const label = stripWww(domain).split('.')[0] ?? domain;
  return {
    info: { id: domain, name: label.charAt(0).toUpperCase() + label.slice(1), known: false },
    def: null,
  };
}

/** Pulls the first http(s) URL — or www./domain-looking token — out of free text (app share sheets). */
export function extractUrlFromText(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const explicit = /https?:\/\/[^\s<>"'`]+/i.exec(trimmed);
  if (explicit) return explicit[0].replace(/[),.;!?»”’]+$/u, '');
  const bare = /(?:^|\s)((?:www\d?\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,24}\/[^\s<>"'`]*)/i.exec(trimmed);
  if (bare?.[1]) return `https://${bare[1].replace(/[),.;!?»”’]+$/u, '')}`;
  if (!/\s/.test(trimmed) && /^(?:www\d?\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)+(?:[/?].*)?$/i.test(trimmed)) {
    return `https://${trimmed}`;
  }
  return null;
}

/** RFC 3986 §6.2.2 normalisation: uppercase percent-escapes, decode unreserved characters. */
export function normalizePercentEncoding(s: string): string {
  return s.replace(/%([0-9a-f]{2})/gi, (_m, hex: string) => {
    const code = parseInt(hex, 16);
    const ch = String.fromCharCode(code);
    return /[A-Za-z0-9\-._~]/.test(ch) ? ch : `%${hex.toUpperCase()}`;
  });
}

function isTrackingParam(name: string, isAmazon: boolean): boolean {
  const lower = name.toLowerCase();
  if (TRACKING_PARAMS.has(lower)) return true;
  if (TRACKING_PREFIXES.some((p) => lower.startsWith(p))) return true;
  if (isAmazon && AMAZON_PARAMS.has(lower)) return true;
  return false;
}

/** Store-specific path canonicalisation. */
function canonicalizePath(url: URL, store: StoreDefinition | null): void {
  if (store?.id === 'amazon') {
    const asin =
      /\/(?:dp|gp\/product|gp\/aw\/d|exec\/obidos\/asin|o\/asin)\/([A-Z0-9]{10})(?:[/?]|$)/i.exec(url.pathname)?.[1];
    if (asin) url.pathname = `/dp/${asin.toUpperCase()}`;
  }
  // Collapse accidental duplicate slashes inside the embedded URL path.
  url.pathname = url.pathname.replace(/\/{2,}/g, '/');
}

export function normalizeProductUrl(input: string, policy: HostPolicyConfig): NormalizeResult {
  if (!input || !input.trim()) return { ok: false, error: 'empty' };
  if (input.length > MAX_URL_LENGTH * 2) return { ok: false, error: 'too_long' };

  let candidate = input.trim().replace(/^[<"'«“]+|[>"'»”]+$/g, '');
  if (/\s/.test(candidate) || !/^[a-z][a-z0-9+.-]*:/i.test(candidate)) {
    const extracted = extractUrlFromText(candidate);
    if (!extracted) return { ok: false, error: 'invalid_url' };
    candidate = extracted;
  }
  // Repair "https:/host" (single slash) that some intermediaries produce.
  candidate = candidate.replace(/^(https?):\/*(?=[^/])/i, (_m, s: string) => `${s.toLowerCase()}://`);
  if (candidate.length > MAX_URL_LENGTH) return { ok: false, error: 'too_long' };

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return { ok: false, error: 'invalid_url' };
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return { ok: false, error: 'unsupported_scheme' };
  if (url.username || url.password) return { ok: false, error: 'credentials_in_url' };
  if (url.port && !['80', '443'].includes(url.port)) return { ok: false, error: 'forbidden_port' };

  const hostCheck = checkHostname(url.hostname, policy);
  if (!hostCheck.ok) {
    return {
      ok: false,
      error: hostCheck.reason === 'own_domain' ? 'own_domain' : hostCheck.reason === 'invalid' ? 'invalid_url' : 'blocked_host',
      hostReason: hostCheck.reason,
    };
  }

  url.hash = '';
  url.hostname = hostCheck.hostname;
  const original = url.href;

  const { info, def } = storeInfoFor(url.hostname);
  const isAmazon = def?.id === 'amazon';
  const canonicalUrl = new URL(url.href);
  // Product pages are served over https by every store we know.
  canonicalUrl.protocol = 'https:';
  canonicalizePath(canonicalUrl, def);

  const kept: [string, string][] = [];
  for (const [key, value] of canonicalUrl.searchParams) {
    const isVariant = def?.variantParams?.some((v) => v.toLowerCase() === key.toLowerCase()) ?? false;
    if (isVariant || !isTrackingParam(key, isAmazon)) kept.push([key, value]);
  }
  canonicalUrl.search = '';
  for (const [k, v] of kept) canonicalUrl.searchParams.append(k, v);
  canonicalUrl.pathname = normalizePercentEncoding(canonicalUrl.pathname);

  const canonical = canonicalUrl.href;
  const sortedUrl = new URL(canonical);
  sortedUrl.searchParams.sort();
  const cacheKey = normalizePercentEncoding(sortedUrl.href);

  return {
    ok: true,
    value: {
      original,
      canonical,
      cacheKey,
      host: url.hostname,
      domain: hostCheck.domain,
      store: info,
      storeDefinition: def,
      isShortLink: (['amzn.eu', 'amzn.to', 'a.co', 'bit.ly', 'tinyurl.com', 't.co'] as string[]).includes(url.hostname) ||
        url.hostname === 'a.aliexpress.com' || url.hostname === 's.click.aliexpress.com',
    },
  };
}

/** The shareable "prefix" form: https://gemelu.com/https://store.com/p/… */
export function toPrefixUrl(siteUrl: string, productUrl: string): string {
  return `${siteUrl.replace(/\/+$/, '')}/${productUrl}`;
}

/** The encoded, intermediary-proof form: https://gemelu.com/buscar?url=… */
export function toSearchUrl(siteUrl: string, productUrl: string): string {
  return `${siteUrl.replace(/\/+$/, '')}/buscar?url=${encodeURIComponent(productUrl)}`;
}
