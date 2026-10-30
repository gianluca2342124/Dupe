import { expect, test, type Page } from '@playwright/test';

const IKEA = 'https://www.ikea.com/es/es/p/fixture-lampara-mesa-vidrio-opalo-00000001/';

async function expectResults(page: Page) {
  await expect(page.getByTestId('summary')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId('result-card').first()).toBeVisible();
}

test.describe('prefix trick and results', () => {
  test('gemelu.com/https://… works and keeps the typed URL in the address bar', async ({ page }) => {
    await page.goto(`/${IKEA}`);
    await expectResults(page);
    expect(page.url()).toContain(`/${IKEA}`);
    await expect(page.getByTestId('source-title')).toContainText('FIXTURE Lámpara de mesa');
    await expect(page.getByTestId('source-price')).toHaveText(/39,99/);
    await expect(page.locator('[data-kind="demo"]')).toBeVisible();
    // Fictional prices are never compared with a real store price.
    await expect(page.getByTestId('result-savings')).toHaveCount(0);
    await expect(page.getByTestId('summary')).toContainText('parecidas');
  });

  test('query parameters are kept and tracking parameters ignored', async ({ page }) => {
    await page.goto('/https://www.decoracion-ejemplo.es/producto/funda-cojin-lino?utm_source=tiktok&fbclid=123');
    await expectResults(page);
    await expect(page.getByTestId('source-price')).toContainText('desde');
  });

  test('accepts https:/ (single slash), encoded URLs and bare hosts', async ({ page }) => {
    await page.goto('/https:/www.sklum.com/es/000003-fixture-espejo-redondo-ratan.html');
    await expectResults(page);
    await expect(page.getByTestId('source-title')).toContainText('Espejo');

    await page.goto(`/${encodeURIComponent('https://www.decoracion-ejemplo.es/producto/jarron-ceramica-estriado')}`);
    await expectResults(page);
    await expect(page.getByTestId('source-title')).toContainText('Jarrón');

    await page.goto('/www.westwing.es/fixture-sillon-boucle-crema-000002.html');
    await expectResults(page);
  });

  test('the encoded /buscar?url= route works too', async ({ page }) => {
    await page.goto(`/buscar?url=${encodeURIComponent(IKEA)}`);
    await expectResults(page);
  });

  test('a repeated search is served from cache and rendered on the server', async ({ page, request }) => {
    await page.goto(`/${IKEA}`);
    await expectResults(page);
    const html = await (await request.get(`/${IKEA}`)).text();
    expect(html).toContain('data-testid="result-card"');
  });

  test('progress shows real stages while searching', async ({ page }, testInfo) => {
    await page.route('**/api/search', async (route) => {
      // Slow the stream slightly so the progress UI is observable.
      await new Promise((r) => setTimeout(r, 400));
      await route.continue();
    });
    // A non-tracking parameter gives each project its own (uncached) search.
    await page.goto(`/https://www.tienda-incompleta.es/p/mesa-centro-roble-redonda-80?variante=${testInfo.project.name}`);
    await expect(page.getByTestId('progress')).toBeVisible();
    await expectResults(page);
    await expect(page.locator('[data-kind="no_source_price"]')).toBeVisible();
  });

  test('blocked stores fall back to the URL text, honestly labelled', async ({ page }) => {
    await page.goto('/https://www.zarahome.com/es/fixture-jarron-ceramica-texturizada-l00000006');
    await expectResults(page);
    await expect(page.locator('[data-kind="url_only"]')).toBeVisible();
  });

  test('CAPTCHA-protected stores show a clear state and allow describing the product', async ({ page }) => {
    await page.goto('/https://www.amazon.es/dp/B0FIXTURE1');
    const error = page.getByTestId('error-state');
    await expect(error).toBeVisible({ timeout: 15_000 });
    await expect(error).toHaveAttribute('data-code', 'store_blocked');
    await page.getByTestId('describe-input').fill('lámpara de mesa seta de cristal');
    await page.getByRole('button', { name: 'Buscar' }).first().click();
    await page.waitForURL(/\/buscar\?q=/);
    await expectResults(page);
    await expect(page.locator('[data-kind="text_query"]')).toBeVisible();
  });

  test('non-product pages explain the problem', async ({ page }) => {
    await page.goto('/https://www.ikea.com/es/es/cat/lamparas-de-mesa-10732/');
    await expect(page.getByTestId('error-state')).toHaveAttribute('data-code', 'not_a_product', { timeout: 15_000 });
  });

  test('low-confidence matches are folded away', async ({ page }) => {
    await page.goto('/ejemplo/lampara-seta');
    await expectResults(page);
    const toggle = page.getByTestId('toggle-low');
    if (await toggle.count()) {
      const before = await page.getByTestId('result-card').count();
      await toggle.click();
      expect(await page.getByTestId('result-card').count()).toBeGreaterThan(before);
    }
  });

  test('example pages show demo savings, tiers and labels', async ({ page }) => {
    await page.goto('/ejemplo/lampara-seta');
    await expectResults(page);
    await expect(page.getByTestId('max-savings')).toBeVisible();
    await expect(page.getByTestId('result-savings').first()).toContainText('Ahorras');
    await expect(page.locator('[data-tier="very_similar"]').first()).toBeVisible();
    await expect(page.getByTestId('result-card').first()).toContainText('DEMO');
    // Results are sorted: no "similar" card before a "very similar" one.
    const tiers = await page.getByTestId('result-card').evaluateAll((els) => els.map((e) => e.getAttribute('data-tier')));
    const rank = { verified: 0, very_similar: 1, similar: 2, low_confidence: 3 } as Record<string, number>;
    for (let i = 1; i < tiers.length; i++) expect(rank[tiers[i]!]).toBeGreaterThanOrEqual(rank[tiers[i - 1]!]!);
  });

  test('share and copy-link buttons work', async ({ page, context, browserName }) => {
    test.skip(browserName !== 'chromium', 'clipboard permissions');
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/ejemplo/lampara-seta');
    await expectResults(page);
    await page.getByTestId('copy-link').click();
    await expect(page.getByTestId('copy-link')).toHaveText('¡Enlace copiado!');
    expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('/ejemplo/lampara-seta');
  });
});

test.describe('outbound links', () => {
  test('demo alternatives open an honest interstitial, never a fake affiliate link', async ({ page }) => {
    await page.goto('/ejemplo/lampara-seta');
    await expectResults(page);
    const href = await page.getByTestId('result-cta').first().getAttribute('href');
    expect(href).toMatch(/^\/go\/[\w-]+\.[\w-]+$/);
    await page.goto(href!);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('demostración');
  });

  test('/go/ rejects forged or tampered tokens (no open redirect)', async ({ request }) => {
    const forged = Buffer.from(JSON.stringify({ v: 1, p: 'aliexpress', i: '1', u: 'https://evil.example', a: 1, s: 'x', r: 1, t: 'vs', ts: Math.floor(Date.now() / 1000) })).toString('base64url');
    const res = await request.get(`/go/${forged}.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`, { maxRedirects: 0 });
    expect(res.status()).toBe(404);
    expect(res.headers()['location']).toBeUndefined();
    expect((await request.get('/go/not-a-token', { maxRedirects: 0 })).status()).toBe(404);
  });
});
