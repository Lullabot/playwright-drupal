import { Page } from '@playwright/test';
import { waitForAjax } from './forms';

/**
 * Fill a Drupal oEmbed URL field, blur to trigger validation, and warn if
 * Drupal rejects the URL.
 *
 * The sequence matches the one every oEmbed/video-embed bundle test ends up
 * reimplementing: fill → Tab → waitForAjax → inspect for `.messages--error`.
 *
 * Rejected URLs produce a `console.warn` rather than throwing — invalid
 * URLs are common during fixture generation, and callers who want a hard
 * failure can check `.messages--error` themselves or use `waitForSaveOutcome`.
 */
export async function fillOembedUrl(page: Page, selector: string, url: string): Promise<void> {
  const input = page.locator(selector);
  await input.fill(url);
  await input.press('Tab');
  await waitForAjax(page);

  const errorLocator = page
    .locator('[data-drupal-messages] .messages--error, .messages--error')
    .first();
  const visible = await errorLocator.isVisible().catch(() => false);
  if (visible) {
    const errorText = (await errorLocator.textContent().catch(() => null))?.trim() ?? '';
    console.warn(`fillOembedUrl: Drupal rejected the URL "${url}": ${errorText}`);
  }
}
