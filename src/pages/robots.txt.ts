import type { APIRoute } from 'astro';

export const prerender = true;

/**
 * Search results are generated on demand for any URL: they are ephemeral and
 * must not be indexed (also marked noindex). Only curated pages are crawlable.
 */
export const GET: APIRoute = ({ site }) => {
  const origin = (site?.href ?? 'https://gemelu.com/').replace(/\/$/, '');
  const body = [
    'User-agent: *',
    'Disallow: /buscar',
    'Disallow: /go/',
    'Disallow: /api/',
    'Disallow: /admin',
    'Disallow: /ejemplo/',
    'Disallow: /http',
    'Allow: /',
    '',
    `Sitemap: ${origin}/sitemap-index.xml`,
    '',
  ].join('\n');
  return new Response(body, { headers: { 'content-type': 'text/plain; charset=utf-8' } });
};
