import { Page } from '@playwright/test';
import { waitForAjax } from './forms';

/**
 * Drupal media_library widget automation.
 *
 * `selectFirstMediaFromLibrary` drives the whole modal dance end-to-end:
 * opens the library, optionally uploads a caller-supplied fixture when the
 * library is empty, selects the first available item, and clicks
 * "Insert selected". `findMediaIdFromListing` provides the post-save
 * fallback for distributions where the redirect doesn't land on /media/N.
 */

export interface SelectFirstMediaFromLibraryOptions {
  /**
   * Path to a file to upload when the media library is empty. When omitted
   * and the library is empty, the function throws.
   */
  uploadFixturePath?: string;
}

/**
 * Open a required `media_library` widget, select the first available media
 * item in the modal dialog, and click "Insert selected".
 *
 * When the library is empty:
 *   - If `opts.uploadFixturePath` is provided, uploads the fixture first,
 *     fills any post-upload required text field, saves, and then selects
 *     the newly-uploaded item.
 *   - Otherwise, throws `Error('Media library is empty and no
 *     uploadFixturePath was supplied')`.
 */
export async function selectFirstMediaFromLibrary(
  page: Page,
  wrapperSelector: string,
  opts: SelectFirstMediaFromLibraryOptions = {},
): Promise<void> {
  const wrapper = page.locator(wrapperSelector);
  const openBtn = wrapper
    .locator('.js-media-library-open-button, [name*="media-library-open-button"], [id*="media-library-open-button"]')
    .first();
  await openBtn.scrollIntoViewIfNeeded();
  await openBtn.click();

  const dialog = page
    .locator('.ui-dialog:visible')
    .filter({ has: page.locator('[class*="media-library"]') })
    .first();
  await dialog.waitFor({ state: 'visible' });
  await waitForAjax(page);

  const existingItemCount = await dialog
    .locator('.media-library-item input[type=checkbox], .media-library-item input[type=radio]')
    .count();

  if (existingItemCount === 0) {
    if (!opts.uploadFixturePath) {
      throw new Error('Media library is empty and no uploadFixturePath was supplied');
    }
    const fileInput = dialog.locator('input[type=file]').first();
    if ((await fileInput.count()) === 0) {
      throw new Error('Media library modal has no existing items and no upload input');
    }
    await fileInput.setInputFiles(opts.uploadFixturePath);
    await waitForAjax(page);

    const postUploadRequired = dialog.locator(
      'input[type=text][required]:visible, textarea[required]:visible',
    );
    const n = await postUploadRequired.count();
    for (let i = 0; i < n; i++) {
      const el = postUploadRequired.nth(i);
      const existing = await el.inputValue().catch(() => '');
      if (!existing) await el.fill('Auto-generated test value');
    }

    const saveBtn = dialog.getByRole('button', { name: /^Save$/i }).first();
    if ((await saveBtn.count()) > 0) {
      await saveBtn.click();
      await waitForAjax(page);
    }
  }

  const firstCard = dialog
    .locator('.js-click-to-select-checkbox, .media-library-item__click-to-select-checkbox')
    .first();
  await firstCard.waitFor({ state: 'visible' });
  await firstCard.click();

  const insertByText = dialog.getByRole('button', { name: /^Insert/i }).first();
  const insertInput = dialog.locator('input[type=submit][value^="Insert"]').first();
  const insertBtn = (await insertByText.count()) > 0 ? insertByText : insertInput;
  await insertBtn.click();

  await dialog.waitFor({ state: 'hidden' });
  await waitForAjax(page);
}

/**
 * Media entities don't always redirect to `/media/N` after save. When
 * that happens, look the entity up by name on `/admin/content/media` and
 * extract the ID from the first matching link.
 */
export async function findMediaIdFromListing(
  page: Page,
  baseUrl: string,
  name: string,
): Promise<string | undefined> {
  await page.goto(`${baseUrl}/admin/content/media`);
  const link = page.locator('table a', { hasText: name }).first();
  const href = await link.getAttribute('href', { timeout: 10000 }).catch(() => null);
  return href?.match(/\/media\/(\d+)/)?.[1];
}
