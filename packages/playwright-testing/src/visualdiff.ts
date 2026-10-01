import {
  test,
  type BrowserContext,
  type Page,
  type TestInfo,
  type WebError,
} from "@playwright/test";

import {
  takeAccessibleScreenshot,
  type ScreenshotOptions,
} from "./accessible-screenshot.js";
import type { AccessibilityBaseline } from "./accessibility-baseline.js";
import { forcePseudoState, type ForcedPseudoState } from "./pseudo-state.js";
import type { InteractionState } from "./interaction-states.js";

export interface VisualDiffExecutionContext {
  page: Page;
  testInfo: TestInfo;
  testCase: VisualDiff;
  group: VisualDiffGroup;
  config?: VisualDiffUrlConfig;
}

export interface VisualDiffPreset {
  /**
   * Neutral adapter seam for screenshot defaults such as exclusions, browser
   * thresholds, or post-scroll settling hooks.
   */
  screenshotOptions?:
    | ScreenshotOptions
    | ((
        context: VisualDiffExecutionContext,
      ) => ScreenshotOptions | Promise<ScreenshotOptions>);
}

export function defineVisualDiffConfig(
  cases: VisualDiffUrlConfig,
  preset?: VisualDiffPreset,
) {
  return new VisualDiffTestCases(cases, preset);
}

export function defaultTestFunction(
  testCase: VisualDiff,
  group: VisualDiffGroup,
  config?: VisualDiffUrlConfig,
  preset?: VisualDiffPreset,
) {
  return async (
    { page, context }: { page: Page; context: BrowserContext },
    testInfo: TestInfo,
  ) => {
    const MockClass =
      testCase.mockClass ?? group.mockClass ?? config?.mockClass;
    if (MockClass) {
      const mock = new MockClass();
      await mock.mock(page);
    }
    // Log any errors to the Playwright console too.

    context.on("weberror", (webError: WebError) =>
      console.log(webError.error()),
    );
    testInfo.annotations.push({
      type: "Description",
      description: testCase.description,
    });

    const representativeUrl =
      testCase.representativeUrl ??
      group.representativeUrl ??
      config?.representativeUrl;

    if (representativeUrl) {
      testInfo.annotations.push({
        type: "Representative URL",
        description: representativeUrl,
      });
    }

    const path = `${config?.pathPrefix ?? ""}${group.pathPrefix ?? ""}${testCase.path}`;

    await page.goto(path);

    const configuredScreenshotOptions =
      typeof preset?.screenshotOptions === "function"
        ? await preset.screenshotOptions({
            page,
            testInfo,
            testCase,
            group,
            config,
          })
        : (preset?.screenshotOptions ?? {});

    // Merge masks from all three levels: config, group, and testCase.
    const maskSelectors: string[] = [
      ...(config?.mask ?? []),
      ...(group.mask ?? []),
      ...(testCase.mask ?? []),
    ];
    const maskLocators = [
      ...(configuredScreenshotOptions.mask ?? []),
      ...maskSelectors.map((selector) => page.locator(selector)),
    ];

    // Most-specific-wins for maskColor: testCase > group > config.
    const maskColor =
      testCase.maskColor ??
      group.maskColor ??
      config?.maskColor ??
      configuredScreenshotOptions.maskColor;

    const screenshotOptions: ScreenshotOptions = {
      ...configuredScreenshotOptions,
      fullPage: true,
    };
    if (maskLocators.length > 0) {
      screenshotOptions.mask = maskLocators;
    }
    if (maskColor) {
      screenshotOptions.maskColor = maskColor;
    }
    const a11yBaseline =
      testCase.a11yBaseline ??
      group.a11yBaseline ??
      config?.a11yBaseline ??
      configuredScreenshotOptions.accessibility?.baseline;
    if (a11yBaseline || configuredScreenshotOptions.accessibility) {
      screenshotOptions.accessibility = {
        ...configuredScreenshotOptions.accessibility,
        ...(a11yBaseline ? { baseline: a11yBaseline } : {}),
      };
    }

    const interactionStates: VisualDiffInteractionState[] = [
      ...(config?.interactionStates ?? []),
      ...(group.interactionStates ?? []),
      ...(testCase.interactionStates ?? []),
    ];
    if (
      interactionStates.length > 0 ||
      configuredScreenshotOptions.interactionStates
    ) {
      screenshotOptions.interactionStates = [
        ...(configuredScreenshotOptions.interactionStates ?? []),
        ...interactionStates.map(({ selector, states }) => ({
          locator: page.locator(selector),
          states,
        })),
      ];
    }

    // Force declared pseudo-states after navigation and keep them active
    // through both the screenshot and the accessibility scan. These synthetic
    // states are unaffected by takeAccessibleScreenshot() clearing incidental
    // pointer hover and DOM focus.
    const pseudoStates: ForcedPseudoState[] = [
      ...(config?.pseudoStates ?? []),
      ...(group.pseudoStates ?? []),
      ...(testCase.pseudoStates ?? []),
    ];
    const clearPseudoStates: Array<() => Promise<void>> = [];
    let operationFailed = false;
    let operationError: unknown;
    try {
      for (const pseudoState of pseudoStates) {
        clearPseudoStates.push(
          await forcePseudoState(
            page,
            pseudoState.selector,
            pseudoState.pseudoClasses,
          ),
        );
      }
      await takeAccessibleScreenshot(page, testInfo, screenshotOptions);
    } catch (error) {
      operationFailed = true;
      operationError = error;
    }

    const cleanupErrors: unknown[] = [];
    for (const clearPseudoState of clearPseudoStates.reverse()) {
      try {
        await clearPseudoState();
      } catch (error) {
        cleanupErrors.push(error);
      }
    }

    if (operationFailed) {
      if (cleanupErrors.length > 0) {
        throw new AggregateError(
          [operationError, ...cleanupErrors],
          "Visual diff capture and pseudo-state cleanup failed.",
        );
      }
      throw operationError;
    }
    if (cleanupErrors.length === 1) {
      throw cleanupErrors[0];
    }
    if (cleanupErrors.length > 1) {
      throw new AggregateError(
        cleanupErrors,
        "Multiple pseudo-state cleanup operations failed.",
      );
    }
  };
}

/**
 * Execute a set of visual diffs against groups of test cases.
 */
export class VisualDiffTestCases {
  /**
   * The configuration object containing all visual diff test cases.
   * @private
   */
  private config: VisualDiffUrlConfig;
  private preset?: VisualDiffPreset;

  /**
   * Construct a new set of VisualDiffTestCases
   *
   * @param config The config that has been imported via "import ..."
   */
  constructor(config: VisualDiffUrlConfig, preset?: VisualDiffPreset) {
    this.config = config;
    this.preset = preset;
  }

  /**
   * Describe, execute, and skip test cases
   *
   * @param overriddenTestFunction An optional custom test function. Note: when
   *   using a custom test function, automatic mask, interaction-state, and
   *   pseudo-state handling is bypassed. You must apply them yourself.
   */
  public describe(
    overriddenTestFunction?: (
      testCase: VisualDiff,
      group: VisualDiffGroup,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type -- Preserve the existing public callback signature.
    ) => Function | void,
  ) {
    // Handle skipping of test cases, either based on a simple boolean or a callback.
    function shouldSkip(testCase: BaseVisualDiff): boolean {
      return (
        testCase.skip !== undefined &&
        (testCase.skip.callback === undefined ||
          testCase.skip.callback(testCase))
      );
    }

    function registerSkip(testCase: BaseVisualDiff): void {
      const skip = testCase.skip!;
      test.skip(`${testCase.name}: ${skip.reason} <${skip.willBeFixedIn}>`, async () => {});
    }

    this.config.groups.forEach((group: VisualDiffGroup) => {
      // Allow skipping of entire groups of tests.
      if (shouldSkip(group)) {
        registerSkip(group);
        return;
      }

      // Actually describe the group.
      test.describe(group.name, () => {
        group.testCases.forEach((testCase) => {
          // Allow skipping of individual test cases.
          if (shouldSkip(testCase)) {
            registerSkip(testCase);
            return;
          }

          // Define a default function for test cases.
          let testFunction: any;
          if (typeof overriddenTestFunction != "function") {
            testFunction = defaultTestFunction(
              testCase,
              group,
              this.config,
              this.preset,
            );
          } else {
            testFunction = overriddenTestFunction(testCase, group);
          }

          test(`${testCase.name}: ${testCase.path}`, testFunction);
        });
      });
    });
  }
}

/**
 * The top level configuration object.
 */
export type VisualDiffUrlConfig = {
  // The name of the visual diff configuration, such as "Example Site Visual Diffs".
  name: string;
  // A further description of the configuration.
  description?: string;
  // An array of groups of visual diffs. Good groups include by content type, site
  // section, or common feature.
  groups: VisualDiffGroup[];
  /** Prefix prepended before group and case paths. */
  pathPrefix?: string;
  /** Fallback representative URL for every case. */
  representativeUrl?: string;
  /** Fallback network/page mock for every case. */
  mockClass?: MockableConstructor;
  /**
   * CSS selectors for elements to mask globally across all test cases.
   * Useful for dynamic content like copyright years that change over time.
   * These are merged with any group-level and test-case-level masks.
   */
  mask?: string[];
  /**
   * The color of the overlay box for masked elements, in CSS color format.
   * Can be overridden at the group or test-case level.
   */
  maskColor?: string;
  /**
   * Accessibility baseline for managing known violations.
   * When provided, violations matching the baseline are suppressed and
   * toMatchSnapshot() is skipped in favour of baseline-driven assertions.
   */
  a11yBaseline?: AccessibilityBaseline;
  /**
   * Cross-browser hover and focus states to apply for every test case. These
   * are merged with group-level and test-case-level interaction states.
   */
  interactionStates?: VisualDiffInteractionState[];
  /**
   * Chromium-only pseudo-states to force for every test case. These are merged
   * with group-level and test-case-level pseudo-states.
   */
  pseudoStates?: ForcedPseudoState[];
};

/**
 * A group of Visual Diff test cases.
 */
export type VisualDiffGroup = BaseVisualDiff & {
  pathPrefix?: string;
  // An array of test cases.
  testCases: VisualDiff[];
};

export interface MockableConstructor {
  new (): Mockable;
}
export interface Mockable {
  mock(page: Page): Promise<void>;
}

/** A selector and real cross-browser interaction states to apply to it. */
export interface VisualDiffInteractionState {
  selector: string;
  states: InteractionState[];
}

/**
 * An individual test case.
 */
export type VisualDiff = BaseVisualDiff & {
  // A relative path for the test case.
  path: string;
};

export type BaseVisualDiff = {
  // The name of the test case, such as "Alert (White Background)".
  name: string;
  // An optional description of the test case.
  description?: string;
  // An optional representative URL for this test.
  representativeUrl?: string;
  // Allow skipping of this test.
  skip?: SkipTest;
  mockClass?: MockableConstructor;
  /** Accessibility baseline overriding less-specific configuration. */
  a11yBaseline?: AccessibilityBaseline;
  /**
   * CSS selectors for elements to mask when taking screenshots.
   * These are merged with any config-level and (for test cases) group-level masks.
   */
  mask?: string[];
  /**
   * The color of the overlay box for masked elements, in CSS color format.
   * Overrides the mask color set at less-specific levels (config or group).
   */
  maskColor?: string;
  /**
   * Cross-browser hover and focus states to apply while capturing the
   * screenshot and running its accessibility scan.
   */
  interactionStates?: VisualDiffInteractionState[];
  /**
   * Chromium-only pseudo-states to force while capturing the screenshot and
   * running its accessibility scan.
   */
  pseudoStates?: ForcedPseudoState[];
};

/**
 * A declaration that a test should be skipped.
 *
 * Nothing prevents calling test.skip() in a custom test function, but this
 * type ensures that every skip has both a reason and a link to a ticket.
 */
export type SkipTest = {
  // The reason why this test should be skipped, such as "The News listing has undefined ordering".
  reason: string;
  // A link to the ticket or issue that will allow this test to be re-enabled.
  willBeFixedIn: string;
  // An optional callback to control if this test is skipped. For example, a skip
  // callback could check the VisualDiff.path property.
  callback?: (testCase: BaseVisualDiff) => boolean;
};
