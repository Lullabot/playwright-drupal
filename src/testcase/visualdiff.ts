import {Page, test, WebError} from '@playwright/test';

import {takeAccessibleScreenshot, AccessibilityBaseline} from "../util";

export function defineVisualDiffConfig(cases: VisualDiffUrlConfig) {
  return new VisualDiffTestCases(cases);
}

export function defaultTestFunction(testCase: VisualDiff, group: VisualDiffGroup, config?: VisualDiffUrlConfig) {
  // @ts-ignore
  return async ({page, context}, testInfo) => {
    if (testCase.mockClass != undefined) {
      const mock = new testCase.mockClass;
      await mock.mock(page);
    }
    // Log any errors to the Playwright console too.

    context.on('weberror', (webError: WebError) => console.log(webError.error()));
    testInfo.annotations.push({
      type: 'Description',
      description: testCase.description,
    })

    let representativeUrl: string = "";
    if (testCase.representativeUrl) {
      representativeUrl = testCase.representativeUrl;
    } else if (group.representativeUrl) {
      representativeUrl = group.representativeUrl;
    }

    if (representativeUrl) {
      testInfo.annotations.push({
        type: 'Representative URL',
        description: representativeUrl,
      });
    }

    let path = testCase.path;
    if (group.pathPrefix) {
      path = group.pathPrefix + path;
    }

    await page.goto(path);

    // Merge masks from all three levels: config, group, and testCase.
    const maskSelectors: string[] = [
      ...(config?.mask ?? []),
      ...(group.mask ?? []),
      ...(testCase.mask ?? []),
    ];
    const maskLocators = maskSelectors.map(selector => page.locator(selector));

    // Most-specific-wins for maskColor: testCase > group > config.
    const maskColor = testCase.maskColor ?? group.maskColor ?? config?.maskColor;

    const screenshotOptions: Record<string, any> = {fullPage: true};
    if (maskLocators.length > 0) {
      screenshotOptions.mask = maskLocators;
    }
    if (maskColor) {
      screenshotOptions.maskColor = maskColor;
    }
    if (config?.a11yBaseline) {
      screenshotOptions.accessibility = { baseline: config.a11yBaseline }
    }

    await takeAccessibleScreenshot(page, testInfo, screenshotOptions);
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

  /**
   * Construct a new set of VisualDiffTestCases
   *
   * @param config The config that has been imported via "import ..."
   */
  constructor(config: VisualDiffUrlConfig) {
    this.config = config;
  }

  /**
   * Describe, execute, and skip test cases
   *
   * @param overriddenTestFunction An optional custom test function. Note: when
   *   using a custom test function, automatic mask merging from config, group,
   *   and test-case levels is bypassed. You must handle mask application yourself.
   */
  public describe(overriddenTestFunction?: (testCase: VisualDiff, group: VisualDiffGroup) => Function | void) {
    // Handle skipping of test cases, either based on a simple boolean or a callback.
    function doSkip(testCase: BaseVisualDiff) {
      if (typeof testCase.skip !== 'undefined' && (typeof testCase.skip.callback == 'undefined' || testCase.skip.callback(testCase))) {
        // eslint-disable-ext-line @typescript-eslint/no-unused-vars
        test.skip(`${testCase.name}: ${testCase.skip.reason} <${testCase.skip.willBeFixedIn}>`, async ({page}, testInfo) => {
        });
      }
    }

    this.config.groups.forEach((group: VisualDiffGroup) => {
      // Allow skipping of entire groups of tests.
      if (group.skip) {
        doSkip(group);
        return;
      }

      // Actually describe the group.
      test.describe(group.name, () => {
        group.testCases.forEach((testCase => {
          // Allow skipping of individual test cases.
          if (testCase.skip) {
            doSkip(testCase);
            return;
          }

          // Define a default function for test cases.
          let testFunction: any;
          if (typeof overriddenTestFunction != 'function') {
            testFunction = defaultTestFunction(testCase, group, this.config)
          } else {
            testFunction = overriddenTestFunction(testCase, group);
          }

          test(`${testCase.name}: ${testCase.path}`, testFunction);
        }));
      });
    });

  }
}


/**
 * The top level configuration object.
 */
export type VisualDiffUrlConfig = {
  // The name of the visual diff configuration, such as "Lullabot.com Visual Diffs".
  name: string,
  // A further description of the configuration.
  description?: string,
  // An array of groups of visual diffs. Good groups include by content type, site
  // section, or common feature.
  groups: VisualDiffGroup[],
  /**
   * CSS selectors for elements to mask globally across all test cases.
   * Useful for dynamic content like copyright years that change over time.
   * These are merged with any group-level and test-case-level masks.
   */
  mask?: string[],
  /**
   * The color of the overlay box for masked elements, in CSS color format.
   * Can be overridden at the group or test-case level.
   */
  maskColor?: string,
  /**
   * Accessibility baseline for managing known violations.
   * When provided, violations matching the baseline are suppressed and
   * toMatchSnapshot() is skipped in favour of baseline-driven assertions.
   */
  a11yBaseline?: AccessibilityBaseline,
}

/**
 * A group of Visual Diff test cases.
 */
export type VisualDiffGroup = BaseVisualDiff & {
  pathPrefix?: string,
  // An array of test cases.
  testCases: VisualDiff[],
}

export interface MockableConstructor {
  new (): Mockable;
}
export interface Mockable {
  mock(page: Page): Promise<void>
}

/**
 * An individual test case.
 */
export type VisualDiff = BaseVisualDiff & {
  // A relative path for the test case.
  path: string,
}

export type BaseVisualDiff = {
  // The name of the test case, such as "Alert (White Background)".
  name: string,
  // An optional description of the test case.
  description?: string,
  // An optional representative URL for this test.
  representativeUrl?: string,
  // Allow skipping of this test.
  skip?: SkipTest,
  mockClass?: MockableConstructor,
  /**
   * CSS selectors for elements to mask when taking screenshots.
   * These are merged with any config-level and (for test cases) group-level masks.
   */
  mask?: string[],
  /**
   * The color of the overlay box for masked elements, in CSS color format.
   * Overrides the mask color set at less-specific levels (config or group).
   */
  maskColor?: string,
}

/**
 * A declaration that a test should be skipped.
 *
 * Nothing prevents calling test.skip() in a custom test function, but this
 * type ensures that every skip has both a reason and a link to a ticket.
 */
export type SkipTest = {
  // The reason why this test should be skipped, such as "The News listing has undefined ordering".
  reason: string,
  // A link to the ticket or issue that will allow this test to be re-enabled.
  willBeFixedIn: string,
  // An optional callback to control if this test is skipped. For example, a skip
  // callback could check the VisualDiff.path property.
  callback?: (testCase: BaseVisualDiff) => boolean
}
