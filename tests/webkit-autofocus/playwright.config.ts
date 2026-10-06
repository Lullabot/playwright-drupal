import { defineConfig, devices } from "@playwright/test";
import type { DrupalTestOptions } from "../../src/testcase/test";

// Exercise the real shared context fixture, including its no-isolation branch.
process.env.PLAYWRIGHT_NO_TEST_ISOLATION = "1";

export default defineConfig<DrupalTestOptions>({
  testDir: ".",
  testMatch: "*.spec.ts",
  outputDir: "../../test-results/webkit-autofocus",
  workers: 1,
  retries: 0,
  reporter: "list",
  use: { trace: "retain-on-failure" },
  projects: [
    { name: "safari-desktop", use: { ...devices["Desktop Safari"] } },
    { name: "iphone", use: { ...devices["iPhone 13"] } },
    { name: "chromium", use: { browserName: "chromium" } },
    { name: "firefox", use: { browserName: "firefox" } },
  ],
});
