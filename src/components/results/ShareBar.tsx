import { useState } from 'react';
import type { SearchResultPayload } from '../../types/search';
import { money } from '../../lib/format';
import { track } from './track';
import { canMakeSavingsCard, makeSavingsCard } from './savingsCard';

interface Props {
  result: SearchResultPayload;
  shareUrl: string;
  domain: string;
}

/** Share the finding: native share sheet on mobile, copy link everywhere. */
export default function ShareBar({ result, shareUrl, domain }: Props) {
  const [copied, setCopied] = useState(false);
  const cheapest = result.summary.cheapestTotal;
  const title = result.source.title ? `Alternativas a ${result.source.title}` : 'Alternativas más baratas';
  const text = result.provider.isDemo
    ? `Mira cómo funciona ${domain}: pon ${domain}/ delante de un enlace y encuentra alternativas parecidas.`
    : cheapest
      ? `He encontrado alternativas parecidas desde ${money(cheapest)} con ${domain}`
      : `He encontrado alternativas parecidas con ${domain}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
      track('copy_link', result.id);
    } catch {
      window.prompt('Copia este enlace:', shareUrl);
    }
  }

  async function savingsCard() {
    const blob = await makeSavingsCard(result, domain);
    if (!blob) return;
    const file = new File([blob], 'gemelu-ahorro.png', { type: 'image/png' });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title, text: `${text} ${shareUrl}` });
        track('share', result.id);
        return;
      } catch {
        // fall back to download
      }
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'gemelu-ahorro.png';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
  }

  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ title, text, url: shareUrl });
        track('share', result.id);
        return;
      } catch {
        // cancelled or unsupported → fall back to copy
      }
    }
    await copy();
  }

  return (
    <div className="flex flex-wrap items-center gap-2" data-testid="share-bar">
      <button type="button" onClick={share} className="btn btn-primary text-sm">
        <svg viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <path d="M10 3v10M6 7l4-4 4 4M4 12v3.5A1.5 1.5 0 0 0 5.5 17h9a1.5 1.5 0 0 0 1.5-1.5V12" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Compartir este hallazgo
      </button>
      <button type="button" onClick={copy} className="btn btn-ghost text-sm" data-testid="copy-link">
        {copied ? '¡Enlace copiado!' : 'Copiar enlace'}
      </button>
      {canMakeSavingsCard(result) && (
        <button type="button" onClick={savingsCard} className="btn btn-ghost text-sm" data-testid="savings-card">
          Tarjeta de ahorro
        </button>
      )}
      <a href="#otro-producto" className="btn btn-ghost text-sm">
        Probar con otro producto
      </a>
    </div>
  );
}
