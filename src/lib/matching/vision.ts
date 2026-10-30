import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import type { SourceProduct } from '../../types/product';
import type { ProductAnalysis } from '../../types/matching';
import type { DataStore } from '../data/types';
import { LruMemory } from '../data/cache';
import type { Logger } from '../server/logger';
import type { VisionAnalyzer } from '../search/service';
import { CATEGORIES, COLORS, FEATURES, MATERIALS, SHAPES, STYLES } from './lexicon';
import { CATEGORY_BY_ID } from './analyze';

/**
 * Optional multimodal enrichment (VISION_PROVIDER=anthropic).
 *
 * Only called when the deterministic analysis could not identify the
 * category with confidence, at most VISION_DAILY_LIMIT times per day, and
 * cached per product URL. The answer is constrained to our lexicon ids via
 * structured outputs, so it can only *select* known concepts — it cannot
 * invent prices, sizes or availability.
 */

const ids = (defs: { id: string }[]) => defs.map((d) => d.id);

const SCHEMA = {
  type: 'object',
  properties: {
    category: { type: 'string', enum: [...ids(CATEGORIES), 'unknown'] },
    shapes: { type: 'array', items: { type: 'string', enum: ids(SHAPES) } },
    materials: { type: 'array', items: { type: 'string', enum: ids(MATERIALS) } },
    colors: { type: 'array', items: { type: 'string', enum: ids(COLORS) } },
    styles: { type: 'array', items: { type: 'string', enum: ids(STYLES) } },
    features: { type: 'array', items: { type: 'string', enum: ids(FEATURES) } },
  },
  required: ['category', 'shapes', 'materials', 'colors', 'styles', 'features'],
  additionalProperties: false,
} as const;

const Result = z.object({
  category: z.string(),
  shapes: z.array(z.string()).max(4),
  materials: z.array(z.string()).max(4),
  colors: z.array(z.string()).max(4),
  styles: z.array(z.string()).max(3),
  features: z.array(z.string()).max(4),
});

const SYSTEM = [
  'You classify home and decor products for a price-comparison tool.',
  'Look at the product photo and title and select the matching ids from the allowed enums.',
  'Only include attributes that are clearly visible or stated; use "unknown" for the category if unsure.',
  'List the most important value first. Never guess brand, price or size.',
].join(' ');

export class AnthropicVisionAnalyzer implements VisionAnalyzer {
  private readonly client: Anthropic;
  private readonly cache = new LruMemory<z.infer<typeof Result> | null>(500);

  constructor(
    private readonly opts: { apiKey: string; model: string; fetch?: typeof fetch; store: DataStore; dailyLimit: number; logger: Logger },
  ) {
    this.client = new Anthropic({ apiKey: opts.apiKey, maxRetries: 1, timeout: 20_000, ...(opts.fetch ? { fetch: opts.fetch } : {}) });
  }

  async enrich(source: SourceProduct, analysis: ProductAnalysis): Promise<ProductAnalysis | null> {
    if (!source.image) return null;
    const key = source.canonicalUrl;
    let result = this.cache.get(key);
    if (result === undefined) {
      const used = await this.opts.store.incrementUsage(new Date().toISOString().slice(0, 10), 'vision_calls').catch(() => Number.POSITIVE_INFINITY);
      if (used > this.opts.dailyLimit) return null;
      result = await this.classify(source).catch((err) => {
        this.opts.logger.warn('vision analysis failed', { error: (err as Error).message });
        return null;
      });
      this.cache.set(key, result);
    }
    return result ? mergeVision(analysis, result) : null;
  }

  private async classify(source: SourceProduct): Promise<z.infer<typeof Result> | null> {
    const response = await this.client.beta.messages.create({
      model: this.opts.model,
      max_tokens: 2048,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA } },
      system: SYSTEM,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'url', url: source.image! } },
            { type: 'text', text: `Title: ${source.title ?? '(none)'}\nStore category: ${source.category ?? '(none)'}` },
          ],
        },
      ],
    });
    if (response.stop_reason === 'refusal') return null;
    const text = response.content.find((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')?.text;
    if (!text) return null;
    const parsed = Result.safeParse(JSON.parse(text));
    return parsed.success ? parsed.data : null;
  }
}

/** Deterministic findings win; vision fills gaps and adds missing attributes. */
export function mergeVision(a: ProductAnalysis, v: z.infer<typeof Result>): ProductAnalysis {
  const merged: ProductAnalysis = { ...a, sources: [...new Set([...a.sources, 'vision' as const])] };
  if (v.category !== 'unknown' && CATEGORY_BY_ID.has(v.category) && (!a.categoryId || a.categoryConfidence < 0.6)) {
    merged.categoryId = v.category;
    merged.groupId = CATEGORY_BY_ID.get(v.category)?.group ?? null;
    merged.categoryConfidence = 0.7;
  }
  const union = (x: string[], y: string[]) => [...new Set([...x, ...y])];
  merged.shapes = union(a.shapes, v.shapes);
  merged.materials = union(a.materials, v.materials);
  merged.colors = union(a.colors, v.colors);
  merged.styles = union(a.styles, v.styles);
  merged.features = union(a.features, v.features);
  return merged;
}
