import { expect, test } from '@playwright/test';

/**
 * Layout checks at small widths + screenshots for visual review
 * (saved to test-results/screenshots/).
 */
const pages = [
  ['home', '/'],
  ['results', '/ejemplo/lampara-seta'],
  ['url-only', '/https://www.zarahome.com/es/fixture-jarron-ceramica-texturizada-l00000006'],
  ['blocked', '/https://www.amazon.es/dp/B0FIXTURE1'],
  ['como-funciona', '/como-funciona'],
] as const;

for (const width of [320, 390]) {
  test.describe(`layout at ${width}px`, () => {
    test.use({ viewport: { width, height: 800 } });
    for (const [name, path] of pages) {
      test(`${name} has no horizontal scroll`, async ({ page }, testInfo) => {
        test.skip(testInfo.project.name !== 'mobile', 'mobile widths only');
        await page.goto(path);
        await page.waitForLoadState('networkidle');
        if (name === 'results' || name === 'url-only') await expect(page.getByTestId('result-card').first()).toBeVisible({ timeout: 15_000 });
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow).toBeLessThanOrEqual(0);
        await page.screenshot({ path: `test-results/screenshots/${name}-${width}.png`, fullPage: true });
      });
    }
  });
}

test('result cards are comfortable to tap on iPhone', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'mobile only');
  await page.goto('/ejemplo/espejo-ratan');
  const cta = page.getByTestId('result-cta').first();
  await expect(cta).toBeVisible({ timeout: 15_000 });
  const box = await cta.boundingBox();
  expect(box!.height).toBeGreaterThanOrEqual(40);
  // Two cards per row on phones.
  const xs = await page.getByTestId('result-card').evaluateAll((els) => els.slice(0, 2).map((e) => e.getBoundingClientRect().x));
  expect(xs[1]!).toBeGreaterThan(xs[0]!);
});

test('desktop screenshots', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'desktop only');
  for (const [name, path] of pages) {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: `test-results/screenshots/${name}-desktop.png`, fullPage: true });
  }
});
