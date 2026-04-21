import { test } from '@playwright/test';
import { pngToWebp } from '../lib/convert';
import { disableAnimations } from '../lib/helpers';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const INPUT_HTML = '/tmp/gh-preview/index.html';
const OUT = '/home/andrew.linux/lullabot/playwright-drupal/.claude/worktrees/virtual-coalescing-glade/docs/images/github-a11y-summary.webp';

test('capture rendered a11y summary markdown', async ({ page, context }) => {
  await disableAnimations(context);
  await page.goto(pathToFileURL(INPUT_HTML).href);
  await page.waitForLoadState('networkidle');
  await page.waitForSelector('.markdown-body h2', { state: 'visible', timeout: 30_000 });
  await page.waitForTimeout(500);

  // Screenshot only the markdown article so the image ends at the content edge.
  const pngPath = join(tmpdir(), 'gh-summary.png');
  await page.locator('.markdown-body').screenshot({ path: pngPath });
  pngToWebp(pngPath, OUT);
});
