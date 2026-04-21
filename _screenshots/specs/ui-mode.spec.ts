import { test } from '@playwright/test';
import { pngToWebp } from '../lib/convert';
import { disableAnimations } from '../lib/helpers';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const UI_URL = process.env.UI_URL ?? 'http://127.0.0.1:45678/';
const OUT = join(__dirname, '../../docs/images/playwright-ui-mode.webp');

test('capture Playwright UI mode', async ({ page, context }) => {
  test.setTimeout(60_000);
  await disableAnimations(context);
  await page.goto(UI_URL);
  // Wait for the UI mode layout — test tree on left, watch bar on top.
  // The uiMode app renders a toolbar with Run/Reload/Filter controls.
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000);

  // Click a test in the tree to populate the right-hand inspector.
  const firstTest = page.getByText(/a11y-violations\.spec\.ts|homepage has accessibility/).first();
  if (await firstTest.count()) {
    await firstTest.click();
    await page.waitForTimeout(1500);
  }

  const pngPath = join(tmpdir(), 'ui.png');
  await page.screenshot({ path: pngPath, fullPage: false });
  pngToWebp(pngPath, OUT);
});
