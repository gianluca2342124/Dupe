import { useState } from 'react';
import type { PublicSourceProduct } from '../../types/search';
import { money, relativeTime } from '../../lib/format';
import { useNow } from '../useNow';

interface Props {
  source: PublicSourceProduct;
}

export default function SourceCard({ source }: Props) {
  const [imgOk, setImgOk] = useState(true);
  const now = useNow();
  const isExample = source.readMode === 'example';
  const isText = source.readMode === 'text';
  return (
    <section aria-label="Producto original" className="card animate-rise p-4 sm:p-6" data-testid="source-card">
      <div className="flex gap-4 sm:gap-6">
        <div className="relative size-28 shrink-0 overflow-hidden rounded-2xl bg-sand sm:size-48">
          {source.image && imgOk ? (
            <img
              src={source.image}
              alt={source.title ?? 'Producto original'}
              className="size-full object-cover"
              referrerPolicy="no-referrer"
              onError={() => setImgOk(false)}
              width={192}
              height={192}
            />
          ) : (
            <div className="flex size-full items-center justify-center p-3 text-center text-xs text-ink-3">
              {source.readMode === 'url-only' ? 'Sin foto: no hemos podido leer la ficha' : 'Sin foto'}
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="eyebrow">{isExample ? 'Original de ejemplo' : isText ? 'Tu búsqueda' : `Original · ${source.storeName}`}</p>
          <h1 className="mt-1.5 line-clamp-3 text-[17px] font-semibold leading-snug tracking-tight sm:text-2xl" data-testid="source-title">
            {source.title ?? 'Producto sin título'}
          </h1>
          <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            {source.price ? (
              <p className="text-xl font-semibold tabular-nums sm:text-2xl" data-testid="source-price">
                {source.priceIsRange ? 'desde ' : ''}
                {money(source.price)}
              </p>
            ) : (
              <p className="text-sm text-ink-3">{source.readMode === 'url-only' ? 'Precio no disponible' : 'Precio no indicado'}</p>
            )}
            {source.availability === 'out_of_stock' && <span className="chip bg-sand text-ink-2">Agotado en la tienda</span>}
          </div>
          {source.highlights.length > 0 && <p className="mt-1.5 line-clamp-1 text-sm text-ink-3">{source.highlights.join(' · ')}</p>}
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            {!isExample && !isText && (
              <a href={source.url} target="_blank" rel="noopener noreferrer nofollow" className="font-semibold text-ink underline decoration-line-2 underline-offset-4 hover:decoration-ink">
                Ver en {source.storeName}
                <span aria-hidden="true"> ↗</span>
              </a>
            )}
            {source.readMode === 'page' && now !== null && <span className="text-ink-3">Comprobado {relativeTime(source.checkedAt, now)}</span>}
          </div>
        </div>
      </div>
    </section>
  );
}
