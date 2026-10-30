import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { ALGORITHM_VERSION } from '../../config/matching';
import { getServices } from '../../lib/server/services';

export const prerender = false;

/**
 * Health check. Reports configuration *status* (never values) so uptime
 * monitors and the deploy checklist can verify a release.
 * `?deep=1` also pings the provider (costs one API call).
 */
export const GET: APIRoute = async ({ url }) => {
  const { config, store, provider, cache } = getServices(env as unknown as Record<string, unknown>);
  const deep = url.searchParams.get('deep') === '1';
  const providerHealth = deep ? await provider.healthCheck().catch((e) => ({ ok: false, configured: true, message: (e as Error).message })) : null;
  const body = {
    ok: providerHealth ? providerHealth.ok : true,
    time: new Date().toISOString(),
    algorithm: ALGORITHM_VERSION,
    provider: { id: provider.id, demo: provider.capabilities.isDemo, ...(providerHealth ? { health: providerHealth } : {}) },
    store: store.kind,
    fetchMode: config.fetchMode,
    robotsPolicy: config.robotsPolicy,
    rateLimit: config.rateLimitMode,
    cache: { inflight: cache.inflightCount },
    configured: {
      aliexpress: !!(config.aliexpress.appKey && config.aliexpress.appSecret),
      aliexpressTracking: !!config.aliexpress.trackingId,
      awin: !!(config.awin.publisherId && config.awin.apiToken),
      supabase: !!(config.supabase.url && config.supabase.serviceRoleKey),
      linkSigningSecret: config.warnings.every((w) => !w.startsWith('LINK_SIGNING_SECRET')),
      admin: !!(config.admin.user && config.admin.password),
      vision: config.vision.provider !== 'none' && !!config.vision.apiKey,
      ads: config.ads.enabled,
    },
    // Details of configuration problems are only shown in /admin.
    warnings: config.warnings.length,
  };
  return Response.json(body, { status: body.ok ? 200 : 503, headers: { 'cache-control': 'no-store' } });
};
