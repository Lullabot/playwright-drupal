import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './specs',
  fullyParallel: false,
  workers: 1,
  use: {
    ignoreHTTPSErrors: true,
    viewport: { width: 1440, height: 900 },
    ...devices['Desktop Chrome'],
  },
  timeout: 120_000,
});
