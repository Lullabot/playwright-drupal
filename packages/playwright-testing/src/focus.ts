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
 * @returns `true` if an element was blurred, `false` if nothing was focused.
 */
export async function blurActiveElement(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    // `document.activeElement` falls back to `<body>`/`<html>` when nothing is
    // focused. Blurring that paints no focus ring but can still fire `focusout`
    // handlers, so skip it and only blur a genuinely focused control.
    if (!el || el === document.body || el === document.documentElement || typeof el.blur !== "function") {
      return false;
    }
    el.blur();
    return true;
  });
}
