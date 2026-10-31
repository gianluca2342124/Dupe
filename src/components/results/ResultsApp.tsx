import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  EntryMode,
  Notice,
  PublicSourceProduct,
  ResultItem,
  SearchErrorCode,
  SearchEvent,
  SearchResultPayload,
  SearchStage,
} from '../../types/search';
import { money, relativeTime } from '../../lib/format';
import { useNow } from '../useNow';
import UrlForm from '../UrlForm';
import AdSlot from './AdSlot';
import ErrorState from './ErrorState';
import ProgressSteps, { ResultSkeletons } from './ProgressSteps';
import ResultCard from './ResultCard';
import ShareBar from './ShareBar';
import SourceCard from './SourceCard';
import { reportMismatch, track } from './track';

export interface ResultsAppProps {
  /** What to search: a product URL or a free-text description. */
  query: { kind: 'url'; url: string } | { kind: 'text'; q: string } | { kind: 'example'; slug: string };
  via: EntryMode;
  initialResult: SearchResultPayload | null;
  initialError: { code: SearchErrorCode; message: string; suggestion?: string | null } | null;
  initialStoreName: string | null;
  shareUrl: string;
  domain: string;
  providerLabel: string;
  ads: { enabled: boolean; client: string | null; slot: string | null };
}

type State =
  | { phase: 'running'; stage: SearchStage; source: PublicSourceProduct | null; progress: { stage: SearchStage; done: number; total: number } | null }
  | { phase: 'done'; result: SearchResultPayload }
  | { phase: 'error'; code: SearchErrorCode; message: string; suggestion?: string | null; source: PublicSourceProduct | null };

async function streamSearch(body: unknown, onEvent: (e: SearchEvent) => void, signal: AbortSignal) {
  const res = await fetch('/api/search', {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'text/event-stream' },
    body: JSON.stringify(body),
    signal,
  });
  if (res.status === 429) {
    onEvent({ type: 'error', code: 'rate_limited', message: 'Has hecho muchas búsquedas seguidas. Espera un minuto y vuelve a probar.' });
    return;
  }
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;
    let idx: number;
    while ((idx = buffer.indexOf('\n\n')) >= 0) {
      const chunk = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      const data = chunk
        .split('\n')
        .filter((l) => l.startsWith('data:'))
        .map((l) => l.slice(5).trimStart())
        .join('\n');
      if (data) onEvent(JSON.parse(data) as SearchEvent);
    }
  }
}

const PRIMARY_NOTICES: Notice['kind'][] = ['demo', 'url_only', 'text_query', 'low_confidence_only'];

function NoticeList({ notices }: { notices: Notice[] }) {
  const primary = notices.filter((n) => PRIMARY_NOTICES.includes(n.kind));
  if (!primary.length) return null;
  return (
    <ul className="space-y-2" data-testid="notices">
      {primary.map((n) => (
        <li
          key={n.kind}
          data-kind={n.kind}
          className={[
            'flex gap-2.5 rounded-2xl px-4 py-3 text-[13px] leading-relaxed sm:text-sm',
            n.kind === 'demo' ? 'bg-demo-soft text-demo' : 'bg-sand text-ink-2',
          ].join(' ')}
        >
          <span aria-hidden="true" className="mt-px shrink-0">
            {n.kind === 'demo' ? '◆' : 'ⓘ'}
          </span>
          <span>{n.message}</span>
        </li>
      ))}
    </ul>
  );
}

/** URL-only results: let people correct the name we searched for. */
function RefineSearch({ initial }: { initial: string }) {
  const [q, setQ] = useState(initial);

  function onSubmit(e: { preventDefault(): void }) {
    e.preventDefault();
    const text = q.trim();
    if (text.length >= 4) window.location.assign(`/buscar?q=${encodeURIComponent(text)}`);
  }

  return (
    <form onSubmit={onSubmit} className="card flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:gap-4" role="search" data-testid="refine-search">
      <label htmlFor="refine" className="shrink-0 text-sm font-semibold">
        ¿No es exactamente esto? Descríbelo:
      </label>
      <div className="flex min-w-0 flex-1 items-center gap-2 rounded-full border border-line-2 bg-card p-1 pl-4">
        <input
          id="refine"
          name="q"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="h-10 min-w-0 flex-1 bg-transparent text-[15px] outline-none"
          data-testid="refine-input"
        />
        <button type="submit" className="btn btn-primary !min-h-10 !px-4 text-sm">
          Buscar
        </button>
      </div>
    </form>
  );
}

/** Secondary caveats, shown as quiet footnotes under the summary. */
function MinorNotices({ notices }: { notices: Notice[] }) {
  const minor = notices.filter((n) => !PRIMARY_NOTICES.includes(n.kind));
  if (!minor.length) return null;
  return (
    <ul className="mt-2 space-y-1 text-[13px] leading-relaxed text-ink-3" data-testid="minor-notices">
      {minor.map((n) => (
        <li key={n.kind} data-kind={n.kind}>
          {n.message}
        </li>
      ))}
    </ul>
  );
}

function Summary({ result }: { result: SearchResultPayload }) {
  const now = useNow();
  const n = result.items.length;
  // Fictional demo prices are never compared with a real store price.
  const comparable = !(result.provider.isDemo && result.source.readMode !== 'example');
  const cheaper = comparable && !!result.source.price && n > 0 && result.items.every((i) => i.price && i.price.amount < result.source.price!.amount);
  const noun = n === 1 ? 'alternativa' : 'alternativas';
  const adjective = cheaper ? (n === 1 ? 'más barata' : 'más baratas') : n === 1 ? 'parecida' : 'parecidas';
  return (
    <div data-testid="summary">
      {n > 0 ? (
        <h2 className="display text-3xl sm:text-4xl">
          Encontramos {n} {noun} {adjective}
        </h2>
      ) : (
        <h2 className="display text-3xl sm:text-4xl">No encontramos alternativas fiables</h2>
      )}
      <p className="mt-2 text-sm text-ink-2">
        {result.summary.maxSavings ? (
          <>
            Ahorro máximo:{' '}
            <strong className="font-semibold text-save" data-testid="max-savings">
              {money(result.summary.maxSavings.amount)} ({result.summary.maxSavings.percent} %)
            </strong>
            {result.summary.maxSavings.basis === 'item_price_only' ? ' sin contar el envío' : ' con envío incluido'}.{' '}
          </>
        ) : null}
        {n > 0 && <>Ordenadas por parecido y utilidad de compra. </>}
        {result.provider.isDemo ? 'Precios del catálogo de demostración (ficticios)' : `Precios de ${result.provider.label}`}
        {now !== null ? `, comprobados ${relativeTime(result.createdAt, now)}` : ''}.
      </p>
      <MinorNotices notices={result.notices} />
    </div>
  );
}

export default function ResultsApp(props: ResultsAppProps) {
  const { query, via, initialResult, initialError, initialStoreName, shareUrl, domain, providerLabel, ads } = props;
  const [state, setState] = useState<State>(() =>
    initialResult
      ? { phase: 'done', result: initialResult }
      : initialError
        ? { phase: 'error', code: initialError.code, message: initialError.message, suggestion: initialError.suggestion ?? null, source: null }
        : { phase: 'running', stage: 'validating', source: null, progress: null },
  );
  const [showLow, setShowLow] = useState(false);
  const started = useRef(false);
  const shownTracked = useRef(false);

  const run = useCallback(() => {
    if (query.kind === 'example') return;
    const controller = new AbortController();
    setState({ phase: 'running', stage: 'validating', source: null, progress: null });
    const body = query.kind === 'url' ? { url: query.url, via } : { q: query.q, via };
    let lastSource: PublicSourceProduct | null = null;
    streamSearch(
      body,
      (e) => {
        if (e.type === 'stage') setState((s) => (s.phase === 'running' ? { ...s, stage: e.stage } : s));
        else if (e.type === 'progress') setState((s) => (s.phase === 'running' ? { ...s, progress: { stage: e.stage, done: e.done, total: e.total } } : s));
        else if (e.type === 'source') {
          lastSource = e.source;
          setState((s) => (s.phase === 'running' ? { ...s, source: e.source } : s));
        } else if (e.type === 'result') setState({ phase: 'done', result: e.result });
        else if (e.type === 'error') setState({ phase: 'error', code: e.code, message: e.message, source: e.source ?? lastSource, suggestion: e.source?.title ?? null });
      },
      controller.signal,
    ).catch(() => {
      setState((s) =>
        s.phase === 'done' ? s : { phase: 'error', code: 'internal', message: 'Se ha cortado la conexión. Comprueba tu red y vuelve a intentarlo.', source: null },
      );
    });
    return () => controller.abort();
  }, [query, via]);

  useEffect(() => {
    if (started.current || initialResult || initialError) return;
    started.current = true;
    run();
  }, [run, initialResult, initialError]);

  useEffect(() => {
    if (state.phase === 'done' && !shownTracked.current) {
      shownTracked.current = true;
      track('results_shown', state.result.id, state.result.items.length);
      document.title = state.result.source.title ? `Alternativas a ${state.result.source.title} · Gemelu` : document.title;
    }
  }, [state]);

  const onReport = useCallback(
    (item: ResultItem) => {
      if (state.phase !== 'done') return;
      void reportMismatch(state.result.id, item.id, state.result.source.canonicalUrl);
    },
    [state],
  );

  return (
    <div className="container-page max-w-6xl space-y-6 py-6 sm:space-y-8 sm:py-10" data-phase={state.phase}>
      {state.phase === 'running' && (
        <>
          {state.source ? (
            <SourceCard source={state.source} />
          ) : (
            <div className="card flex gap-4 p-4 sm:p-6" aria-hidden="true">
              <div className="size-28 shrink-0 animate-pulse-soft rounded-2xl bg-sand sm:size-48" />
              <div className="flex-1 space-y-3 pt-1">
                <div className="h-3 w-24 animate-pulse-soft rounded bg-sand" />
                <div className="h-5 w-4/5 animate-pulse-soft rounded bg-sand" />
                <div className="h-6 w-28 animate-pulse-soft rounded bg-sand" />
              </div>
            </div>
          )}
          <ProgressSteps
            stage={state.stage}
            storeName={state.source?.storeName ?? initialStoreName}
            providerName={providerLabel}
            progress={state.progress}
            skipReading={query.kind === 'text'}
          />
          <ResultSkeletons />
        </>
      )}

      {state.phase === 'error' && (
        <>
          {state.source && <SourceCard source={state.source} />}
          <ErrorState code={state.code} message={state.message} suggestion={state.suggestion ?? null} onRetry={query.kind !== 'example' ? run : undefined} />
        </>
      )}

      {state.phase === 'done' && (
        <>
          <SourceCard source={state.result.source} />
          <NoticeList notices={state.result.notices} />
          {state.result.source.readMode === 'url-only' && <RefineSearch initial={state.result.source.title ?? ''} />}
          <Summary result={state.result} />

          {state.result.items.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4" data-testid="results-grid">
              {state.result.items.map((item, i) => (
                <ResultCardWithAd key={item.id} item={item} index={i} searchId={state.result.id} providerLabel={state.result.provider.label} onReport={onReport} ads={ads} />
              ))}
            </div>
          ) : (
            <div className="card p-6 text-[15px] leading-relaxed text-ink-2" data-testid="no-results">
              {state.result.provider.isDemo
                ? 'El catálogo de demostración solo tiene unos 80 artículos de hogar y decoración inventados, y ninguno se parece a este producto. Con AliExpress conectado buscaríamos entre millones de productos reales.'
                : 'Preferimos no enseñarte nada antes que algo que no se parece. Prueba con otro producto o con un enlace de otra tienda.'}
            </div>
          )}

          {state.result.lowConfidenceItems.length > 0 && (
            <section aria-label="Coincidencias de baja confianza">
              <button type="button" className="btn btn-ghost text-sm" aria-expanded={showLow} onClick={() => setShowLow((v) => !v)} data-testid="toggle-low">
                {showLow ? 'Ocultar' : 'Ver'} {state.result.lowConfidenceItems.length} coincidencias de baja confianza
              </button>
              {showLow && (
                <div className="mt-4 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
                  {state.result.lowConfidenceItems.map((item, i) => (
                    <ResultCard key={item.id} item={item} index={i} searchId={state.result.id} providerLabel={state.result.provider.label} onReport={onReport} />
                  ))}
                </div>
              )}
            </section>
          )}

          <ShareBar result={state.result} shareUrl={shareUrl} domain={domain} />

          <p className="max-w-3xl text-xs leading-relaxed text-ink-3">
            Las tiendas fijan sus precios, gastos de envío y condiciones, que pueden cambiar en cualquier momento: compruébalos antes de comprar. Una alternativa
            similar no tiene por qué ser del mismo fabricante ni tener la misma calidad. Algunos enlaces son de afiliación: si compras, podemos recibir una
            comisión sin coste extra para ti. <a href="/afiliacion" className="underline underline-offset-2">Cómo funciona</a>.
          </p>
        </>
      )}

      {state.phase !== 'error' && (
        <section id="otro-producto" className="scroll-mt-24 pt-4" aria-label="Buscar otro producto">
          <p className="text-sm font-semibold">Probar con otro producto</p>
          <div className="mt-2 max-w-2xl">
            <UrlForm size="compact" />
          </div>
        </section>
      )}
    </div>
  );
}

function ResultCardWithAd({
  item,
  index,
  searchId,
  providerLabel,
  onReport,
  ads,
}: {
  item: ResultItem;
  index: number;
  searchId: string;
  providerLabel: string;
  onReport: (item: ResultItem) => void;
  ads: ResultsAppProps['ads'];
}) {
  return (
    <>
      <ResultCard item={item} index={index} searchId={searchId} providerLabel={providerLabel} onReport={onReport} />
      {index === 3 && <AdSlot enabled={ads.enabled} client={ads.client} slot={ads.slot} />}
    </>
  );
}
