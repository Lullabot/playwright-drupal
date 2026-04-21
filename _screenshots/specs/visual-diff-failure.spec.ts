import { test } from '@playwright/test';
import { pngToWebp } from '../lib/convert';
import { disableAnimations } from '../lib/helpers';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const REPORT_URL = process.env.REPORT_URL ?? `${process.env.PROJECT_URL}:9324`;
const OUT = '/home/andrew.linux/lullabot/playwright-drupal/.claude/worktrees/virtual-coalescing-glade/docs/images/visual-diff-failure.webp';

test('capture visual-diff three-pane view', async ({ page, context }) => {
  test.setTimeout(60_000);
  await disableAnimations(context);
  await page.goto(REPORT_URL);
  // Open the failing visualdiff test.
  await page.getByRole('link', { name: /Capture.*Home/i }).first().click();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);

  // Scroll the Capture-Home-en-1 attachment into view. The HTML report shows
  // screenshot diffs as an "image-diff" component with Expected/Actual/Diff tabs
  // or a stacked layout. Anchoring on the attachment heading.
  const diffHeading = page.getByText(/Capture-Home-en-1/).first();
  await diffHeading.waitFor({ state: 'visible', timeout: 30_000 });
  await diffHeading.scrollIntoViewIfNeeded();
  await page.waitForTimeout(1500);

  // Ensure the "Diff" tab/pane is active if the UI uses tabs.
  const diffTab = page.getByRole('tab', { name: /^Diff$/i });
  if (await diffTab.count()) {
    await diffTab.first().click();
    await page.waitForTimeout(500);
  }

  const pngPath = join(tmpdir(), 'vdiff.png');
  await page.screenshot({ path: pngPath, fullPage: false });
  pngToWebp(pngPath, OUT);
});
