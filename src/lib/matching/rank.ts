import type { MatchTier, ScoredCandidate } from '../../types/matching';
import type { ResultLabel } from '../../types/search';
import type { MatchingConfig } from '../../config/matching';

const TIER_ORDER: Record<MatchTier, number> = { verified: 0, very_similar: 1, similar: 2, low_confidence: 3 };

/** Tier from similarity + evidence. `null` means: below every threshold, discard. */
export function assignTier(
  similarity: number,
  evidence: number,
  identity: boolean,
  shapeAgrees: boolean | null,
  tiers: MatchingConfig['tiers'],
  categoryAgrees: boolean | null = null,
): MatchTier | null {
  if (identity) return 'verified';
  if (
    similarity >= tiers.verySimilar.minSimilarity &&
    evidence >= tiers.verySimilar.minEvidence &&
    shapeAgrees !== false &&
    categoryAgrees !== false
  ) {
    return 'very_similar';
  }
  if (similarity >= tiers.similar.minSimilarity && evidence >= tiers.similar.minEvidence) return 'similar';
  if (similarity >= tiers.lowConfidence.minSimilarity) return 'low_confidence';
  return null;
}

export function sortCandidates(list: ScoredCandidate[]): ScoredCandidate[] {
  return [...list].sort((a, b) => TIER_ORDER[a.tier] - TIER_ORDER[b.tier] || b.final - a.final || b.similarity - a.similarity);
}

/**
 * "Más parecido" / "Más barato" labels — only when the claim is justified by
 * comparable data and the winner is unique.
 */
export function assignLabels(shown: ScoredCandidate[], margin: number): Map<string, ResultLabel[]> {
  const labels = new Map<string, ResultLabel[]>();
  const key = (c: ScoredCandidate) => `${c.product.provider}:${c.product.providerProductId}`;
  const eligible = shown.filter((c) => c.tier !== 'low_confidence');
  if (eligible.length >= 2) {
    const bySim = [...eligible].sort((a, b) => b.similarity - a.similarity);
    if (bySim[0]!.similarity - bySim[1]!.similarity >= margin) labels.set(key(bySim[0]!), ['most_similar']);

    const priced = eligible.filter((c) => c.comparablePrice && !c.caveats.includes('price_from'));
    const currencies = new Set(priced.map((c) => c.comparablePrice!.currency));
    const bases = new Set(priced.map((c) => (c.caveats.includes('shipping_unknown') ? 'item' : 'total')));
    if (priced.length >= 2 && currencies.size === 1 && bases.size === 1) {
      const byPrice = [...priced].sort((a, b) => a.comparablePrice!.amount - b.comparablePrice!.amount);
      if (byPrice[0]!.comparablePrice!.amount < byPrice[1]!.comparablePrice!.amount) {
        const k = key(byPrice[0]!);
        labels.set(k, [...(labels.get(k) ?? []), 'cheapest']);
      }
    }
  }
  return labels;
}
