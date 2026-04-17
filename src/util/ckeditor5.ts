import { FrameLocator, Page } from '@playwright/test';

/**
 * Return the select-all modifier key for a given platform.
 *
 * Exported so unit tests can cover the platform branch without mocking
 * `process.platform`. Defaults to the current platform.
 */
export function selectAllModifier(platform: NodeJS.Platform = process.platform): 'Meta' | 'Control' {
  return platform === 'darwin' ? 'Meta' : 'Control';
}

/**
 * Drive a CKEditor **5** field from a Playwright test.
 *
 * This class is specifically for CKEditor 5 — the editor Drupal core has
 * shipped by default since Drupal 10. It does **not** work with CKEditor 4,
 * which Drupal 10 still ships via the `ckeditor` module for sites that opted
 * in; use a plain `page.frameLocator(...)` + `fill()` approach for that.
 *
 * CKEditor 5 keeps a virtual-DOM model that it synchronises with the visible
 * contenteditable element. Setting the DOM directly (e.g. via Playwright's
 * `locator.fill()`) can be silently dropped because the editor's next
 * re-render overwrites it; it also bypasses any input handlers CKEditor
 * plugins register. `fill()` here dispatches real keyboard events through
 * `page.keyboard`, which CKEditor's event pipeline processes as normal
 * edits.
 *
 * The `selector` targets the widget **wrapper** (e.g.
 * `#edit-field-body-0-value` or `[data-drupal-selector="edit-body-wrapper"]`),
 * not the contenteditable itself — the class drills into
 * `.ck-editor__editable` internally so callers don't have to memorise
 * CKEditor 5's markup.
 *
 * For editors rendered inside an iframe, pass the `FrameLocator` as `root`
 * while keeping `page` as the owning page so keyboard events still reach the
 * right window.
 */
export class Ckeditor5 {
  public page: Page;
  public root: Page | FrameLocator;
  protected selector: string;

  /**
   * @param page
   *   The page the CKEditor 5 instance lives on. Keyboard events are sent to
   *   this page.
   * @param selector
   *   A selector that resolves to the widget wrapper containing the editor
   *   (e.g. `#edit-field-body-0-value`). The class finds the
   *   `.ck-editor__editable` element inside.
   * @param root
   *   Optional frame locator if the editor is inside an iframe. Defaults to
   *   `page`.
   */
  public constructor(page: Page, selector: string, root?: Page | FrameLocator) {
    this.page = page;
    this.selector = selector;
    this.root = root ?? page;
  }

  /**
   * Replace the editor's contents with the given text.
   *
   * Clears existing content (select-all + Backspace) so the call has
   * Playwright-style `fill()` semantics: the final value is exactly `text`,
   * regardless of whether the field was empty.
   */
  public async fill(text: string): Promise<void> {
    const editable = this.root.locator(this.selector).locator('.ck-editor__editable');
    await editable.waitFor({ state: 'visible', timeout: 15000 });
    // Click places the caret inside the editable so the keyboard events
    // below land in CKEditor rather than the outer document.
    await editable.click();
    await this.page.keyboard.press(`${selectAllModifier()}+A`);
    await this.page.keyboard.press('Backspace');
    // keyboard.type fires keydown/keypress/input events that CKEditor 5's
    // event pipeline processes. locator.fill() would set the DOM directly
    // and can be silently dropped on the next model re-render.
    await this.page.keyboard.type(text);
  }
}
