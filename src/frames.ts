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
  for (const l of await locators.all()) {
    // Ensure iframes are connected to the DOM before trying to scroll to them.
    // https://github.com/microsoft/playwright/issues/23758
    if (await l.evaluate(iframe => iframe.isConnected)) {
      await l.scrollIntoViewIfNeeded();
    }
  }
  const frames = page.frames();
  const promises = frames.map((frame) => {
    frame.waitForURL(new RegExp('.*/.*', 'i'));
  });
  await Promise.all(promises);
}
