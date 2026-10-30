import type { ResultItem, SearchResultPayload } from '../../types/search';
import { money } from '../../lib/format';

/**
 * Builds a 1080×1350 PNG "savings card" for social posts, entirely in the
 * browser. Text only (no third-party product photos), and only for real,
 * verified savings — never for demo data.
 */
export function canMakeSavingsCard(result: SearchResultPayload): boolean {
  return !result.provider.isDemo && !!result.summary.maxSavings && !!result.source.price;
}

function bestItem(result: SearchResultPayload): ResultItem | null {
  return result.items.filter((i) => i.savings).sort((a, b) => b.savings!.percent - a.savings!.percent)[0] ?? null;
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
      if (lines.length === maxLines) break;
    } else line = test;
  }
  if (lines.length < maxLines && line) lines.push(line);
  if (lines.length === maxLines && words.join(' ') !== lines.join(' ')) lines[maxLines - 1] = `${lines[maxLines - 1]!.replace(/\s+\S*$/, '')}…`;
  return lines;
}

export async function makeSavingsCard(result: SearchResultPayload, domain: string): Promise<Blob | null> {
  const item = bestItem(result);
  if (!item?.savings || !result.source.price) return null;
  const W = 1080;
  const H = 1350;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  await Promise.all([document.fonts.load('80px "Instrument Serif"'), document.fonts.load('600 40px "Instrument Sans Variable"')]).catch(() => undefined);
  const sans = '"Instrument Sans Variable", "Instrument Sans", system-ui, sans-serif';
  const serif = '"Instrument Serif", Georgia, serif';

  ctx.fillStyle = '#FAF8F4';
  ctx.fillRect(0, 0, W, H);

  // Logo (twin arches + wordmark)
  const arch = (x: number, color: string) => {
    ctx.beginPath();
    ctx.moveTo(x, 150);
    ctx.lineTo(x, 112);
    ctx.arc(x + 17, 112, 17, Math.PI, 0);
    ctx.lineTo(x + 34, 150);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  };
  arch(80, '#1A1915');
  arch(106, '#B4532F');
  ctx.fillStyle = '#1A1915';
  ctx.font = `600 52px ${sans}`;
  ctx.fillText('gemelu', 160, 148);

  ctx.font = `400 104px ${serif}`;
  ctx.fillText('Encontré', 80, 330);
  ctx.fillStyle = '#B4532F';
  ctx.font = `italic 400 104px ${serif}`;
  ctx.fillText('su gemelo.', 80, 440);

  ctx.fillStyle = '#4A463F';
  ctx.font = `500 38px ${sans}`;
  const title = wrap(ctx, result.source.title ?? 'Producto original', W - 160, 2);
  title.forEach((l, i) => ctx.fillText(l, 80, 560 + i * 52));

  const row = (label: string, value: string, y: number, strong = false) => {
    ctx.fillStyle = '#7A7469';
    ctx.font = `500 34px ${sans}`;
    ctx.fillText(label, 80, y);
    ctx.fillStyle = strong ? '#1D6B47' : '#1A1915';
    ctx.font = `600 54px ${sans}`;
    const w = ctx.measureText(value).width;
    ctx.fillText(value, W - 80 - w, y + 6);
  };
  ctx.strokeStyle = '#E7E1D6';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(80, 700);
  ctx.lineTo(W - 80, 700);
  ctx.stroke();
  row(`Original · ${result.source.storeName}`, money(result.source.price), 780);
  row(item.totalPrice ? 'Alternativa, con envío' : 'Alternativa, sin envío', money(item.totalPrice ?? item.price), 880);
  ctx.beginPath();
  ctx.moveTo(80, 940);
  ctx.lineTo(W - 80, 940);
  ctx.stroke();

  ctx.fillStyle = '#1D6B47';
  ctx.font = `400 220px ${serif}`;
  ctx.fillText(`−${item.savings.percent} %`, 72, 1170);
  ctx.font = `600 40px ${sans}`;
  ctx.fillText(`Ahorro: ${money(item.savings.amount)}`, 84, 1240);

  ctx.fillStyle = '#7A7469';
  ctx.font = `500 28px ${sans}`;
  const date = new Date(result.createdAt).toLocaleDateString('es-ES');
  ctx.fillText(`Precios comprobados el ${date}. Parecido no es idéntico.`, 84, 1300);
  const brand = `${domain}/`;
  ctx.fillStyle = '#B4532F';
  ctx.font = `600 34px ${sans}`;
  ctx.fillText(brand, W - 80 - ctx.measureText(brand).width, 1240);

  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/png'));
}
