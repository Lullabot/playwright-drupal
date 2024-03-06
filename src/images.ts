import {Page} from "@playwright/test";
import {Serializable} from "playwright-core/types/structs";

/**
 * Wait for images specified by a selector to load.
 *
 * The function must scroll the page to handle lazy-loading images. After all
 * images have loaded, the page is scrolled back to the top.
 *
 * See https://github.com/microsoft/playwright/issues/14388 for further details.
 *
 * @param page
 * @param selector
 */
export async function waitForImages(page: Page, selector: string): Promise<Serializable> {
  const locators = page.locator(selector);

  // Trigger lazy-loading images. Since this should be fast, and we don't want to
  // have to deal with concurrency bugs, we do this in serial.
  for (const l of await locators.all()) {
    // Ensure images are connected to the DOM before trying to scroll to them.
    // https://github.com/microsoft/playwright/issues/23758
    if (await l.evaluate(image => image.isConnected)) {
      await l.scrollIntoViewIfNeeded();
    }
  }

  // Make sure all images have loaded.
  // @ts-ignore
  const promises = (await locators.all()).map(locator => locator.evaluate(image => image.complete || new Promise(f => image.onload = f)));
  await Promise.all(promises);

  // Scroll to the top.
  await page.evaluate(() =>
    window.scroll({
      top: 0,
      left: 0,
      behavior: 'instant',
    })
  );

  // The toolbar moves position even after the browser has updated the Y position.
  // This is especially noticeable in tablet viewports. The toolbar also ends
  // up slightly below the top of the viewport, but at least this way we have
  // more consistent screenshots.
  if (await page.locator('#toolbar-administration').count() > 0) {
    await page.waitForTimeout(250);
  }

  // window.scroll is async and doesn't return a promise, so wait until the
  // browser confirms we are at the top again.
  const forcedScroll = false;
  return page.waitForFunction(forcedScroll => {
    // The above scroll can fail when a Drupal dialog is open. So, if we
    // haven't scrolled successfully, we trigger another one.
    if (window.scrollY !== 0 && !forcedScroll) {
      window.scroll({
        top: 0,
        left: 0,
        behavior: 'instant',
      });

      // But only trigger this once, so we don't override previous scroll
      // calls.
      forcedScroll = true;
    }
    return window.scrollY == 0;
  }, forcedScroll);
}

/**
 * Wait for all image tags on the page to load.
 *
 * @param page
 */
export async function waitForAllImages(page: Page): Promise<Serializable> {
  return waitForImages(page, 'img:visible');
}
