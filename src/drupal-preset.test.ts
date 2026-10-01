import { describe, expect, it, vi } from "vitest";

import {
  DRUPAL_BEST_PRACTICE_EXCLUSIONS,
  DRUPAL_WCAG_EXCLUSIONS,
  createDrupalScreenshotOptions,
  waitForDrupalToolbar,
} from "./drupal-preset";

describe("Drupal screenshot preset", () => {
  it("adds legacy Drupal accessibility and stabilization defaults", () => {
    const options = createDrupalScreenshotOptions(
      { project: { name: "desktop firefox" } } as any,
      {
        accessibility: {
          exclude: [".consumer-exclusion"],
          bestPracticeExclude: [".consumer-best-practice"],
          wcagExclude: [".consumer-wcag"],
        },
      },
    );

    expect(options.threshold).toBe(0.5);
    expect(options.accessibility?.exclude).toEqual([".consumer-exclusion"]);
    expect(options.accessibility?.bestPracticeExclude).toEqual([
      ...DRUPAL_BEST_PRACTICE_EXCLUSIONS,
      ".consumer-best-practice",
    ]);
    expect(options.accessibility?.wcagExclude).toEqual([
      ...DRUPAL_WCAG_EXCLUSIONS,
      ".consumer-wcag",
    ]);
    expect(options.stabilization?.images?.recoverErroredImages).toBe(true);
    expect(options.stabilization?.images?.afterScroll).toBe(
      waitForDrupalToolbar,
    );
    expect(options.stabilization?.videos?.afterScroll).toBe(
      waitForDrupalToolbar,
    );
  });

  it("preserves explicit options and can disable only the Drupal exclusions", () => {
    const afterImages = vi.fn();
    const options = createDrupalScreenshotOptions(
      { project: { name: "desktop safari" } } as any,
      {
        threshold: 0.2,
        accessibility: {
          disableDefaultExclusions: true,
          bestPracticeExclude: [".explicit"],
        },
        stabilization: {
          images: {
            recoverErroredImages: false,
            afterScroll: afterImages,
          },
        },
      },
    );

    expect(options.threshold).toBe(0.2);
    expect(options.accessibility?.bestPracticeExclude).toEqual([".explicit"]);
    expect(options.accessibility).not.toHaveProperty(
      "disableDefaultExclusions",
    );
    expect(options.stabilization?.images?.recoverErroredImages).toBe(false);
    expect(options.stabilization?.images?.afterScroll).not.toBe(afterImages);
  });

  it("waits only when a Drupal toolbar is present", async () => {
    const count = vi.fn().mockResolvedValue(1);
    const waitForTimeout = vi.fn().mockResolvedValue(undefined);
    const page = {
      locator: vi.fn().mockReturnValue({ count }),
      waitForTimeout,
    } as any;

    await waitForDrupalToolbar(page);

    expect(page.locator).toHaveBeenCalledWith(
      "#toolbar-administration, #admin-toolbar",
    );
    expect(waitForTimeout).toHaveBeenCalledWith(250);

    count.mockResolvedValue(0);
    waitForTimeout.mockClear();
    await waitForDrupalToolbar(page);
    expect(waitForTimeout).not.toHaveBeenCalled();
  });
});
