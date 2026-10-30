/**
 * Rate limiting abstraction.
 *
 * Production uses the Cloudflare Workers Rate Limiting binding (configured in
 * wrangler.jsonc, evaluated at the edge, free). The in-memory limiter is a
 * best-effort per-isolate fallback for local development and self-hosting.
 */
export interface RateLimiter {
  limit(key: string): Promise<{ success: boolean }>;
}

/** Shape of the Cloudflare `ratelimits` binding. */
export interface CloudflareRateLimitBinding {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

export class CloudflareRateLimiter implements RateLimiter {
  constructor(private readonly binding: CloudflareRateLimitBinding) {}
  async limit(key: string) {
    try {
      return await this.binding.limit({ key });
    } catch {
      // Fail open: the limiter must never take the product down.
      return { success: true };
    }
  }
}

export class MemoryRateLimiter implements RateLimiter {
  private readonly hits = new Map<string, { count: number; resetAt: number }>();

  constructor(private readonly max: number, private readonly windowMs: number) {}

  async limit(key: string) {
    const now = Date.now();
    const entry = this.hits.get(key);
    if (!entry || entry.resetAt <= now) {
      if (this.hits.size > 10_000) this.hits.clear();
      this.hits.set(key, { count: 1, resetAt: now + this.windowMs });
      return { success: true };
    }
    entry.count += 1;
    return { success: entry.count <= this.max };
  }
}

export class NoopRateLimiter implements RateLimiter {
  async limit() {
    return { success: true };
  }
}
