import type { ScoredCandidate } from '../../types/matching';
import { jaccard, informativeTokens } from './text';

/** Normalises marketplace image URLs so resized variants of one file compare equal. */
export function imageKey(url: string | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    const path = u.pathname
      .replace(/_\d+x\d+(q\d+)?\.(jpg|jpeg|png|webp)(_\.webp|\.webp|\.avif)?$/i, '')
      .replace(/\.(jpg|jpeg|png|webp|avif)(_\.webp|\.webp|\.avif)?$/i, '');
    return `${u.hostname.replace(/^ae\d+\./, 'ae.')}${path}`.toLowerCase();
  } catch {
    return null;
  }
}

function nearDuplicate(a: ScoredCandidate, b: ScoredCandidate): boolean {
  const ka = imageKey(a.product.image);
  if (ka && ka === imageKey(b.product.image)) return true;
  const pa = a.comparablePrice?.amount;
  const pb = b.comparablePrice?.amount;
  if (pa === undefined || pb === undefined) return false;
  const priceClose = Math.abs(pa - pb) / Math.max(pa, pb) <= 0.12;
  if (!priceClose) return false;
  return jaccard(informativeTokens(a.product.title), informativeTokens(b.product.title)) >= 0.8;
}

/**
 * Marketplaces list the same item many times. Keeps the best-scored listing
 * of each cluster (input must be sorted best-first) and counts the rest.
 */
export function dedupeCandidates(sortedBestFirst: ScoredCandidate[]): { kept: ScoredCandidate[]; removed: number } {
  const kept: ScoredCandidate[] = [];
  const seenIds = new Set<string>();
  let removed = 0;
  for (const cand of sortedBestFirst) {
    const id = `${cand.product.provider}:${cand.product.providerProductId}`;
    if (seenIds.has(id)) {
      removed++;
      continue;
    }
    const dup = kept.find((k) => nearDuplicate(k, cand));
    if (dup) {
      dup.duplicates += 1;
      removed++;
      continue;
    }
    seenIds.add(id);
    kept.push(cand);
  }
  return { kept, removed };
}
