import {Page} from "@playwright/test";

/**
 * Remove keyboard focus from the active element.
 *
 * A focused form control paints a focus outline/ring. Whether an element still
 * has focus when the screenshot is taken depends on test timing, so that ring
 * appears in some runs and not others, producing a visual diff that is invisible
 * to a human but trips the strict pixel budget. Blurring the active element
 * first makes the focus state deterministic.
 *
 * @param page
 */
export async function blurActiveElement(page: Page): Promise<void> {
  await page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (el && typeof el.blur === "function") {
      el.blur();
    }
  });
}
