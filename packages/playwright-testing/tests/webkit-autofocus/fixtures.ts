import { test as base, expect } from "@playwright/test";
import { suppressWebKitAutofocus } from "@lullabot/playwright-testing";

// Local test harness only; the package exports utilities, not a shared fixture.
export interface AutofocusTestOptions {
  webkitAutofocusWorkaround: boolean;
}

export const test = base.extend<AutofocusTestOptions>({
  webkitAutofocusWorkaround: [true, { option: true }],
  context: async ({ context, browserName, webkitAutofocusWorkaround }, use) => {
    if (browserName === "webkit" && webkitAutofocusWorkaround) {
      await context.addInitScript(suppressWebKitAutofocus);
    }
    await use(context);
  },
});

export { expect };
