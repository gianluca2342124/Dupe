import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { z } from 'zod';
import type { SearchEvent } from '../../types/search';
import { getServices } from '../../lib/server/services';
import { clientKey, country, deviceClass, entryModeFrom, referrerDomain, utmFrom } from '../../lib/server/request';
import { errorMessage, SearchError } from '../../lib/search/service';
import { toPublicSource } from '../../lib/search/present';

export const prerender = false;

const Body = z.union([
  z.object({ url: z.string().min(1).max(4096), via: z.string().max(20).optional() }),
  z.object({ q: z.string().min(1).max(300), via: z.string().max(20).optional() }),
]);

/**
 * POST /api/search → text/event-stream of SearchEvent.
 * Every "stage" event corresponds to real work done on the server.
 */
export const POST: APIRoute = async ({ request, locals }) => {
  const services = getServices(env as unknown as Record<string, unknown>);
  const { search, searchLimiter, config, logger } = services;

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await request.json());
  } catch {
    return Response.json({ error: 'invalid_request' }, { status: 400 });
  }

  // Cached results are cheap: serve them without spending the rate limit.
  if ('url' in body) {
    const cached = await search.cached(body.url).catch(() => null);
    if (cached) return sse([{ type: 'source', source: cached.source }, { type: 'stage', stage: 'done' }, { type: 'result', result: cached }]);
  }

  const { success } = await searchLimiter.limit(`search:${clientKey(request)}`);
  if (!success) return Response.json({ error: 'rate_limited' }, { status: 429, headers: { 'retry-after': '60' } });

  const encoder = new TextEncoder();
  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer = writable.getWriter();
  let closed = false;
  const emit = (e: SearchEvent) => {
    if (closed) return;
    writer.write(encoder.encode(`data: ${JSON.stringify(e)}\n\n`)).catch(() => {
      closed = true;
    });
  };

  const ctx = {
    entryMode: entryModeFrom(body.via),
    waitUntil: (p: Promise<unknown>) => locals.cfContext?.waitUntil(p),
    deviceClass: deviceClass(request.headers.get('user-agent')),
    country: country(request),
    referrerDomain: referrerDomain(request, [new URL(config.siteUrl).hostname, new URL(request.url).hostname]),
    utm: utmFrom(new URL(request.url).searchParams),
  };

  const work = (async () => {
    try {
      const result = 'url' in body ? await search.searchUrl(body.url, ctx, emit) : await search.searchText(body.q, ctx, emit);
      emit({ type: 'result', result });
    } catch (err) {
      if (err instanceof SearchError) {
        emit({ type: 'error', code: err.code, message: err.message, ...(err.source ? { source: toPublicSource(err.source) } : {}) });
      } else {
        logger.error('search endpoint failure', { error: (err as Error).message });
        emit({ type: 'error', code: 'internal', message: errorMessage('internal') });
      }
    } finally {
      closed = true;
      await writer.close().catch(() => undefined);
    }
  })();
  locals.cfContext?.waitUntil(work);

  return new Response(readable, {
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-store',
      'x-accel-buffering': 'no',
    },
  });
};

function sse(events: SearchEvent[]): Response {
  const body = events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join('');
  return new Response(body, { headers: { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-store' } });
}
