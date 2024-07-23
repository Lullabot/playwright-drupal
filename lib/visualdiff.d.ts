import { type TestInfo, PlaywrightTestArgs } from '@playwright/test';
export declare function defineVisualDiffConfig(cases: VisualDiffUrlConfig): VisualDiffTestCases;
export declare function defaultTestFunction(testCase: VisualDiff, group: VisualDiffGroup): (args: PlaywrightTestArgs, testInfo: TestInfo) => Promise<void>;
/**
 * Execute a set of visual diffs against groups of test cases.
 */
export declare class VisualDiffTestCases {
    /**
     * The configuration object containing all visual diff test cases.
     * @private
     */
    private config;
    /**
     * Construct a new set of VisualDiffTestCases
     *
     * @param config The config that has been imported via "import ..."
     */
    constructor(config: VisualDiffUrlConfig);
    /**
     * Describe, execute, and skip test cases
     *
     * @param overriddenTestFunction
     */
    describe(overriddenTestFunction?: (testCase: VisualDiff, group: VisualDiffGroup) => Function | void): void;
}
/**
 * The top level configuration object.
 */
export type VisualDiffUrlConfig = {
    name: string;
    description?: string;
    groups: VisualDiffGroup[];
};
/**
 * A group of Visual Diff test cases.
 */
export type VisualDiffGroup = BaseVisualDiff & {
    pathPrefix?: string;
    testCases: VisualDiff[];
};
/**
 * An individual test case.
 */
export type VisualDiff = BaseVisualDiff & {
    path: string;
};
export type BaseVisualDiff = {
    name: string;
    description?: string;
    representativeUrl?: string;
    skip?: SkipTest;
};
/**
 * A declaration that a test should be skipped.
 *
 * Nothing prevents calling test.skip() in a custom test function, but this
 * type ensures that every skip has both a reason and a link to a ticket.
 */
export type SkipTest = {
    reason: string;
    willBeFixedIn: string;
    callback?: (testCase: BaseVisualDiff) => boolean;
};
