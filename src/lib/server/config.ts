import { z } from 'zod';
import { BRAND } from '../../config/brand';

/**
 * Server-only configuration, parsed from Worker env vars / secrets.
 * The full list (with descriptions) lives in .env.example and docs/DEPLOYMENT.md.
 * Nothing in this module may be imported by client-side code.
 */

const bool = z
  .union([z.boolean(), z.string()])
  .optional()
  .transform((v) => v === true || v === 'true' || v === '1');
const list = z
  .string()
  .optional()
  .transform((v) => (v ? v.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean) : []));
const str = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() ? v.trim() : null));
const int = (def: number) =>
  z
    .union([z.string(), z.number()])
    .optional()
    .transform((v) => {
      const n = typeof v === 'number' ? v : v ? Number(v) : NaN;
      return Number.isFinite(n) ? n : def;
    });

const schema = z.object({
  PUBLIC_SITE_URL: z.url().optional(),
  PRODUCT_PROVIDER: z.enum(['demo', 'aliexpress', 'awin']).optional(),
  FETCH_MODE: z.enum(['live', 'fixtures']).optional(),
  SOURCE_HOST_POLICY: z.enum(['public', 'allowlist']).optional(),
  SOURCE_HOST_ALLOWLIST: list,
  SOURCE_HOST_DENYLIST: list,
  ROBOTS_POLICY: z.enum(['respect', 'ignore']).optional(),
  DNS_GUARD: z.enum(['doh', 'off']).optional(),
  VISION_PROVIDER: z.enum(['none', 'anthropic']).optional(),
  ADS_ENABLED: bool,
  ADSENSE_CLIENT_ID: str,
  ADSENSE_SLOT_RESULTS: str,
  SHOW_SIMILARITY_PERCENT: bool,
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).optional(),
  DAILY_SEARCH_BUDGET: int(3000),
  CF_WEB_ANALYTICS_TOKEN: str,
  HEADLESS_HOSTS: list,
  GO_ALLOWED_HOSTS: list,
  ALIEXPRESS_APP_KEY: str,
  ALIEXPRESS_APP_SECRET: str,
  ALIEXPRESS_TRACKING_ID: str,
  ALIEXPRESS_LANGUAGE: z.string().optional(),
  ALIEXPRESS_CURRENCY: z.string().optional(),
  ALIEXPRESS_SHIP_TO: z.string().optional(),
  ALIEXPRESS_USE_PRICE_FILTER: bool,
  ALIEXPRESS_SHIPPING_LOOKUPS: int(6),
  AWIN_PUBLISHER_ID: str,
  AWIN_API_TOKEN: str,
  AWIN_FEED_URL: str,
  AWIN_ALIEXPRESS_ADVERTISER_ID: str,
  AWIN_DEEPLINK_ENABLED: bool,
  SUPABASE_URL: str,
  SUPABASE_SERVICE_ROLE_KEY: str,
  LINK_SIGNING_SECRET: str,
  ADMIN_USER: str,
  ADMIN_PASSWORD: str,
  ANTHROPIC_API_KEY: str,
  VISION_MODEL: z.string().optional(),
  VISION_DAILY_LIMIT: int(200),
  CF_ACCOUNT_ID: str,
  CF_BROWSER_RENDERING_TOKEN: str,
});

export type RawEnv = Record<string, unknown>;

export interface AppConfig {
  siteUrl: string;
  provider: 'demo' | 'aliexpress' | 'awin';
  fetchMode: 'live' | 'fixtures';
  hostPolicy: { mode: 'public' | 'allowlist'; allowlist: string[]; denylist: string[] };
  robotsPolicy: 'respect' | 'ignore';
  dnsGuard: boolean;
  vision: { provider: 'none' | 'anthropic'; apiKey: string | null; model: string; dailyLimit: number };
  ads: { enabled: boolean; clientId: string | null; slotResults: string | null };
  showSimilarityPercent: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  dailySearchBudget: number;
  webAnalyticsToken: string | null;
  headlessHosts: string[];
  goAllowedHosts: string[];
  aliexpress: {
    appKey: string | null;
    appSecret: string | null;
    trackingId: string | null;
    language: string;
    currency: string;
    shipTo: string;
    usePriceFilter: boolean;
    shippingLookups: number;
  };
  awin: {
    publisherId: string | null;
    apiToken: string | null;
    feedUrl: string | null;
    advertiserId: string | null;
    deepLinkEnabled: boolean;
  };
  supabase: { url: string | null; serviceRoleKey: string | null };
  linkSigningSecret: string | null;
  admin: { user: string | null; password: string | null };
  browserRendering: { accountId: string | null; token: string | null };
  /** Problems that should block a production launch (shown in /api/health and admin). */
  warnings: string[];
}

let ephemeralSecret: string | null = null;

export function buildConfig(env: RawEnv): AppConfig {
  const e = schema.parse(Object.fromEntries(Object.entries(env).filter(([, v]) => typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean')));
  const warnings: string[] = [];
  const provider = e.PRODUCT_PROVIDER ?? 'demo';
  if (provider === 'aliexpress' && (!e.ALIEXPRESS_APP_KEY || !e.ALIEXPRESS_APP_SECRET)) {
    warnings.push('PRODUCT_PROVIDER=aliexpress but ALIEXPRESS_APP_KEY/ALIEXPRESS_APP_SECRET are missing');
  }
  if (provider === 'aliexpress' && !e.ALIEXPRESS_TRACKING_ID) warnings.push('ALIEXPRESS_TRACKING_ID missing: links will not carry affiliate tracking');
  if (provider === 'awin' && (!e.SUPABASE_URL || !e.SUPABASE_SERVICE_ROLE_KEY)) warnings.push('PRODUCT_PROVIDER=awin requires Supabase for the catalogue');
  if (!e.LINK_SIGNING_SECRET) warnings.push('LINK_SIGNING_SECRET missing: /go/ links use an ephemeral secret and break across isolates');
  if (!e.SUPABASE_URL) warnings.push('Supabase not configured: analytics and history are kept in memory only');
  if (provider === 'demo') warnings.push('Running in DEMO mode: alternatives are fictional');

  if (!e.LINK_SIGNING_SECRET && !ephemeralSecret) {
    const buf = new Uint8Array(32);
    crypto.getRandomValues(buf);
    ephemeralSecret = [...buf].map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  return {
    siteUrl: (e.PUBLIC_SITE_URL ?? BRAND.siteUrl).replace(/\/+$/, ''),
    provider,
    fetchMode: e.FETCH_MODE ?? 'live',
    hostPolicy: { mode: e.SOURCE_HOST_POLICY ?? 'public', allowlist: e.SOURCE_HOST_ALLOWLIST, denylist: e.SOURCE_HOST_DENYLIST },
    robotsPolicy: e.ROBOTS_POLICY ?? 'respect',
    dnsGuard: (e.DNS_GUARD ?? 'doh') === 'doh' && (e.FETCH_MODE ?? 'live') === 'live',
    vision: {
      provider: e.VISION_PROVIDER ?? 'none',
      apiKey: e.ANTHROPIC_API_KEY,
      model: e.VISION_MODEL ?? 'claude-haiku-5-5',
      dailyLimit: e.VISION_DAILY_LIMIT,
    },
    ads: { enabled: e.ADS_ENABLED && !!e.ADSENSE_CLIENT_ID, clientId: e.ADSENSE_CLIENT_ID, slotResults: e.ADSENSE_SLOT_RESULTS },
    showSimilarityPercent: e.SHOW_SIMILARITY_PERCENT,
    logLevel: e.LOG_LEVEL ?? 'info',
    dailySearchBudget: e.DAILY_SEARCH_BUDGET,
    webAnalyticsToken: e.CF_WEB_ANALYTICS_TOKEN,
    headlessHosts: e.HEADLESS_HOSTS,
    goAllowedHosts: e.GO_ALLOWED_HOSTS,
    aliexpress: {
      appKey: e.ALIEXPRESS_APP_KEY,
      appSecret: e.ALIEXPRESS_APP_SECRET,
      trackingId: e.ALIEXPRESS_TRACKING_ID,
      language: (e.ALIEXPRESS_LANGUAGE ?? 'ES').toUpperCase(),
      currency: (e.ALIEXPRESS_CURRENCY ?? 'EUR').toUpperCase(),
      shipTo: (e.ALIEXPRESS_SHIP_TO ?? 'ES').toUpperCase(),
      usePriceFilter: e.ALIEXPRESS_USE_PRICE_FILTER,
      shippingLookups: Math.max(0, Math.min(10, e.ALIEXPRESS_SHIPPING_LOOKUPS)),
    },
    awin: {
      publisherId: e.AWIN_PUBLISHER_ID,
      apiToken: e.AWIN_API_TOKEN,
      feedUrl: e.AWIN_FEED_URL,
      advertiserId: e.AWIN_ALIEXPRESS_ADVERTISER_ID,
      deepLinkEnabled: e.AWIN_DEEPLINK_ENABLED,
    },
    supabase: { url: e.SUPABASE_URL, serviceRoleKey: e.SUPABASE_SERVICE_ROLE_KEY },
    linkSigningSecret: e.LINK_SIGNING_SECRET ?? ephemeralSecret,
    admin: { user: e.ADMIN_USER, password: e.ADMIN_PASSWORD },
    browserRendering: { accountId: e.CF_ACCOUNT_ID, token: e.CF_BROWSER_RENDERING_TOKEN },
    warnings,
  };
}

/** Names of env vars whose values must never be logged or sent to the browser. */
export const SECRET_ENV_NAMES = [
  'ALIEXPRESS_APP_KEY',
  'ALIEXPRESS_APP_SECRET',
  'ALIEXPRESS_TRACKING_ID',
  'AWIN_API_TOKEN',
  'AWIN_FEED_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'LINK_SIGNING_SECRET',
  'ADMIN_PASSWORD',
  'ANTHROPIC_API_KEY',
  'CF_BROWSER_RENDERING_TOKEN',
] as const;
