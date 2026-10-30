import { AliExpressClient } from '../src/lib/providers/aliexpress/client';
import type { CommissionRecord, DataStore, SyncRunRecord } from '../src/lib/data/types';
import type { AppConfig } from '../src/lib/server/config';
import type { Logger } from '../src/lib/server/logger';
import { randomId } from '../src/lib/security/crypto';

/**
 * Scheduled jobs (Cloudflare Cron Triggers, see wrangler.jsonc):
 *  - "23 *\/6 * * *": light refresh (commission import for the last 2 days)
 *  - "47 3 * * *":   daily maintenance (data retention + 30-day commission sync)
 *
 * Heavy work (full Awin feed import) runs in scripts/sync-awin-feed.ts via
 * GitHub Actions instead: feeds can exceed Worker CPU/subrequest limits.
 */

interface JobDeps {
  config: AppConfig;
  store: DataStore;
  logger: Logger;
  supabaseRpc?: (fn: string, args: Record<string, unknown>) => Promise<unknown>;
  fetch: typeof fetch;
}

async function track<T>(deps: JobDeps, run: Omit<SyncRunRecord, 'id' | 'status' | 'startedAt' | 'finishedAt' | 'error'>, fn: (r: SyncRunRecord) => Promise<T>) {
  const record: SyncRunRecord = { ...run, id: randomId(9), status: 'running', startedAt: new Date().toISOString(), finishedAt: null, error: null };
  await deps.store.saveSyncRun(record).catch(() => undefined);
  try {
    await fn(record);
    record.status = 'success';
  } catch (err) {
    record.status = 'failed';
    record.error = (err as Error).message.slice(0, 500);
    deps.logger.error('scheduled job failed', { kind: run.kind, provider: run.provider, error: record.error });
  } finally {
    record.finishedAt = new Date().toISOString();
    await deps.store.saveSyncRun(record).catch(() => undefined);
  }
}

/** AliExpress dates are documented in PST: "yyyy-MM-dd HH:mm:ss". */
function pst(date: Date): string {
  const d = new Date(date.getTime() - 8 * 3600_000);
  return d.toISOString().replace('T', ' ').slice(0, 19);
}

export async function importAliExpressOrders(deps: JobDeps, days: number) {
  const { appKey, appSecret, trackingId } = deps.config.aliexpress;
  if (!appKey || !appSecret) return;
  const client = new AliExpressClient({ appKey, appSecret, trackingId }, deps.fetch, { timeoutMs: 15_000 });
  await track(deps, { provider: 'aliexpress', kind: 'commission_import', rowsRead: 0, rowsUpserted: 0, rowsRejected: 0 }, async (run) => {
    const end = new Date();
    const start = new Date(end.getTime() - days * 86400_000);
    for (const status of ['Payment Completed', 'Buyer Confirmed Receipt']) {
      for (let page = 1; page <= 20; page++) {
        const payload = await client.call('aliexpress.affiliate.order.list', {
          start_time: pst(start),
          end_time: pst(end),
          status,
          page_no: page,
          page_size: 50,
        });
        const result = (payload.resp_result as { result?: { orders?: unknown; total_page_no?: number } } | undefined)?.result;
        const ordersRaw = result?.orders;
        const orders = (Array.isArray(ordersRaw) ? ordersRaw : ((ordersRaw as { order?: unknown[] })?.order ?? [])) as Record<string, unknown>[];
        run.rowsRead += orders.length;
        const rows: CommissionRecord[] = orders.map((o) => ({
          provider: 'aliexpress',
          transactionId: String(o.sub_order_id ?? o.order_id),
          clickRef: (o.custom_parameters as string) ?? null,
          status: String(o.order_status ?? status),
          saleAmount: o.paid_amount !== undefined ? Number(o.paid_amount) : null,
          commissionAmount: o.estimated_paid_commission !== undefined ? Number(o.estimated_paid_commission) : null,
          currency: (o.settled_currency as string) ?? null,
          transactionDate: new Date(String(o.paid_time ?? o.created_time ?? end.toISOString())).toISOString(),
        }));
        await deps.store.saveCommissions(rows);
        run.rowsUpserted += rows.length;
        if (!result?.total_page_no || page >= Number(result.total_page_no)) break;
      }
    }
  });
}

export async function importAwinTransactions(deps: JobDeps, days: number) {
  const { publisherId, apiToken } = deps.config.awin;
  if (!publisherId || !apiToken) return;
  await track(deps, { provider: 'awin', kind: 'commission_import', rowsRead: 0, rowsUpserted: 0, rowsRejected: 0 }, async (run) => {
    const end = new Date();
    const start = new Date(end.getTime() - Math.min(days, 31) * 86400_000);
    const fmt = (d: Date) => d.toISOString().slice(0, 19);
    // Awin Publisher API — transactions list (verify parameters in Awin's API docs before enabling).
    const url = `https://api.awin.com/publishers/${encodeURIComponent(publisherId)}/transactions/?startDate=${fmt(start)}&endDate=${fmt(end)}&timezone=UTC`;
    const res = await deps.fetch(url, { headers: { authorization: `Bearer ${apiToken}`, accept: 'application/json' } });
    if (!res.ok) throw new Error(`Awin transactions HTTP ${res.status}`);
    const list = (await res.json()) as Record<string, unknown>[];
    run.rowsRead = list.length;
    const rows: CommissionRecord[] = list.map((t) => {
      const commission = t.commissionAmount as { amount?: number; currency?: string } | undefined;
      const sale = t.saleAmount as { amount?: number } | undefined;
      const refs = t.clickRefs as { clickRef?: string } | undefined;
      return {
        provider: 'awin',
        transactionId: String(t.id),
        clickRef: refs?.clickRef ?? null,
        status: String(t.commissionStatus ?? 'unknown'),
        saleAmount: sale?.amount ?? null,
        commissionAmount: commission?.amount ?? null,
        currency: commission?.currency ?? null,
        transactionDate: new Date(String(t.transactionDate ?? end.toISOString())).toISOString(),
      };
    });
    await deps.store.saveCommissions(rows);
    run.rowsUpserted = rows.length;
  });
}

export async function runMaintenance(deps: JobDeps) {
  if (!deps.supabaseRpc) return;
  await track(deps, { provider: deps.config.provider, kind: 'maintenance', rowsRead: 0, rowsUpserted: 0, rowsRejected: 0 }, async (run) => {
    // Retention policy (see supabase/migrations): events 13 months, expired cache rows.
    const purged = (await deps.supabaseRpc!('purge_expired_data', {})) as number | null;
    run.rowsRejected = Number(purged ?? 0);
  });
}

export async function handleScheduled(cron: string, deps: JobDeps) {
  if (cron === '47 3 * * *') {
    await Promise.allSettled([runMaintenance(deps), importAliExpressOrders(deps, 30), importAwinTransactions(deps, 30)]);
  } else {
    await Promise.allSettled([importAliExpressOrders(deps, 2), importAwinTransactions(deps, 2)]);
  }
}
