import { expect, test } from '@playwright/test';
import { E2E_ADMIN_PASSWORD, E2E_SECRET } from '../../playwright.config';

test.describe('security', () => {
  for (const target of ['http://127.0.0.1:8789/api/health', 'http://169.254.169.254/latest/meta-data/', 'http://localhost/admin', 'http://[::1]/', 'http://0x7f.1/', 'file:///etc/passwd']) {
    test(`SSRF attempt is refused: ${target}`, async ({ request }) => {
      const res = await request.post('/api/search', { data: { url: target } });
      const body = await res.text();
      expect(body).toContain('"type":"error"');
      expect(body).toMatch(/"code":"(invalid_url|blocked_host|own_domain)"/);
      expect(body).not.toContain('"type":"source"');
    });
  }

  test('the prefix route refuses internal targets too', async ({ page }) => {
    await page.goto('/http://169.254.169.254/latest/meta-data/');
    await expect(page.getByTestId('error-state')).toBeVisible();
  });

  test('secrets never reach the browser', async ({ page, request }) => {
    const bodies: string[] = [];
    page.on('response', async (r) => {
      if (/\.(js|css|html)$|\/api\/|\/https?:|\/ejemplo\//.test(r.url())) bodies.push(await r.text().catch(() => ''));
    });
    await page.goto('/https://www.ikea.com/es/es/p/fixture-lampara-mesa-vidrio-opalo-00000001/');
    await expect(page.getByTestId('result-card').first()).toBeVisible({ timeout: 15_000 });
    await page.goto('/ejemplo/espejo-ratan');
    bodies.push(await page.content());
    bodies.push(await (await request.get('/api/health')).text());
    const all = bodies.join('\n');
    expect(all).not.toContain(E2E_SECRET);
    expect(all).not.toContain(E2E_ADMIN_PASSWORD);
    expect(all).not.toMatch(/SUPABASE_SERVICE_ROLE_KEY|ALIEXPRESS_APP_SECRET/);
  });

  test('responses carry security headers', async ({ request }) => {
    const dynamic = await request.get('/ejemplo/lampara-seta');
    expect(dynamic.headers()['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(dynamic.headers()['x-content-type-options']).toBe('nosniff');
    const api = await request.get('/api/health');
    expect(api.headers()['cache-control']).toBe('no-store');
  });

  test('search result pages are noindex', async ({ page }) => {
    await page.goto('/ejemplo/lampara-seta');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  });

  test('admin requires credentials', async ({ request }) => {
    expect((await request.get('/admin')).status()).toBe(401);
    const bad = await request.get('/admin', { headers: { authorization: `Basic ${Buffer.from('admin:wrong').toString('base64')}` } });
    expect(bad.status()).toBe(401);
    const ok = await request.get('/admin', { headers: { authorization: `Basic ${Buffer.from(`admin:${E2E_ADMIN_PASSWORD}`).toString('base64')}` } });
    expect(ok.status()).toBe(200);
    expect(await ok.text()).toContain('Panel de Gemelu');
  });

  test('bad API input is rejected cleanly', async ({ request }) => {
    expect((await request.post('/api/search', { data: 'nope', headers: { 'content-type': 'application/json' } })).status()).toBe(400);
    expect((await request.post('/api/event', { data: { type: 'evil' } })).status()).toBe(400);
    expect((await request.post('/api/correction', { data: { kind: 'not_similar', searchId: 'x' } })).status()).toBe(204);
  });
});
