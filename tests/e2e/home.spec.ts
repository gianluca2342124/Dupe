import { expect, test } from '@playwright/test';

test.describe('home', () => {
  test('loads with the promise, the form and the prefix trick', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/');
    await expect(page).toHaveTitle(/Gemelu/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Lo mismo.');
    await expect(page.getByTestId('url-input').first()).toBeVisible();
    await expect(page.getByText('gemelu.com/', { exact: false }).first()).toBeVisible();
    await expect(page.getByTestId('example-preview')).toContainText('DEMO');
    expect(errors).toEqual([]);
  });

  test('the form accepts pasted share text and lands on the prefix URL', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('url-input').first().fill('Mira este sillón: https://www.westwing.es/fixture-sillon-boucle-crema-000002.html?utm_source=app');
    await page.getByTestId('url-submit').first().click();
    await page.waitForURL(/\/https:\/\/www\.westwing\.es\/fixture-sillon-boucle-crema-000002\.html/);
    await expect(page.getByTestId('source-title')).toContainText('Sillón con reposabrazos en tejido bouclé');
    await expect(page.getByTestId('result-card').first()).toBeVisible();
  });

  test('the form rejects text that is not a link', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('url-input').first().fill('una lámpara bonita');
    await page.getByTestId('url-submit').first().click();
    await expect(page.getByRole('alert').first()).toContainText('no parece un enlace');
    await expect(page).toHaveURL(/\/$/);
  });

  test('has SEO essentials', async ({ page, request }) => {
    await page.goto('/');
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /gemelu\.com\/$/);
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', /\/og\/default\.png$/);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /index/);
    const robots = await (await request.get('/robots.txt')).text();
    expect(robots).toContain('Disallow: /buscar');
    expect(robots).toContain('Sitemap:');
    expect((await request.get('/sitemap-index.xml')).status()).toBe(200);
    expect((await request.get('/og/default.png')).status()).toBe(200);
  });

  test('legal and content pages render', async ({ page }) => {
    for (const path of ['/como-funciona', '/privacidad', '/cookies', '/aviso-legal', '/condiciones', '/afiliacion', '/contacto', '/empresa', '/bot']) {
      const res = await page.goto(path);
      expect(res?.status(), path).toBe(200);
      await expect(page.getByRole('heading', { level: 1 }), path).toBeVisible();
    }
    await page.goto('/aviso-legal');
    await expect(page.locator('.pending').first()).toBeVisible();
  });
});
