import { defineConfig, devices } from "@playwright/test";
import type { AutofocusTestOptions } from "./fixtures";

export default defineConfig<AutofocusTestOptions>({
  testDir: ".",
  testMatch: "*.spec.ts",
  outputDir: "../../../../test-results/webkit-autofocus/generic",
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
