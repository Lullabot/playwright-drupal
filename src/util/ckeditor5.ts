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
 * Fill a CKEditor 5 field with arbitrary text.
 *
 * CKEditor 5 renders inside a contenteditable `<div role="textbox">`, so the
 * native `fill()` behaviour doesn't overwrite existing content in the way
 * consumers expect. This class clears the field with a cross-platform
 * select-all (Meta+A on darwin, Control+A elsewhere) followed by Backspace,
 * then fills the new text.
 *
 * Accepts an optional `root` for editors rendered inside an iframe: pass the
 * `FrameLocator` as `root` while keeping `page` as the owning page so the
 * keyboard events still reach the right window.
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
   *   A selector that resolves to the editor's contenteditable element
   *   (e.g. `.ck-editor div[role="textbox"]`).
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
   * Clear the current contents and fill with the given text.
   */
  public async fill(text: string): Promise<void> {
    const editableElement = this.root.locator(this.selector);
    await editableElement.waitFor({ state: 'visible', timeout: 15000 });
    await editableElement.focus();
    const key = selectAllModifier();
    await this.page.keyboard.press(`${key}+A`);
    await this.page.keyboard.press('Backspace');
    await editableElement.fill(text);
  }
}
