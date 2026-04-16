import { Page } from '@playwright/test';

/**
 * Entity-ID resolution that survives path-aliased save redirects.
 *
 * Some Drupal distributions (notably Drupal CMS) add path aliases to freshly
 * created entities, so the post-save redirect lands on `/my-title` rather
 * than `/node/42`. `extractEntityIdFromPage` extracts the numeric ID either
 * from the current URL or, failing that, from the first canonical edit link
 * rendered on the page.
 */
export async function extractEntityIdFromPage(
  page: Page,
  entityType: 'node' | 'media',
): Promise<string | undefined> {
  const pattern = new RegExp(`/${entityType}/(\\d+)`);
  const directMatch = page.url().match(pattern)?.[1];
  if (directMatch) return directMatch;
  const editHref = await page
    .locator(`a[href*="/${entityType}/"][href*="/edit"]`)
    .first()
    .getAttribute('href')
    .catch(() => null);
  return editHref?.match(pattern)?.[1];
}
