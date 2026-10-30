import type { SearchResultPayload } from '../../types/search';
import type { DataStore } from './types';

/**
 * Layered result cache:
 *   L1 isolate memory (fast, tiny) → L2 Workers KV (edge, optional) → L3 DataStore (Supabase).
 * Plus in-flight de-duplication: concurrent requests for the same key share
 * one computation instead of hitting stores and providers N times.
 */

export interface KVNamespaceLike {
  get(key: string, type: 'json'): Promise<unknown>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}

interface Entry {
  payload: SearchResultPayload;
  storedAt: string;
  expires: number;
}

export class LruMemory<V> {
  private readonly map = new Map<string, V>();
  constructor(private readonly max = 300) {}
  get(key: string): V | undefined {
    const v = this.map.get(key);
    if (v !== undefined) {
      this.map.delete(key);
      this.map.set(key, v);
    }
    return v;
  }
  set(key: string, value: V) {
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, value);
    if (this.map.size > this.max) this.map.delete(this.map.keys().next().value!);
  }
  delete(key: string) {
    this.map.delete(key);
  }
  get size() {
    return this.map.size;
  }
}

export class ResultCache {
  private readonly l1 = new LruMemory<Entry>(300);
  private readonly inflight = new Map<string, Promise<SearchResultPayload>>();

  constructor(
    private readonly kv: KVNamespaceLike | null,
    private readonly store: DataStore | null,
    private readonly ttl: { memorySeconds: number; kvSeconds: number; storeSeconds: number },
  ) {}

  async get(key: string): Promise<{ payload: SearchResultPayload; storedAt: string; layer: 'memory' | 'kv' | 'store' } | null> {
    const m = this.l1.get(key);
    if (m && m.expires > Date.now()) return { payload: m.payload, storedAt: m.storedAt, layer: 'memory' };
    if (this.kv) {
      try {
        const v = (await this.kv.get(`r:${key}`, 'json')) as { payload: SearchResultPayload; storedAt: string } | null;
        if (v?.payload) {
          this.l1.set(key, { ...v, expires: Date.now() + this.ttl.memorySeconds * 1000 });
          return { ...v, layer: 'kv' };
        }
      } catch {
        // KV is an optimisation; ignore failures.
      }
    }
    if (this.store) {
      try {
        const v = await this.store.getResult(key);
        if (v) {
          this.l1.set(key, { ...v, expires: Date.now() + this.ttl.memorySeconds * 1000 });
          return { ...v, layer: 'store' };
        }
      } catch {
        // fall through
      }
    }
    return null;
  }

  async set(key: string, payload: SearchResultPayload): Promise<void> {
    const storedAt = new Date().toISOString();
    this.l1.set(key, { payload, storedAt, expires: Date.now() + this.ttl.memorySeconds * 1000 });
    const tasks: Promise<unknown>[] = [];
    if (this.kv) tasks.push(this.kv.put(`r:${key}`, JSON.stringify({ payload, storedAt }), { expirationTtl: Math.max(60, this.ttl.kvSeconds) }));
    if (this.store) tasks.push(this.store.putResult(key, payload, this.ttl.storeSeconds));
    await Promise.allSettled(tasks);
  }

  /** Runs `compute` once per key at a time; concurrent callers await the same promise. */
  dedupe(key: string, compute: () => Promise<SearchResultPayload>): Promise<SearchResultPayload> {
    const existing = this.inflight.get(key);
    if (existing) return existing;
    const p = compute().finally(() => this.inflight.delete(key));
    this.inflight.set(key, p);
    return p;
  }

  get inflightCount() {
    return this.inflight.size;
  }
}
