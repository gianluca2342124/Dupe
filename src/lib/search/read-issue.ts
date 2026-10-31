import type { ReadIssue } from '../../types/product';

/**
 * Plain-language reason why a store page could not be read. Only blames the
 * store when the store actually refused (bot wall, robots.txt); timeouts and
 * network errors are reported as such.
 */

const BLOCK_LABEL: Record<string, string> = {
  cloudflare: 'la protección antibots de Cloudflare',
  akamai: 'la protección antibots de Akamai',
  datadome: 'la protección antibots de DataDome',
  perimeterx: 'la protección antibots de HUMAN',
  imperva: 'la protección antibots de Imperva',
  amazon_captcha: 'un CAPTCHA',
  generic_captcha: 'un CAPTCHA',
  access_denied: 'un «acceso denegado»',
  rate_limited: 'un límite de visitas',
};

const DETAIL_LABEL: Record<string, string> = {
  timeout: 'no respondió a tiempo',
  network: 'error de red',
  dns_failed: 'error de DNS',
  too_many_redirects: 'demasiadas redirecciones',
  invalid_url: 'redirección no válida',
};

export function readIssueText(store: string, issue: ReadIssue | null | undefined): string {
  const detail = issue?.detail ? (DETAIL_LABEL[issue.detail] ?? issue.detail) : null;
  const hint = detail ? ` (${detail})` : '';
  switch (issue?.reason) {
    case 'blocked':
      return `${store} no deja que programas automáticos como Gemelu lean sus fichas${issue.block ? ` (responde con ${BLOCK_LABEL[issue.block] ?? 'un bloqueo'})` : ''}. No intentamos saltarnos ese bloqueo.`;
    case 'robots_disallowed':
      return `${store} pide en su robots.txt que los programas automáticos no lean esta página, y lo respetamos.`;
    case 'robots_unreachable':
      return `No hemos podido consultar el robots.txt de ${store}${hint}; sin él, por prudencia, no leemos su página.`;
    case 'timeout':
      return `${store} no ha respondido a tiempo.`;
    case 'http_error':
      return `${store} ha respondido con un error${hint}.`;
    case 'too_large':
      return `La página de ${store} es demasiado grande para leerla.`;
    case 'unsupported_content':
      return `El enlace de ${store} no lleva a una página web de producto.`;
    case 'not_product':
      return `No hemos encontrado los datos del producto en la página de ${store}.`;
    case 'blocked_host':
      return 'No podemos abrir esa dirección.';
    default:
      return `No hemos podido conectar con ${store}${hint}.`;
  }
}
