/**
 * Structured JSON logging with secret redaction. Workers Logs (observability)
 * ingests console output; we never log request bodies, IPs, tokens or keys.
 */
type Level = 'debug' | 'info' | 'warn' | 'error';
const ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

const SENSITIVE_KEY = /secret|token|password|authorization|cookie|api[_-]?key|app[_-]?key|service[_-]?role|signature|sign$/i;

export function redact(value: unknown, secrets: readonly string[] = [], depth = 0): unknown {
  if (depth > 5) return '[depth]';
  if (typeof value === 'string') {
    let s = value;
    for (const secret of secrets) if (secret && secret.length >= 6) s = s.split(secret).join('[redacted]');
    // Signed query strings (AliExpress "sign=", generic "token=", "apikey/") never leave the process.
    return s
      .replace(/([?&](?:sign|token|access_token|app_key|apikey|key)=)[^&\s]+/gi, '$1[redacted]')
      .replace(/(\/apikey\/)[^/\s]+/gi, '$1[redacted]');
  }
  if (Array.isArray(value)) return value.slice(0, 50).map((v) => redact(v, secrets, depth + 1));
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SENSITIVE_KEY.test(k) ? '[redacted]' : redact(v, secrets, depth + 1);
    }
    return out;
  }
  return value;
}

export interface Logger {
  debug(msg: string, data?: Record<string, unknown>): void;
  info(msg: string, data?: Record<string, unknown>): void;
  warn(msg: string, data?: Record<string, unknown>): void;
  error(msg: string, data?: Record<string, unknown>): void;
}

export function createLogger(level: Level, secrets: readonly string[] = []): Logger {
  const emit = (lvl: Level, msg: string, data?: Record<string, unknown>) => {
    if (ORDER[lvl] < ORDER[level]) return;
    const line = JSON.stringify({ level: lvl, msg, ...(data ? (redact(data, secrets) as Record<string, unknown>) : {}), ts: new Date().toISOString() });
    if (lvl === 'error') console.error(line);
    else if (lvl === 'warn') console.warn(line);
    else console.log(line);
  };
  return {
    debug: (m, d) => emit('debug', m, d),
    info: (m, d) => emit('info', m, d),
    warn: (m, d) => emit('warn', m, d),
    error: (m, d) => emit('error', m, d),
  };
}
