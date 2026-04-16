import { Page } from '@playwright/test';
import { clickSubmit } from './gin';

/**
 * Drupal form-interaction primitives.
 *
 * Covers the cross-distribution quirks tests run into when driving Drupal
 * forms: in-flight AJAX, collapsed <details>, autosave_form hijacking the
 * primary Save button, Thunder's moderation "Save as", and the typical
 * save-outcome race between URL change and visible error messages. The
 * Gin sticky-header click workaround lives in `./gin`.
 */

/**
 * Options accepted by `waitForAjax`.
 */
export interface WaitForAjaxOptions {
  /**
   * Maximum time to wait for AJAX and animations to settle, in milliseconds.
   * Defaults to 5 seconds — longer than any well-behaved Drupal AJAX round
   * trip, short enough that a stuck test fails fast.
   */
  timeout?: number;
}

/**
 * Wait for all in-flight Drupal AJAX requests and jQuery animations to settle.
 *
 * Mirrors the predicate used by Drupal core's functional JS test assertion:
 * no `jQuery.active`, no `jQuery(':animated')`, and no
 * `Drupal.ajax.instances[i].ajaxing`. Resolves immediately on pages that
 * don't load jQuery or Drupal's AJAX framework.
 *
 * Call this *after* the action that triggers AJAX — calling it before will
 * short-circuit when the framework has nothing in flight yet.
 *
 * @see \Drupal\FunctionalJavascriptTests\JSWebAssert::assertWaitOnAjaxRequest()
 */
export async function waitForAjax(page: Page, opts: WaitForAjaxOptions = {}): Promise<void> {
  const timeout = opts.timeout ?? 5_000;
  await page.waitForFunction(() => {
    const w = window as unknown as {
      Drupal?: { ajax?: { instances?: Array<{ ajaxing?: boolean } | null> } };
      jQuery?: ((selector: string) => { length: number }) & { active?: number };
    };
    const drupalIdle = !w.Drupal?.ajax?.instances ||
      w.Drupal.ajax.instances.every((i) => !i || !i.ajaxing);
    const jq = w.jQuery;
    const jqIdle = !jq || ((jq.active ?? 0) === 0 && jq(':animated').length === 0);
    return drupalIdle && jqIdle;
  }, undefined, { timeout });
}

/**
 * Expand every collapsed `<details>` element on the page.
 *
 * Drupal renders vertical tabs and field groups as `<details>`; fields inside
 * a closed element are in the DOM but not interactable in the usual sense.
 * Running this once after navigation lets subsequent `.fill()` / `.click()`
 * calls target nested fields directly.
 */
export async function openAllDetails(page: Page): Promise<void> {
  await page.evaluate(() => {
    document.querySelectorAll('details:not([open])').forEach((d) => {
      (d as HTMLDetailsElement).open = true;
    });
  });
}

/**
 * Click a form's Save button in a distribution-agnostic way.
 *
 * Iterates the submit buttons in order and clicks the first one that:
 *   - has a `value` starting with `Save` (covers Thunder's "Save as"), and
 *   - does not carry the `autosave-form-input-monitor` once-marker
 *     (otherwise we'd click the button autosave_form hijacks, which fires an
 *     AJAX autosave rather than a real submit).
 *
 * If no candidate matches, clicks the `fallback` CSS selector instead.
 * Delegates to `clickSubmit` from `./gin` so every submit-style click in
 * this package funnels through the same sticky-header-safe idiom.
 */
export async function clickSaveButton(page: Page, fallback: string): Promise<void> {
  const candidates = page.locator('input[type=submit][name="op"]');
  const total = await candidates.count();
  for (let i = 0; i < total; i++) {
    const btn = candidates.nth(i);
    if (!(await btn.isVisible().catch(() => false))) continue;
    const value = (await btn.getAttribute('value')) || '';
    if (!value.startsWith('Save')) continue;
    const once = (await btn.getAttribute('data-once')) || '';
    if (once.includes('autosave-form-input-monitor')) continue;
    await clickSubmit(btn);
    return;
  }
  await clickSubmit(page.locator(fallback));
}

/**
 * Options accepted by `waitForSaveOutcome`.
 */
export interface WaitForSaveOutcomeOptions {
  /**
   * Regular expression identifying the add-form URL. Success is detected by
   * the URL moving *away* from a URL that matches this pattern.
   */
  addFormPathPattern: RegExp;
  /**
   * Maximum time to wait for either outcome, in milliseconds. Defaults to
   * Playwright's standard 30 seconds.
   */
  timeout?: number;
}

/**
 * Wait for a Drupal entity-form submit to finish one way or another.
 *
 * Races two signals:
 *   - the URL moving away from `addFormPathPattern` (→ returns `'ok'`);
 *   - a `.messages--error` element becoming visible (→ returns `'error'`).
 *
 * Throws with a descriptive error when neither signal appears within the
 * timeout. Matches Playwright's own waiter semantics — callers that need a
 * soft "neither happened" branch can catch the error.
 */
export async function waitForSaveOutcome(
  page: Page,
  opts: WaitForSaveOutcomeOptions,
): Promise<'ok' | 'error'> {
  const timeout = opts.timeout ?? 30_000;
  try {
    return await Promise.race([
      page
        .waitForURL((u) => !opts.addFormPathPattern.test(u.toString()), { timeout })
        .then(() => 'ok' as const),
      page
        .locator('[data-drupal-messages] .messages--error, .messages--error')
        .first()
        .waitFor({ state: 'visible', timeout })
        .then(() => 'error' as const),
    ]);
  } catch (err) {
    throw new Error(
      `waitForSaveOutcome: neither a URL change away from ${opts.addFormPathPattern} ` +
      `nor a .messages--error appeared within ${timeout}ms. Did the form submit?`,
      { cause: err },
    );
  }
}
