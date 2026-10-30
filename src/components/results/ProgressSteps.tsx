import type { SearchStage } from '../../types/search';

interface Props {
  stage: SearchStage;
  storeName: string | null;
  providerName: string;
  progress: { stage: SearchStage; done: number; total: number } | null;
  /** Text searches skip the "reading" step. */
  skipReading?: boolean;
}

const ORDER: SearchStage[] = ['reading', 'analyzing', 'searching', 'comparing', 'done'];

/** Real progress: each step only turns active when the server reports that stage. */
export default function ProgressSteps({ stage, storeName, providerName, progress, skipReading }: Props) {
  const steps: { key: SearchStage; label: string }[] = [
    ...(skipReading ? [] : [{ key: 'reading' as const, label: storeName ? `Leyendo el producto en ${storeName}` : 'Leyendo el producto' }]),
    { key: 'analyzing', label: 'Analizando forma, material y color' },
    { key: 'searching', label: `Buscando alternativas en ${providerName}` },
    { key: 'comparing', label: 'Comparando y verificando resultados' },
  ];
  const current = stage === 'validating' ? -1 : ORDER.indexOf(stage);

  return (
    <ol className="card space-y-3 p-4 sm:p-5" aria-live="polite" data-testid="progress">
      {steps.map((s) => {
        const idx = ORDER.indexOf(s.key);
        const state = current > idx ? 'done' : current === idx ? 'active' : 'pending';
        const detail =
          state === 'active' && progress && progress.stage === s.key && progress.total > 0
            ? s.key === 'searching'
              ? ` · ${progress.done}/${progress.total} búsquedas`
              : ` · ${progress.done}/${progress.total}`
            : '';
        return (
          <li key={s.key} className="flex items-center gap-3 text-[15px]" data-state={state}>
            <span
              className={[
                'flex size-6 shrink-0 items-center justify-center rounded-full',
                state === 'done' ? 'bg-ink text-paper' : state === 'active' ? 'bg-terracotta-soft' : 'bg-sand',
              ].join(' ')}
              aria-hidden="true"
            >
              {state === 'done' ? (
                <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M3.5 8.5l3 3 6-7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : state === 'active' ? (
                <span className="size-2.5 animate-pulse-soft rounded-full bg-terracotta" />
              ) : (
                <span className="size-1.5 rounded-full bg-line-2" />
              )}
            </span>
            <span className={state === 'pending' ? 'text-ink-3' : 'text-ink'}>
              {s.label}
              <span className="text-ink-3">{detail}</span>
              <span className="sr-only">{state === 'done' ? ' (hecho)' : state === 'active' ? ' (en curso)' : ' (pendiente)'}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function ResultSkeletons({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="card overflow-hidden">
          <div className="aspect-square animate-pulse-soft bg-sand" />
          <div className="space-y-2 p-3">
            <div className="h-3 w-4/5 animate-pulse-soft rounded bg-sand" />
            <div className="h-3 w-3/5 animate-pulse-soft rounded bg-sand" />
            <div className="h-5 w-2/5 animate-pulse-soft rounded bg-sand" />
          </div>
        </div>
      ))}
    </div>
  );
}
