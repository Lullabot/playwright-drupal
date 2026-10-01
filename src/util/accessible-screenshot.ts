import type { Locator, Page, TestInfo } from "@playwright/test";
import {
  checkAccessibility as checkGenericAccessibility,
  normalizeTarget,
  takeAccessibleScreenshot as takeGenericAccessibleScreenshot,
} from "@lullabot/playwright-testing";

import {
  createDrupalScreenshotOptions,
  type AccessibilityOptions,
  type ScreenshotOptions,
} from "../drupal-preset";

export type { AccessibilityOptions, ScreenshotOptions } from "../drupal-preset";
export type {
  InteractionState,
  ScreenshotInteractionState,
  ScreenshotStabilizationOptions,
} from "@lullabot/playwright-testing";
export { normalizeTarget };

/** Run the generic axe checks with the legacy Drupal exclusions applied. */
export async function checkAccessibility(
  page: Page,
  testInfo: TestInfo,
  options?: AccessibilityOptions,
) {
  const configured = createDrupalScreenshotOptions(testInfo, {
    accessibility: options,
  });
  return checkGenericAccessibility(page, testInfo, configured.accessibility);
}

/** Capture through the generic implementation with Drupal stabilization defaults. */
export async function takeAccessibleScreenshot(
  page: Page,
  testInfo: TestInfo,
  options?: ScreenshotOptions,
  scrollLocator?: Locator,
  locator?: Locator | Page,
) {
  return takeGenericAccessibleScreenshot(
    page,
    testInfo,
    createDrupalScreenshotOptions(testInfo, options),
    scrollLocator,
    locator,
  );
}
