import { Locator, Page } from '@playwright/test';
import { waitForAjax } from './forms';

/**
 * Reliable `managed_file` upload that survives several cross-cutting Drupal
 * races: the `autosave_form` AJAX, widgets that override the JS auto-click on
 * the upload button (e.g. `image_focal_point`), and the rare case where the
 * file-ID hidden input never lands server-side.
 */

/**
 * Default maximum time (ms) to wait for Drupal's `managed_file` element to
 * expose its server-side file ID via the `[fids]` hidden input.
 *
 * 15 seconds is well above what a normal local upload takes (sub-second for
 * small fixtures) but leaves headroom for slow CI runners, large files, and
 * the `autosave_form` AJAX that runs concurrently. Kept deliberately higher
 * than `waitForAjax`'s 5s default so a brief AJAX burst doesn't exhaust the
 * poll window before the fid lands.
 */
const DEFAULT_FID_POLL_MS = 15_000;

export interface UploadManagedFileOptions {
  /**
   * Retry the `setInputFiles` once if the file-ID hidden input is still empty
   * after the initial upload. Defaults to `true`.
   */
  retry?: boolean;
  /**
   * Maximum time (ms) to wait for the file-ID hidden input to populate.
   * Defaults to `DEFAULT_FID_POLL_MS` (15 seconds).
   */
  maxPollMs?: number;
}

async function waitForFid(
  page: Page,
  fieldSelector: string,
  maxPollMs: number,
): Promise<boolean> {
  const fidInput = page.locator(fieldSelector).locator('input[type=hidden][name$="[fids]"]').first();
  const deadline = Date.now() + maxPollMs;
  while (Date.now() < deadline) {
    const value = await fidInput.inputValue().catch(() => '');
    if (value && value.trim() !== '') return true;
    await page.waitForTimeout(200);
  }
  return false;
}

/**
 * Click the `managed_file` upload button.
 *
 * Drupal renders `-upload-button` as a visually-hidden submit input (the
 * progressive-enhancement pattern: the button is the non-JS fallback, and
 * core's JS normally intercepts the file-input change to submit it for the
 * user). Playwright's default actionability check treats "visually hidden"
 * as "not actionable" and throws. We bypass that with `force: true` because
 * we *do* want to click the real button: some widgets (e.g.
 * `image_focal_point`) override the JS auto-click, and the only reliable
 * way to drive an upload across those widgets is to click the button
 * ourselves.
 */
async function clickUploadButton(button: Locator): Promise<void> {
  await button.click({ force: true });
}

/**
 * Upload a file into a Drupal `managed_file` element and block until the
 * server-side file ID has materialised.
 *
 * Steps:
 *   1. `setInputFiles` on the wrapped `<input type=file>`.
 *   2. `waitForAjax` — lets `autosave_form` and the widget's own AJAX settle.
 *   3. Click the `-upload-button` (see `clickUploadButton`).
 *   4. Poll the `[fids]` hidden input until it becomes non-empty.
 *   5. If `opts.retry !== false`, retry the upload once when the fid never
 *      materialised.
 *   6. Auto-fill any newly-visible required text field in the wrapper (alt
 *      text, etc.) with a placeholder.
 *
 * Throws when the file ID still isn't present after the retry.
 */
export async function uploadManagedFile(
  page: Page,
  fieldSelector: string,
  fixturePath: string,
  opts: UploadManagedFileOptions = {},
): Promise<void> {
  const field = page.locator(fieldSelector);
  const fileInput = field.locator('input[type=file]').first();
  const uploadBtn = field.locator('[id$="-upload-button"]').first();
  const maxPollMs = opts.maxPollMs ?? DEFAULT_FID_POLL_MS;

  await fileInput.setInputFiles(fixturePath);
  await waitForAjax(page);

  if ((await uploadBtn.count()) > 0) {
    await clickUploadButton(uploadBtn);
    await waitForAjax(page);
  }

  let ok = await waitForFid(page, fieldSelector, maxPollMs);

  if (!ok && opts.retry !== false) {
    await fileInput.setInputFiles(fixturePath);
    await waitForAjax(page);
    if ((await uploadBtn.count()) > 0) {
      await clickUploadButton(uploadBtn);
      await waitForAjax(page);
    }
    ok = await waitForFid(page, fieldSelector, maxPollMs);
  }

  if (!ok) {
    throw new Error(`uploadManagedFile: file ID never materialised for ${fieldSelector}`);
  }

  const requiredAfterUpload = field.locator(
    'input[type=text][required]:visible, textarea[required]:visible',
  );
  const n = await requiredAfterUpload.count();
  for (let i = 0; i < n; i++) {
    const el = requiredAfterUpload.nth(i);
    const existing = await el.inputValue().catch(() => '');
    if (!existing) await el.fill('Auto-generated test value');
  }
}
