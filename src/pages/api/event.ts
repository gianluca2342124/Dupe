import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { z } from 'zod';
import { getServices } from '../../lib/server/services';
import { clientKey, country, deviceClass, utmFrom } from '../../lib/server/request';

export const prerender = false;

const Event = z.object({
  type: z.enum(['pageview', 'share', 'copy_link', 'results_shown']),
  path: z.string().max(200).optional(),
  ref: z.string().max(120).optional().nullable(),
  searchId: z.string().max(40).optional().nullable(),
  value: z.number().int().min(0).max(1000).optional().nullable(),
  utm_source: z.string().max(80).optional().nullable(),
  utm_medium: z.string().max(80).optional().nullable(),
  utm_campaign: z.string().max(80).optional().nullable(),
});

/** Cookieless beacon. Stores no identifiers: no IP, no user agent, no session id. */
export const POST: APIRoute = async ({ request, locals }) => {
  const { store, clickLimiter } = getServices(env as unknown as Record<string, unknown>);
  const { success } = await clickLimiter.limit(`event:${clientKey(request)}`);
  if (!success) return new Response(null, { status: 204 });
  let e: z.infer<typeof Event>;
  try {
    e = Event.parse(await request.json());
  } catch {
    return new Response(null, { status: 400 });
  }
  const device = deviceClass(request.headers.get('user-agent'));
  if (device === 'bot') return new Response(null, { status: 204 });
  const utm = utmFrom(e as Record<string, unknown>);
  locals.cfContext?.waitUntil(
    store
      .logEvent({
        type: e.type,
        at: new Date().toISOString(),
        searchId: e.searchId ?? null,
        path: e.path?.startsWith('/') ? e.path.replace(/^\/https?:.*/i, '/[producto]') : null,
        referrerDomain: e.ref ? e.ref.replace(/^www\./, '') : null,
        utmSource: utm.source,
        utmMedium: utm.medium,
        utmCampaign: utm.campaign,
        deviceClass: device,
        country: country(request),
        value: e.value ?? null,
      })
      .catch(() => undefined),
  );
  return new Response(null, { status: 204 });
};
