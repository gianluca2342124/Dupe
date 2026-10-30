/**
 * Offline evaluation of the matching engine.
 *
 *   npx tsx scripts/eval-matching.ts [labels.json]
 *
 * A labelled set lists, for each source product, which catalogue items a
 * human judged as a good alternative ("good") or not ("bad"). The script runs
 * the pipeline and reports precision@k per tier, which is what must exist
 * before SHOW_SIMILARITY_PERCENT can be enabled (calibration).
 *
 * Without an argument it evaluates the built-in DEMO labels below, which
 * only prove the harness works — they are not a calibration of real data.
 */
import { readFileSync } from 'node:fs';
import { DEFAULT_MATCHING_CONFIG } from '../src/config/matching';
import { analyzeSource, runMatching } from '../src/lib/matching/pipeline';
import { DemoCatalogProvider } from '../src/lib/providers/demo/provider';
import { exampleSource } from '../src/lib/search/examples';

interface LabelSet {
  cases: { example: string; good: string[]; bad: string[] }[];
}

const DEMO_LABELS: LabelSet = {
  cases: [
    { example: 'lampara-seta', good: ['demo-lamp-01', 'demo-lamp-02', 'demo-lamp-06', 'demo-lamp-04', 'demo-lamp-03'], bad: ['demo-lamp-16', 'demo-lamp-19', 'demo-lamp-18'] },
    { example: 'espejo-ratan', good: ['demo-mir-01', 'demo-mir-02', 'demo-mir-03', 'demo-mir-04'], bad: ['demo-mir-10', 'demo-mir-11'] },
    { example: 'sillon-boucle', good: ['demo-arm-01', 'demo-arm-02', 'demo-arm-03'], bad: ['demo-chair-02'] },
    { example: 'cesta-mimbre', good: ['demo-bas-01', 'demo-bas-02', 'demo-bas-06', 'demo-bas-04'], bad: ['demo-box-01'] },
  ],
};

const labels: LabelSet = process.argv[2] ? (JSON.parse(readFileSync(process.argv[2], 'utf8')) as LabelSet) : DEMO_LABELS;
const provider = new DemoCatalogProvider();
const perTier: Record<string, { good: number; bad: number; unlabeled: number }> = {};
let p3Sum = 0;

for (const c of labels.cases) {
  const source = exampleSource(c.example);
  if (!source) continue;
  const out = await runMatching({ source, analysis: analyzeSource(source), provider, config: DEFAULT_MATCHING_CONFIG });
  const shown = [...out.results, ...out.lowConfidence];
  for (const r of shown) {
    const id = r.product.providerProductId;
    const bucket = (perTier[r.tier] ??= { good: 0, bad: 0, unlabeled: 0 });
    if (c.good.includes(id)) bucket.good++;
    else if (c.bad.includes(id)) bucket.bad++;
    else bucket.unlabeled++;
  }
  const top3 = out.results.slice(0, 3).map((r) => r.product.providerProductId);
  const p3 = top3.filter((id) => c.good.includes(id)).length / Math.max(1, top3.length);
  p3Sum += p3;
  console.log(`${c.example.padEnd(16)} precision@3=${p3.toFixed(2)} shown=${shown.length} top3=${top3.join(', ')}`);
}

console.log('\nPer tier (labelled items only):');
for (const [tier, b] of Object.entries(perTier)) {
  const labelled = b.good + b.bad;
  console.log(`  ${tier.padEnd(15)} precision=${labelled ? (b.good / labelled).toFixed(2) : 'n/a'}  good=${b.good} bad=${b.bad} unlabeled=${b.unlabeled}`);
}
console.log(`\nMean precision@3: ${(p3Sum / labels.cases.length).toFixed(2)}`);
