/**
 * Validates the environment for a production deploy without printing secrets.
 *   npx tsx scripts/check-env.ts            (reads process.env)
 * Exit code 1 when a launch-blocking problem is found.
 */
import { buildConfig } from '../src/lib/server/config';

const config = buildConfig(process.env as Record<string, unknown>);
const blocking: string[] = [];
if (config.provider === 'demo') blocking.push('PRODUCT_PROVIDER is "demo": real alternatives are not connected.');
if (!process.env.LINK_SIGNING_SECRET || process.env.LINK_SIGNING_SECRET.length < 32) blocking.push('LINK_SIGNING_SECRET must be set (≥ 32 random characters).');
if (config.fetchMode !== 'live') blocking.push('FETCH_MODE must be "live" in production.');
if (config.rateLimitMode === 'off') blocking.push('RATE_LIMIT_MODE=off is for local tests only.');
if (!config.siteUrl.startsWith('https://')) blocking.push('PUBLIC_SITE_URL must be https.');
if (config.ads.enabled && !config.ads.clientId) blocking.push('ADS_ENABLED requires ADSENSE_CLIENT_ID.');

const status = (ok: boolean) => (ok ? 'yes' : 'no ');
console.log(`provider            ${config.provider}`);
console.log(`site                ${config.siteUrl}`);
console.log(`aliexpress keys     ${status(!!(config.aliexpress.appKey && config.aliexpress.appSecret))}`);
console.log(`aliexpress tracking ${status(!!config.aliexpress.trackingId)}`);
console.log(`awin                ${status(!!(config.awin.publisherId && config.awin.apiToken))}`);
console.log(`supabase            ${status(!!(config.supabase.url && config.supabase.serviceRoleKey))}`);
console.log(`admin               ${status(!!(config.admin.user && config.admin.password))}`);
console.log(`robots policy       ${config.robotsPolicy}`);
for (const w of config.warnings) console.log(`warning: ${w}`);
for (const b of blocking) console.log(`BLOCKING: ${b}`);
process.exit(blocking.length ? 1 : 0);
