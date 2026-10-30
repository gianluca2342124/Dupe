/** Fire-and-forget, cookieless analytics beacon. */
export function track(type: 'share' | 'copy_link' | 'results_shown', searchId?: string, value?: number) {
  try {
    const body = JSON.stringify({ type, searchId, value, path: location.pathname.slice(0, 200) });
    if (navigator.sendBeacon) navigator.sendBeacon('/api/event', new Blob([body], { type: 'application/json' }));
  } catch {
    // ignore
  }
}

export function reportMismatch(searchId: string, providerProductId: string, sourceUrl: string | null) {
  return fetch('/api/correction', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ searchId, providerProductId, sourceUrl, kind: 'not_similar' }),
    keepalive: true,
  }).catch(() => undefined);
}
