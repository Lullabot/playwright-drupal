import type { Page } from "@playwright/test";
import {
  decodeVisibleImages as decodeGenericVisibleImages,
  settleImage,
  waitForImages as waitForGenericImages,
  waitForImagesToDecode as waitForGenericImagesToDecode,
} from "@lullabot/playwright-testing";

import { waitForDrupalToolbar } from "../drupal-preset";

export { settleImage };

/** Preserve the Drupal package's historical opt-in-by-default recovery. */
export async function decodeVisibleImages(
  options: Parameters<typeof decodeGenericVisibleImages>[0],
): ReturnType<typeof decodeGenericVisibleImages> {
  return decodeGenericVisibleImages({
    ...options,
    recoverErroredImages: options.recoverErroredImages ?? true,
  });
}

/** Preserve broken-image recovery and toolbar settling from the Drupal package. */
export async function waitForImages(
  page: Page,
  selector: string,
): Promise<void> {
  return waitForGenericImages(page, selector, {
    recoverErroredImages: true,
    afterScroll: waitForDrupalToolbar,
  });
}

export async function waitForAllImages(page: Page): Promise<void> {
  return waitForImages(page, "img:visible");
}

export async function waitForImagesToDecode(
  page: Page,
  timeoutMs = 15000,
): Promise<string[]> {
  return waitForGenericImagesToDecode(page, timeoutMs, true);
}
