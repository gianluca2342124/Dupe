import { useState } from 'react';
import type { ResultItem } from '../../types/search';
import { CAVEAT_TEXT, deliveryText, LABEL_TEXT, money, number, savingsBasisText, TIER_HELP, TIER_LABEL } from '../../lib/format';

interface Props {
  item: ResultItem;
  index: number;
  searchId: string;
  providerLabel: string;
  onReport?: (item: ResultItem) => void;
}

const TIER_STYLE: Record<ResultItem['tier'], string> = {
  verified: 'bg-save text-white',
  very_similar: 'bg-ink text-paper',
  similar: 'bg-card/95 text-ink ring-1 ring-line-2',
  low_confidence: 'bg-card/95 text-ink-3 ring-1 ring-line-2',
};

function ShippingLine({ item }: { item: ResultItem }) {
  if (item.shippingCost) {
    return item.shippingCost.amount === 0 ? (
      <span className="text-save">Envío gratis</span>
    ) : (
      <span>+ {money(item.shippingCost)} de envío</span>
    );
  }
  return <span className="text-ink-3">Envío no indicado</span>;
}

export default function ResultCard({ item, index, onReport }: Props) {
  const [imgOk, setImgOk] = useState(true);
  const [reported, setReported] = useState(false);
  const delivery = deliveryText(item.deliveryDays);
  const positiveRate = item.rating && item.rating.count === null;
  const caveats = item.caveats.map((c) => CAVEAT_TEXT[c]).filter((c): c is string => !!c && c !== CAVEAT_TEXT.shipping_unknown);

  return (
    <article
      className="card flex animate-rise flex-col overflow-hidden"
      style={{ animationDelay: `${Math.min(index, 8) * 45}ms` }}
      data-testid="result-card"
      data-tier={item.tier}
    >
      <div className="relative aspect-square bg-sand">
        {item.image && imgOk ? (
          <img
            src={item.image}
            alt={item.shortTitle}
            loading={index < 4 ? 'eager' : 'lazy'}
            decoding="async"
            referrerPolicy="no-referrer"
            onError={() => setImgOk(false)}
            className="size-full object-cover"
            width={400}
            height={400}
          />
        ) : (
          <div className="flex size-full items-center justify-center text-xs text-ink-3">Sin imagen</div>
        )}
        <div className="absolute inset-x-2 top-2 flex flex-wrap items-start justify-between gap-1">
          <span className={`chip shadow-sm ${TIER_STYLE[item.tier]}`} title={TIER_HELP[item.tier]}>
            {TIER_LABEL[item.tier]}
          </span>
          {item.isDemo && <span className="chip bg-demo-soft text-demo">DEMO</span>}
        </div>
        {item.labels.length > 0 && (
          <div className="absolute bottom-2 left-2 flex flex-wrap gap-1">
            {item.labels.map((l) => (
              <span key={l} className={`chip shadow-sm ${l === 'cheapest' ? 'bg-save text-white' : 'bg-terracotta text-white'}`}>
                {LABEL_TEXT[l]}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col p-3 sm:p-4">
        <h3 className="line-clamp-2 min-h-[2.5em] text-[13px] leading-[1.25] text-ink-2 sm:text-sm" title={item.title}>
          {item.shortTitle}
        </h3>

        <div className="mt-2 flex items-baseline gap-1.5">
          {item.priceIsFrom && <span className="text-xs text-ink-3">desde</span>}
          <p className="text-lg font-semibold tabular-nums tracking-tight sm:text-xl" data-testid="result-price">
            {money(item.price)}
          </p>
          {item.isDemo && <span className="text-[11px] text-demo">ficticio</span>}
        </div>
        <p className="text-xs text-ink-2">
          <ShippingLine item={item} />
          {item.totalPrice && item.shippingCost && item.shippingCost.amount > 0 && (
            <span className="text-ink-3"> · Total {money(item.totalPrice)}</span>
          )}
        </p>

        {item.savings && (
          <p className="mt-2 inline-flex w-fit flex-wrap items-baseline gap-x-1 rounded-lg bg-save-soft px-2 py-1 text-xs font-semibold text-save" data-testid="result-savings">
            Ahorras {money(item.savings.amount)} ({item.savings.percent} %)
            <span className="font-normal opacity-80">{savingsBasisText(item.savings.basis)}</span>
          </p>
        )}

        <div className="mt-2 space-y-0.5 text-xs text-ink-3">
          {delivery && <p>{delivery}</p>}
          {item.rating &&
            (positiveRate ? (
              <p>{Math.round(item.rating.value * 20)} % de valoraciones positivas</p>
            ) : (
              <p>
                <span aria-hidden="true">★</span> {item.rating.value.toFixed(1).replace('.', ',')}
                {item.rating.count !== null && ` (${number(item.rating.count)})`}
              </p>
            ))}
          {item.orders !== null && item.orders > 0 && <p>{number(item.orders)} vendidos</p>}
          {caveats.map((c) => (
            <p key={c} className="text-ink-2">
              {c}
            </p>
          ))}
        </div>

        <div className="mt-auto pt-3">
          <a
            href={item.goUrl}
            target="_blank"
            rel={item.isAffiliate ? 'sponsored nofollow noopener' : 'nofollow noopener'}
            className={`btn w-full !min-h-10 !px-3 text-sm ${item.isDemo ? 'btn-ghost' : 'btn-accent'}`}
            data-testid="result-cta"
          >
            {item.isDemo ? 'Ver ejemplo' : 'Ver en AliExpress'}
          </a>
          <div className="mt-2 flex items-center justify-between gap-2 whitespace-nowrap text-[11px] text-ink-3">
            <span title={item.isAffiliate ? 'Enlace de afiliación: podemos recibir una comisión' : undefined}>
              {item.isAffiliate ? 'Afiliado' : item.isDemo ? 'Ficticio' : ''}
            </span>
            {onReport && (
              <button
                type="button"
                className="underline-offset-2 hover:text-ink hover:underline disabled:no-underline"
                disabled={reported}
                onClick={() => {
                  setReported(true);
                  onReport(item);
                }}
              >
                {reported ? 'Gracias' : '¿No se parece?'}
              </button>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
