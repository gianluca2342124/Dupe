import { handle } from '@astrojs/cloudflare/handler';
import { capturePrefixedUrl } from './lib/url/capture';
import { getServices } from './lib/server/services';
import { SECURITY_HEADERS } from './lib/server/request';
import { handleScheduled } from '../workers/scheduled';

/**
 * Worker entry.
 *
 * 1. Prefix capture: `https://gemelu.com/https://www.ikea.com/es/es/p/…` is
 *    detected here, on the raw request URL, *before* Astro's router can
 *    collapse `//` or redirect trailing slashes. It is internally rewritten to
 *    `/buscar?url=…&via=prefix` — no redirect, so the address bar keeps the
 *    link the user typed (and shared links teach the trick).
 * 2. Security headers on every dynamic HTML response.
 * 3. Cron triggers (commission imports, data retention).
 */

function contentSecurityPolicy(adsEnabled: boolean): string {
  const ads = adsEnabled
    ? {
        script: ' https://pagead2.googlesyndication.com https://*.googlesyndication.com https://*.doubleclick.net https://fundingchoicesmessages.google.com',
        frame: " https://*.googlesyndication.com https://*.doubleclick.net https://www.google.com",
        connect: ' https://*.googlesyndication.com https://*.doubleclick.net https://fundingchoicesmessages.google.com',
      }
    : { script: '', frame: '', connect: '' };
  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com${ads.script}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self'",
    `connect-src 'self' https://cloudflareinsights.com${ads.connect}`,
    `frame-src 'none'${ads.frame}`.replace("'none' ", ''),
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join('; ');
}

function withSecurityHeaders(response: Response, adsEnabled: boolean): Response {
  const type = response.headers.get('content-type') ?? '';
  if (!type.includes('text/html') && !type.includes('application/json')) return response;
  const res = new Response(response.body, response);
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) if (!res.headers.has(k)) res.headers.set(k, v);
  if (type.includes('text/html')) res.headers.set('content-security-policy', contentSecurityPolicy(adsEnabled));
  return res;
}

export default {
  async fetch(request, env, ctx) {
    const services = getServices(env as unknown as Record<string, unknown>);
    const captured = request.method === 'GET' || request.method === 'HEAD' ? capturePrefixedUrl(request.url) : null;

    let target = request;
    if (captured) {
      const internal = new URL('/buscar', request.url);
      internal.searchParams.set('url', captured.target);
      internal.searchParams.set('via', 'prefix');
      target = new Request(internal.href, request) as typeof request;
    }

    const response = await handle(target, env, ctx);
    return withSecurityHeaders(response, services.config.ads.enabled);
  },

  async scheduled(controller, env, ctx) {
    const { config, store, logger, supabase } = getServices(env as unknown as Record<string, unknown>);
    ctx.waitUntil(
      handleScheduled(controller.cron, {
        config,
        store,
        logger,
        fetch: (input, init) => fetch(input, init),
        ...(supabase
          ? {
              supabaseRpc: async (fn: string, args: Record<string, unknown>) => {
                const { data, error } = await supabase.db.rpc(fn, args);
                if (error) throw new Error(error.message);
                return data;
              },
            }
          : {}),
      }),
    );
  },
} satisfies ExportedHandler<Env>;
