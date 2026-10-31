import { detectBlock, type BlockKind } from '../extraction/challenge';
import { SafeFetchError, type SafeFetcher } from './safe-fetch';

/**
 * robots.txt support (RFC 9309).
 *
 * Gemelu only reads a page when a person explicitly asks for it, but we still
 * honour robots.txt by default (ROBOTS_POLICY=respect): if a store disallows
 * our user agent (or `*`) for a path, we don't read that page and fall back to
 * what the URL itself tells us.
 */

interface RuleGroup {
  agents: string[];
  rules: { allow: boolean; pattern: string }[];
}

export interface RobotsRules {
  groups: RuleGroup[];
}

export function parseRobots(text: string): RobotsRules {
  const groups: RuleGroup[] = [];
  let current: RuleGroup | null = null;
  let lastWasAgent = false;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, '').trim();
    if (!line) continue;
    const idx = line.indexOf(':');
    if (idx < 0) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();

    if (key === 'user-agent') {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
    } else if (key === 'allow' || key === 'disallow') {
      lastWasAgent = false;
      if (!current) continue;
      // An empty Disallow means "allow everything" — no rule needed.
      if (key === 'disallow' && value === '') continue;
      current.rules.push({ allow: key === 'allow', pattern: value });
    } else {
      lastWasAgent = false;
    }
  }
  return { groups };
}

function patternToRegExp(pattern: string): RegExp {
  const anchored = pattern.endsWith('$');
  const body = (anchored ? pattern.slice(0, -1) : pattern)
    .split('*')
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*');
  return new RegExp(`^${body}${anchored ? '$' : ''}`);
}

/** Returns true when `userAgentToken` may fetch `pathWithQuery`. */
export function isAllowedByRobots(rules: RobotsRules, userAgentToken: string, pathWithQuery: string): boolean {
  const token = userAgentToken.toLowerCase();
  const specific = rules.groups.filter((g) => g.agents.some((a) => a !== '*' && token.includes(a)));
  const applicable = specific.length > 0 ? specific : rules.groups.filter((g) => g.agents.includes('*'));
  if (applicable.length === 0) return true;

  let best: { allow: boolean; length: number } | null = null;
  for (const group of applicable) {
    for (const rule of group.rules) {
      if (!rule.pattern) continue;
      if (!patternToRegExp(rule.pattern).test(pathWithQuery)) continue;
      const length = rule.pattern.length;
      // Longest match wins; on ties, Allow wins (least restrictive).
      if (!best || length > best.length || (length === best.length && rule.allow)) {
        best = { allow: rule.allow, length };
      }
    }
  }
  return best ? best.allow : true;
}

/**
 * - `unreachable`: robots.txt could not be fetched (network, timeout, 5xx).
 *   RFC 9309 §2.3.1.4 says to assume complete disallow, so we don't read the page.
 * - `blocked`: robots.txt itself sits behind a bot wall (or answers 429), so
 *   the pages are walled too. Reported as such instead of as a robots rule.
 */
export type RobotsVerdict = 'allowed' | 'disallowed' | 'unreachable' | 'blocked';

export interface RobotsDecision {
  verdict: RobotsVerdict;
  /** "HTTP 503", "timeout", "dns_failed"… for unreachable/blocked. */
  detail?: string;
  block?: BlockKind;
}

type LoadedRobots = { kind: 'rules'; rules: RobotsRules } | { kind: 'allow-all' } | { kind: 'failed'; decision: RobotsDecision };

export class RobotsChecker {
  private readonly cache = new Map<string, { loaded: LoadedRobots; expires: number }>();

  constructor(
    private readonly fetcher: SafeFetcher,
    private readonly userAgent: string,
    private readonly userAgentToken: string,
    private readonly ttlMs = 12 * 60 * 60 * 1000,
  ) {}

  async check(url: URL): Promise<RobotsDecision> {
    const origin = url.origin;
    let entry = this.cache.get(origin);
    if (!entry || entry.expires < Date.now()) {
      const loaded = await this.load(origin);
      // Don't cache failures for long: the store may just be slow.
      entry = { loaded, expires: Date.now() + (loaded.kind === 'failed' ? 60_000 : this.ttlMs) };
      if (this.cache.size > 1000) this.cache.clear();
      this.cache.set(origin, entry);
    }
    if (entry.loaded.kind === 'allow-all') return { verdict: 'allowed' };
    if (entry.loaded.kind === 'failed') return entry.loaded.decision;
    return { verdict: isAllowedByRobots(entry.loaded.rules, this.userAgentToken, url.pathname + url.search) ? 'allowed' : 'disallowed' };
  }

  private async load(origin: string): Promise<LoadedRobots> {
    let res;
    try {
      res = await this.fetcher(`${origin}/robots.txt`, {
        userAgent: this.userAgent,
        timeoutMs: 3500,
        maxBytes: 500_000,
        accept: 'text/plain,*/*;q=0.5',
        allowedContentTypes: [],
      });
    } catch (err) {
      return { kind: 'failed', decision: { verdict: 'unreachable', detail: err instanceof SafeFetchError ? err.code : 'network' } };
    }
    const block = res.status >= 400 ? detectBlock(res.status, res.body) : null;
    if (block) return { kind: 'failed', decision: { verdict: 'blocked', detail: `HTTP ${res.status}`, block } };
    // RFC 9309 §2.3.1.3–4: 4xx → no restrictions; 5xx → unreachable (assume complete disallow).
    if (res.status >= 500) return { kind: 'failed', decision: { verdict: 'unreachable', detail: `HTTP ${res.status}` } };
    if (res.status >= 400) return { kind: 'allow-all' };
    return { kind: 'rules', rules: parseRobots(res.body) };
  }
}
