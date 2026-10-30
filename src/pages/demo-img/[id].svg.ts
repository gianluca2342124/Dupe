import type { APIRoute, GetStaticPaths } from 'astro';
import { DEMO_EXAMPLES, DEMO_ITEMS } from '../../lib/providers/demo/catalog';
import { renderIllustration } from '../../lib/providers/demo/illustrations';

// Generated once at build time → served as static files (no Worker cost).
export const prerender = true;

export const getStaticPaths = (() => [
  ...DEMO_ITEMS.map((item) => ({ params: { id: item.id }, props: { svg: renderIllustration(item.kind, item.palette, `Ilustración DEMO: ${item.title}`) } })),
  ...DEMO_EXAMPLES.map((ex) => ({
    params: { id: `example-${ex.slug}` },
    props: { svg: renderIllustration(ex.kind, ex.palette, `Ilustración de ejemplo: ${ex.title}`) },
  })),
]) satisfies GetStaticPaths;

export const GET: APIRoute = ({ props }) =>
  new Response(props.svg as string, {
    headers: { 'content-type': 'image/svg+xml; charset=utf-8', 'cache-control': 'public, max-age=86400' },
  });
