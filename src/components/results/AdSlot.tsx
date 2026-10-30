import { useEffect, useRef } from 'react';

interface Props {
  enabled: boolean;
  client: string | null;
  slot: string | null;
}

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

/**
 * Optional Google AdSense unit, disabled by default (ADS_ENABLED=false).
 * Clearly labelled, placed between result rows, never styled like a result.
 * In the EEA, personalised ads require a Google-certified CMP — see docs/DEPLOYMENT.md.
 */
export default function AdSlot({ enabled, client, slot }: Props) {
  const ref = useRef<HTMLModElement>(null);
  useEffect(() => {
    if (!enabled || !client || !slot) return;
    const id = 'adsbygoogle-js';
    if (!document.getElementById(id)) {
      const s = document.createElement('script');
      s.id = id;
      s.async = true;
      s.crossOrigin = 'anonymous';
      s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(client)}`;
      document.head.appendChild(s);
    }
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      // ignore
    }
  }, [enabled, client, slot]);

  if (!enabled || !client || !slot) return null;
  return (
    <aside className="col-span-full rounded-2xl border border-dashed border-line-2 p-3" aria-label="Publicidad">
      <p className="mb-2 text-[11px] uppercase tracking-wider text-ink-3">Publicidad</p>
      <ins ref={ref} className="adsbygoogle block" style={{ display: 'block' }} data-ad-client={client} data-ad-slot={slot} data-ad-format="auto" data-full-width-responsive="true" />
    </aside>
  );
}
