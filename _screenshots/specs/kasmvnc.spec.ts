import { test } from '@playwright/test';
import { pngToWebp } from '../lib/convert';
import { disableAnimations } from '../lib/helpers';
import { tmpdir, userInfo } from 'node:os';
import { join } from 'node:path';

const KASM_URL = process.env.KASM_URL ?? `${process.env.PROJECT_URL}:8444`;
const OUT = '/home/andrew.linux/lullabot/playwright-drupal/.claude/worktrees/virtual-coalescing-glade/docs/images/kasmvnc-headed-browser.webp';

test.use({
  httpCredentials: { username: userInfo().username, password: 'secret' },
});

test('capture KasmVNC with nested headed browser', async ({ page, context }) => {
  test.setTimeout(90_000);
  await disableAnimations(context);
  await page.goto(KASM_URL);
  // KasmVNC's noVNC UI shows a toolbar with Disconnect button once
  // the WebSocket is up and the framebuffer is rendering.
  await page.getByRole('button', { name: /disconnect/i }).waitFor({ state: 'visible', timeout: 30_000 });
  // Give the framebuffer time to paint the nested browser window.
  await page.waitForTimeout(10_000);

  const pngPath = join(tmpdir(), 'kasm.png');
  await page.screenshot({ path: pngPath, fullPage: false });
  pngToWebp(pngPath, OUT);
});
