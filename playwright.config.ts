import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests run against the *production build* inside workerd
 * (wrangler dev), with FETCH_MODE=fixtures so store pages come from
 * src/lib/extraction/fixtures.ts instead of the internet.
 * Run: npm run test:e2e   (builds first)
 */
const PORT = 8789;
export const E2E_SECRET = 'e2e-link-secret-0123456789';
export const E2E_ADMIN_PASSWORD = 'e2e-admin-password';

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'mobile', use: { ...devices['iPhone 13'], browserName: 'chromium' } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 900 } } },
  ],
  webServer: {
    command: [
      'npx wrangler dev --config dist/server/wrangler.json',
      `--port ${PORT} --ip 127.0.0.1`,
      '--var FETCH_MODE:fixtures',
      '--var RATE_LIMIT_MODE:off',
      `--var LINK_SIGNING_SECRET:${E2E_SECRET}`,
      '--var ADMIN_USER:admin',
      `--var ADMIN_PASSWORD:${E2E_ADMIN_PASSWORD}`,
    ].join(' '),
    url: `http://127.0.0.1:${PORT}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
