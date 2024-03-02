import { FullConfig } from "@playwright/test";
/**
 * Global setup callback for Playwright
 *
 * https://playwright.dev/docs/test-global-setup-teardown#option-2-configure-globalsetup-and-globalteardown
 * @param config
 */
declare function globalSetup(config: FullConfig): void;
export default globalSetup;
