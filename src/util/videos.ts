import type { Page } from "@playwright/test";
import {
  restorePlayback,
  restoreVideoPlayback,
  settleVideos,
  waitForVideos as waitForGenericVideos,
} from "@lullabot/playwright-testing";

import { waitForDrupalToolbar } from "../drupal-preset";

export { restorePlayback, restoreVideoPlayback, settleVideos };

/** Preserve the legacy numeric timeout while applying Drupal toolbar settling. */
export async function waitForVideos(
  page: Page,
  timeoutMs = 5000,
): Promise<string[]> {
  return waitForGenericVideos(page, {
    timeoutMs,
    afterScroll: waitForDrupalToolbar,
  });
}
