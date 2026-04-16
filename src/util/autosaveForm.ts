import { Page } from '@playwright/test';

/**
 * Workarounds for Drupal sites that install the
 * [autosave_form](https://www.drupal.org/project/autosave_form) contrib
 * module (shipped with Drupal CMS).
 *
 * Without these, forms routinely lock up behind the "Resume editing /
 * Discard" modal and file uploads race the module's autosave AJAX. Each
 * function is a no-op on sites that don't install the module.
 */

/**
 * Dismiss the "Resume editing / Discard" dialog by clicking the Discard
 * button. No-op when the dialog is absent.
 */
export async function dismissAutosaveDraft(page: Page): Promise<void> {
  const reject = page.locator('.autosave-form-reject-button').first();
  if (await reject.isVisible().catch(() => false)) {
    await reject.click();
  }
}

/**
 * Wait for autosave_form's bookkeeping to be ready so the form is safe to
 * interact with. Specifically, waits for
 * `input[name="autosave_form_last_autosave_timestamp"]` to have a non-empty
 * value. Resolves immediately on forms without the module (the input is
 * absent).
 */
export async function waitForAutosaveReady(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const input = document.querySelector<HTMLInputElement>(
      'input[name="autosave_form_last_autosave_timestamp"]',
    );
    if (!input) return true;
    return !!input.value;
  });
}
