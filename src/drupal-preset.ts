import type { Page, TestInfo } from "@playwright/test";
import type {
  AccessibilityOptions as GenericAccessibilityOptions,
  ScreenshotOptions as GenericScreenshotOptions,
} from "@lullabot/playwright-testing";

export const DRUPAL_BEST_PRACTICE_EXCLUSIONS = [
  ".focusable.skip-link",
  '[role="article"]',
  '[role="region"]',
  ".footer__inner-3",
] as const;

export const DRUPAL_WCAG_EXCLUSIONS = [
  '[data-drupal-media-preview="ready"]',
] as const;

export const DRUPAL_TOOLBAR_SELECTOR =
  "#toolbar-administration, #admin-toolbar";
export const DRUPAL_TOOLBAR_SETTLE_MS = 250;

/** Legacy accessibility options accepted by @lullabot/playwright-drupal. */
export interface AccessibilityOptions extends GenericAccessibilityOptions {
  /** Skip the Drupal package's built-in axe exclusions. */
  disableDefaultExclusions?: boolean;
}

/** Generic screenshot options plus the legacy Drupal accessibility switch. */
export interface ScreenshotOptions extends Omit<
  GenericScreenshotOptions,
  "accessibility"
> {
  accessibility?: AccessibilityOptions;
}

/** Let Drupal's fixed/sticky admin toolbar finish repositioning after a scroll. */
export async function waitForDrupalToolbar(page: Page): Promise<void> {
  if ((await page.locator(DRUPAL_TOOLBAR_SELECTOR).count()) > 0) {
    await page.waitForTimeout(DRUPAL_TOOLBAR_SETTLE_MS);
  }
}

function composeAfterScroll(
  hook?: (page: Page) => Promise<void>,
): (page: Page) => Promise<void> {
  if (!hook) {
    return waitForDrupalToolbar;
  }

  return async (page: Page) => {
    await waitForDrupalToolbar(page);
    await hook(page);
  };
}

/**
 * Apply the historical Drupal defaults through the generic package's public
 * preset seam. Explicit caller choices always win over legacy defaults.
 */
export function createDrupalScreenshotOptions(
  testInfo: Pick<TestInfo, "project">,
  options: ScreenshotOptions = {},
): GenericScreenshotOptions {
  const {
    disableDefaultExclusions = false,
    bestPracticeExclude = [],
    wcagExclude = [],
    ...accessibility
  } = options.accessibility ?? {};

  const projectName = testInfo.project?.name;
  const threshold =
    options.threshold ??
    (projectName === "desktop firefox"
      ? 0.5
      : projectName === "desktop safari"
        ? 0.8
        : undefined);

  const imageOptions = options.stabilization?.images;
  const videoOptions = options.stabilization?.videos;

  return {
    ...options,
    ...(threshold === undefined ? {} : { threshold }),
    accessibility: {
      ...accessibility,
      bestPracticeExclude: [
        ...(disableDefaultExclusions ? [] : DRUPAL_BEST_PRACTICE_EXCLUSIONS),
        ...bestPracticeExclude,
      ],
      wcagExclude: [
        ...(disableDefaultExclusions ? [] : DRUPAL_WCAG_EXCLUSIONS),
        ...wcagExclude,
      ],
    },
    stabilization: {
      ...options.stabilization,
      images: {
        ...imageOptions,
        recoverErroredImages: imageOptions?.recoverErroredImages ?? true,
        afterScroll: composeAfterScroll(imageOptions?.afterScroll),
      },
      videos: {
        ...videoOptions,
        afterScroll: composeAfterScroll(videoOptions?.afterScroll),
      },
    },
  };
}
