import { test, chromium } from '@playwright/test';
import { join } from 'node:path';

const BASELINE = join(
  process.env.PROJECT_DIR ?? '',
  'test/playwright/tests/visualdiff/visualdiffs.spec.ts-snapshots/Capture-Home-en-1-visualdiff-desktop-linux.png',
);

test('overwrite baseline with different page', async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true,
  });
  await page.goto(`${process.env.PROJECT_URL}/en/recipes`);
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: BASELINE, fullPage: true });
  await browser.close();
});
