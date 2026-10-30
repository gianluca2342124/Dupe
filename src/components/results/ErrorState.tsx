import { useState } from 'react';
import type { SearchErrorCode } from '../../types/search';
import UrlForm from '../UrlForm';

interface Props {
  code: SearchErrorCode;
  message: string;
  /** Suggested description (e.g. from the URL) to prefill the text search. */
  suggestion?: string | null;
  onRetry?: () => void;
}

const TITLES: Partial<Record<SearchErrorCode, string>> = {
  invalid_url: 'Ese enlace no es de un producto',
  invalid_query: 'Necesitamos un poco más de detalle',
  not_a_product: 'Esa página no es la ficha de un producto',
  store_blocked: 'La tienda no nos deja leer esta página',
  robots_disallowed: 'La tienda no permite la lectura automática',
  fetch_failed: 'No hemos podido abrir la página',
  timeout: 'La tienda ha tardado demasiado',
  provider_unavailable: 'Error temporal del buscador de alternativas',
  rate_limited: 'Vas muy rápido',
  budget_exceeded: 'Hemos llegado al límite de hoy',
  internal: 'Algo ha fallado',
  own_domain: 'Ese enlace ya es de Gemelu',
  blocked_host: 'No podemos analizar ese dominio',
};

const CAN_DESCRIBE: SearchErrorCode[] = ['store_blocked', 'robots_disallowed', 'fetch_failed', 'timeout', 'not_a_product', 'too_large', 'unsupported_content', 'invalid_query'];
const CAN_RETRY: SearchErrorCode[] = ['fetch_failed', 'timeout', 'provider_unavailable', 'internal', 'rate_limited'];

export default function ErrorState({ code, message, suggestion, onRetry }: Props) {
  const [query, setQuery] = useState(suggestion ?? '');

  function onDescribe(e: { preventDefault(): void }) {
    e.preventDefault();
    const q = query.trim();
    if (q.length >= 4) window.location.assign(`/buscar?q=${encodeURIComponent(q)}`);
  }

  return (
    <section className="card animate-rise p-5 sm:p-8" role="alert" data-testid="error-state" data-code={code}>
      <p className="eyebrow">No ha podido ser</p>
      <h2 className="display mt-2 text-3xl sm:text-4xl">{TITLES[code] ?? 'No hemos podido completar la búsqueda'}</h2>
      {code === 'store_blocked' || code === 'robots_disallowed' ? (
        <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-ink-2">
          Algunas tiendas bloquean la lectura automática de sus páginas. Respetamos esa decisión y no intentamos saltárnosla.
        </p>
      ) : (
        <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-ink-2">{message}</p>
      )}

      {CAN_DESCRIBE.includes(code) && (
        <form onSubmit={onDescribe} className="mt-6 max-w-xl" role="search">
          <label htmlFor="describe" className="text-sm font-semibold">
            Descríbelo y buscamos igualmente
          </label>
          <div className="mt-2 flex items-center gap-2 rounded-full border border-line-2 bg-card p-1 pl-4">
            <input
              id="describe"
              name="q"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ej.: lámpara seta de cristal"
              className="h-10 min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-ink-3"
              data-testid="describe-input"
            />
            <button type="submit" className="btn btn-primary !min-h-10 !px-4 text-sm">
              Buscar
            </button>
          </div>
        </form>
      )}

      <div className="mt-6 max-w-xl">
        <p className="text-sm font-semibold">Prueba con otro enlace</p>
        <div className="mt-2">
          <UrlForm size="compact" />
        </div>
      </div>
      {onRetry && CAN_RETRY.includes(code) && (
        <button type="button" onClick={onRetry} className="btn btn-ghost mt-5 text-sm">
          Reintentar
        </button>
      )}
    </section>
  );
}
