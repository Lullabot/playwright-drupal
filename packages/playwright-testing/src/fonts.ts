import {Page} from "@playwright/test";

/**
 * Wait for all web fonts to finish loading.
 *
 * Visual snapshots can flake when text is first painted with fallback font
 * metrics before the web fonts finish loading. The fallback glyphs have
 * different widths, so text wraps onto a different number of lines and the page
 * renders at a slightly different height than it does once the real fonts are
 * applied. By the time Playwright retries the layout has settled, which is why
 * these failures usually only show up on the first attempt.
 *
 * Awaiting `document.fonts.ready` blocks until every font face the page has
 * requested has finished loading (or failed), so the screenshot always captures
 * the settled, web-font layout.
 *
 * @param page
 */
export async function waitForFonts(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
}
