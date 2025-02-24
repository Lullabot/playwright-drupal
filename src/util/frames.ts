import {Page} from "@playwright/test";

/**
 * Wait for all frames to load.
 *
 * @param page
 */
export async function waitForFrames(page: Page): Promise<void> {
  const locators = await page.locator('iframe');
  // Trigger lazy-loading iframes. Since this should be fast, and we don't want to
  // have to deal with concurrency bugs, we do this in serial.
  for (const locator of await locators.all()) {
    // Ensure iframes are connected to the DOM before trying to scroll to them.
    // https://github.com/microsoft/playwright/issues/23758
    if (await locator.evaluate(iframe => iframe.isConnected)) {
      if (await locator.isVisible()) {
        await locator.scrollIntoViewIfNeeded();
        await locator.scrollIntoViewIfNeeded();
        const element = await locator.elementHandle();
        const frame = await element?.contentFrame();
        await frame?.waitForURL(new RegExp('.*/.*', 'i'));
      }
    }
  }
}
