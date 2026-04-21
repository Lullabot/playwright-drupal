import { test } from '@playwright/test';
import { pngToWebp } from '../lib/convert';
import { disableAnimations } from '../lib/helpers';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SITE_URL = process.env.SITE_URL ?? `${process.env.PROJECT_URL}/en`;
const OUT = '/home/andrew.linux/lullabot/playwright-drupal/.claude/worktrees/virtual-coalescing-glade/docs/images/visual-diff-mask-overlay.webp';

test('capture mask overlay on Umami home', async ({ page, context }) => {
  await disableAnimations(context);
  await page.goto(SITE_URL);
  await page.waitForLoadState('networkidle');

  // Mask a few recognisable elements on Umami home: the "umami FOOD MAGAZINE"
  // branding block and the first hero image.
  const masks = [
    page.locator('.site-branding, header .site-name, header a[rel="home"]').first(),
    page.locator('.main-content img, .hero img, .block-views-blocksummary-panel-pane-1 img, .views-row img').first(),
  ];

  const pngPath = join(tmpdir(), 'mask.png');
  await page.screenshot({
    path: pngPath,
    mask: masks,
    maskColor: '#FF00FF',
    fullPage: false,
  });
  pngToWebp(pngPath, OUT);
});
