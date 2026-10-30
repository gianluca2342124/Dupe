import { isPublicIp } from './ip';

/**
 * DNS-over-HTTPS resolver used to verify that a hostname only resolves to
 * public addresses before we fetch it (defence against DNS rebinding and
 * names such as `127.0.0.1.nip.io`).
 *
 * In Cloudflare Workers outbound `fetch()` cannot reach private networks
 * anyway; this check is defence in depth and protects Node runtimes (local
 * scripts, tests, self-hosting) where it is the primary guard.
 */
export interface DnsResolver {
  resolve(hostname: string): Promise<string[]>;
}

export class DnsError extends Error {
  constructor(
    public readonly code: 'nxdomain' | 'no_records' | 'resolver_failed' | 'private_address',
    message: string,
  ) {
    super(message);
    this.name = 'DnsError';
  }
}

interface DohAnswer {
  name: string;
  type: number;
  TTL: number;
  data: string;
}

interface DohResponse {
  Status: number;
  Answer?: DohAnswer[];
}

const TYPE_A = 1;
const TYPE_AAAA = 28;

export class DohResolver implements DnsResolver {
  private readonly cache = new Map<string, { ips: string[]; expires: number }>();

  constructor(
    private readonly fetchImpl: typeof fetch,
    private readonly endpoint = 'https://cloudflare-dns.com/dns-query',
    private readonly timeoutMs = 2500,
    private readonly maxEntries = 500,
  ) {}

  async resolve(hostname: string): Promise<string[]> {
    const cached = this.cache.get(hostname);
    if (cached && cached.expires > Date.now()) return cached.ips;

    const [a, aaaa] = await Promise.all([this.query(hostname, 'A'), this.query(hostname, 'AAAA')]);
    if (a.status === 3 && aaaa.status === 3) throw new DnsError('nxdomain', `NXDOMAIN for ${hostname}`);
    const answers = [...a.answers, ...aaaa.answers].filter(
      (ans) => ans.type === TYPE_A || ans.type === TYPE_AAAA,
    );
    const ips = answers.map((ans) => ans.data);
    if (ips.length === 0) throw new DnsError('no_records', `No A/AAAA records for ${hostname}`);

    const ttl = Math.min(300, Math.max(30, Math.min(...answers.map((ans) => ans.TTL || 60))));
    if (this.cache.size >= this.maxEntries) {
      const oldest = this.cache.keys().next().value;
      if (oldest !== undefined) this.cache.delete(oldest);
    }
    this.cache.set(hostname, { ips, expires: Date.now() + ttl * 1000 });
    return ips;
  }

  private async query(hostname: string, type: 'A' | 'AAAA'): Promise<{ status: number; answers: DohAnswer[] }> {
    const url = `${this.endpoint}?name=${encodeURIComponent(hostname)}&type=${type}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await this.fetchImpl(url, {
        headers: { accept: 'application/dns-json' },
        signal: controller.signal,
      });
      if (!res.ok) throw new DnsError('resolver_failed', `DoH HTTP ${res.status}`);
      const json = (await res.json()) as DohResponse;
      return { status: json.Status, answers: json.Answer ?? [] };
    } catch (err) {
      if (err instanceof DnsError) throw err;
      throw new DnsError('resolver_failed', `DoH query failed: ${(err as Error).message}`);
    } finally {
      clearTimeout(timer);
    }
  }
}

/** Throws unless every address the hostname resolves to is public. */
export async function assertResolvesToPublic(hostname: string, resolver: DnsResolver): Promise<string[]> {
  const ips = await resolver.resolve(hostname);
  const bad = ips.find((ip) => !isPublicIp(ip));
  if (bad) throw new DnsError('private_address', `${hostname} resolves to a non-public address`);
  return ips;
}

/** Resolver for tests / fixture mode: maps hostnames to fixed IPs. */
export class StaticResolver implements DnsResolver {
  constructor(private readonly table: Record<string, string[]>, private readonly fallback: string[] = ['93.184.215.14']) {}
  async resolve(hostname: string): Promise<string[]> {
    return this.table[hostname] ?? this.fallback;
  }
}
