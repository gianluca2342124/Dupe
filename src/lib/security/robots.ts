import type { SafeFetcher } from './safe-fetch';

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

/** `unreachable`: robots.txt could not be fetched (network/timeout) — treat as "do not read". */
export type RobotsVerdict = 'allowed' | 'disallowed' | 'unreachable';

type LoadedRobots = RobotsRules | 'allow-all' | 'disallow-all' | 'unreachable';

export class RobotsChecker {
  private readonly cache = new Map<string, { rules: LoadedRobots; expires: number }>();

  constructor(
    private readonly fetcher: SafeFetcher,
    private readonly userAgent: string,
    private readonly userAgentToken: string,
    private readonly ttlMs = 12 * 60 * 60 * 1000,
  ) {}

  async check(url: URL): Promise<RobotsVerdict> {
    const origin = url.origin;
    let entry = this.cache.get(origin);
    if (!entry || entry.expires < Date.now()) {
      const rules = await this.load(origin);
      // Don't cache transport failures for long: the store may just be slow.
      entry = { rules, expires: Date.now() + (rules === 'unreachable' ? 60_000 : this.ttlMs) };
      if (this.cache.size > 1000) this.cache.clear();
      this.cache.set(origin, entry);
    }
    if (entry.rules === 'allow-all') return 'allowed';
    if (entry.rules === 'disallow-all') return 'disallowed';
    if (entry.rules === 'unreachable') return 'unreachable';
    return isAllowedByRobots(entry.rules, this.userAgentToken, url.pathname + url.search) ? 'allowed' : 'disallowed';
  }

  private async load(origin: string): Promise<LoadedRobots> {
    try {
      const res = await this.fetcher(`${origin}/robots.txt`, {
        userAgent: this.userAgent,
        timeoutMs: 3500,
        maxBytes: 500_000,
        accept: 'text/plain,*/*;q=0.5',
        allowedContentTypes: [],
      });
      // RFC 9309 §2.3.1.3: 4xx → no restrictions; 5xx → assume complete disallow.
      if (res.status >= 400 && res.status < 500) return 'allow-all';
      if (res.status >= 500) return 'disallow-all';
      return parseRobots(res.body);
    } catch {
      // Unreachable robots.txt (network/timeout): RFC 9309 says to assume
      // complete disallow. We report it separately so the UI can say "the
      // store did not respond" instead of "the store does not allow it".
      return 'unreachable';
    }
  }
}
