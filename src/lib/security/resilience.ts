/**
 * Retry with exponential backoff + a per-key circuit breaker.
 *
 * State lives in the isolate's memory: good enough to stop hammering a
 * failing provider from a hot isolate, without extra infrastructure.
 */

export interface RetryOptions {
  retries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  /** Return true when the error is worth retrying (timeouts, 429, 5xx). */
  shouldRetry: (err: unknown) => boolean;
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export async function withRetry<T>(fn: (attempt: number) => Promise<T>, opts: RetryOptions): Promise<T> {
  const sleep = opts.sleep ?? defaultSleep;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= opts.retries; attempt++) {
    try {
      return await fn(attempt);
    } catch (err) {
      lastErr = err;
      if (attempt === opts.retries || !opts.shouldRetry(err)) break;
      const delay = Math.min(opts.maxDelayMs, opts.baseDelayMs * 2 ** attempt);
      // Full jitter avoids synchronized retries across isolates.
      await sleep(Math.round(Math.random() * delay));
    }
  }
  throw lastErr;
}

export class CircuitOpenError extends Error {
  constructor(public readonly key: string) {
    super(`Circuit open for ${key}`);
    this.name = 'CircuitOpenError';
  }
}

interface BreakerState {
  failures: number;
  openedAt: number | null;
}

export class CircuitBreaker {
  private readonly states = new Map<string, BreakerState>();

  constructor(
    private readonly failureThreshold = 5,
    private readonly cooldownMs = 60_000,
    private readonly now: () => number = Date.now,
  ) {}

  async run<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const state = this.states.get(key) ?? { failures: 0, openedAt: null };
    this.states.set(key, state);
    if (state.openedAt !== null) {
      if (this.now() - state.openedAt < this.cooldownMs) throw new CircuitOpenError(key);
      // Half-open: allow one trial request.
      state.openedAt = null;
      state.failures = this.failureThreshold - 1;
    }
    try {
      const result = await fn();
      state.failures = 0;
      return result;
    } catch (err) {
      state.failures += 1;
      if (state.failures >= this.failureThreshold) state.openedAt = this.now();
      throw err;
    }
  }

  isOpen(key: string): boolean {
    const s = this.states.get(key);
    return !!s && s.openedAt !== null && this.now() - s.openedAt < this.cooldownMs;
  }
}
