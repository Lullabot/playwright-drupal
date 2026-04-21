import { test } from '@playwright/test';
import { pngToWebp } from '../lib/convert';
import { disableAnimations } from '../lib/helpers';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const REPORT_URL = process.env.REPORT_URL ?? `${process.env.PROJECT_URL}:9324`;
const OUT = join(__dirname, '../../docs/images/playwright-report-trace-viewer.webp');

test('capture HTML report with trace attachment', async ({ page, context }) => {
  await disableAnimations(context);
  page.setDefaultTimeout(30_000);

  await page.goto(REPORT_URL);
  await page.getByRole('link', { name: /homepage has accessibility violations/i }).first().click();
  await page.waitForLoadState('networkidle');
  // Wait until the trace attachment card is visible (it has an <a href="trace/...">).
  await page.locator('a[href*="trace="]').first().waitFor({ state: 'visible', timeout: 30_000 });
  // Settle layout (React re-render, image thumbnail decode).
  await page.waitForTimeout(2000);

  const pngPath = join(tmpdir(), 'trace.png');
  await page.screenshot({ path: pngPath, fullPage: false });
  pngToWebp(pngPath, OUT);
});
