/// <reference types="node" />
import { expect, TestFixture } from '@playwright/test';
/**
 * Set a simpletest cookie for routing the tests to a separate database.
 */
declare const test: import("@playwright/test").TestType<import("@playwright/test").PlaywrightTestArgs & import("@playwright/test").PlaywrightTestOptions & TestFixture<any, any>, import("@playwright/test").PlaywrightWorkerArgs & import("@playwright/test").PlaywrightWorkerOptions>;
/**
 * Run a Drush command in a test site.
 *
 * @param command
 *   The drush command and flags to use, such as
 *   `pm:uninstall environment_indicator -y`.
 */
declare function execDrushInTestSite(command: string): Promise<{
    stdout: string;
    stderr: string;
} & {
    stdout: Buffer;
    stderr: Buffer;
} & {
    stdout: string | Buffer;
    stderr: string | Buffer;
}>;
export { test, expect, execDrushInTestSite };
