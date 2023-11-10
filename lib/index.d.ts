import { expect, TestFixture } from '@playwright/test';
/**
 * Set a simpletest cookie for routing the tests to a separate database.
 */
declare const test: import("@playwright/test").TestType<import("@playwright/test").PlaywrightTestArgs & import("@playwright/test").PlaywrightTestOptions & TestFixture<any, any>, import("@playwright/test").PlaywrightWorkerArgs & import("@playwright/test").PlaywrightWorkerOptions>;
export { test, expect };
