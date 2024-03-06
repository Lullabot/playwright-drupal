import {test, type TestInfo, PlaywrightTestArgs} from '@playwright/test';

import {takeAccessibleScreenshot} from "../util/accessible-screenshot";

export function defineVisualDiffConfig(cases: VisualDiffUrlConfig) {
  return new VisualDiffTestCases(cases);
}

export function defaultTestFunction(testCase: VisualDiff, group: VisualDiffGroup) {
  return async (args: PlaywrightTestArgs, testInfo: TestInfo) => {
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

    await args.page.goto(path);
    await takeAccessibleScreenshot(args.page, testInfo, {fullPage: true});
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
   * @param overriddenTestFunction
   */
  // public describe(overriddenTestFunction?: (args: PlaywrightTestArgs, testInfo: TestInfo) => Promise<void> | void) {
  public describe(overriddenTestFunction?: (testCase: VisualDiff, group: VisualDiffGroup) => Function | void) {
    // Handle skipping of test cases, either based on a simple boolean or a callback.
    function doSkip(testCase: BaseVisualDiff) {
      if (typeof testCase.skip !== 'undefined' && (typeof testCase.skip.callback == 'undefined' || testCase.skip.callback(testCase))) {
        // eslint-disable-ext-line @typescript-eslint/no-unused-vars
        test.skip(`${testCase.name}: ${testCase.skip.reason} <${testCase.skip.willBeFixedIn}>`, async ({page}, testInfo) => {});
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
            testFunction = defaultTestFunction(testCase, group)
          }
          else {
            testFunction = overriddenTestFunction(testCase, group);
          }

          test(`${testCase.name}: ${testCase.path}`, testFunction);
        }))
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
}

/**
 * A group of Visual Diff test cases.
 */
export type VisualDiffGroup = BaseVisualDiff & {
  pathPrefix?: string,
  // An array of test cases.
  testCases: VisualDiff[],
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
