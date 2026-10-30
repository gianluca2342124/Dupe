import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { z } from 'zod';
import { getServices } from '../../lib/server/services';
import { clientKey } from '../../lib/server/request';
import { cleanText } from '../../lib/security/sanitize';
import { randomId } from '../../lib/security/crypto';

export const prerender = false;

const Body = z.object({
  searchId: z.string().max(40).nullable().optional(),
  providerProductId: z.string().max(120).nullable().optional(),
  sourceUrl: z.string().max(2048).nullable().optional(),
  kind: z.enum(['not_similar', 'wrong_price', 'unavailable', 'counterfeit', 'other']),
  note: z.string().max(500).nullable().optional(),
});

/** "¿No se parece?" feedback → product_corrections queue (reviewed in /admin). */
export const POST: APIRoute = async ({ request, locals }) => {
  const { store, clickLimiter } = getServices(env as unknown as Record<string, unknown>);
  const { success } = await clickLimiter.limit(`correction:${clientKey(request)}`);
  if (!success) return Response.json({ error: 'rate_limited' }, { status: 429 });
  let b: z.infer<typeof Body>;
  try {
    b = Body.parse(await request.json());
  } catch {
    return Response.json({ error: 'invalid_request' }, { status: 400 });
  }
  locals.cfContext?.waitUntil(
    store
      .saveCorrection({
        id: randomId(9),
        at: new Date().toISOString(),
        searchId: b.searchId ?? null,
        sourceUrl: b.sourceUrl ? cleanText(b.sourceUrl, 2048) : null,
        providerProductId: b.providerProductId ?? null,
        kind: b.kind,
        note: b.note ? cleanText(b.note, 500) : null,
        status: 'open',
      })
      .catch(() => undefined),
  );
  return new Response(null, { status: 204 });
};
