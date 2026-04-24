import { Page } from '@playwright/test';

/**
 * Entity-ID resolution that survives path-aliased save redirects.
 *
 * On sites that use pathauto (optionally with subpathauto), freshly
 * created entities get auto-aliased immediately, so the post-save
 * redirect lands on `/my-title` rather than `/node/42`, and every edit
 * link rendered on the page is also aliased.
 * `extractEntityIdFromPage` extracts the numeric ID from, in order:
 * 1. a canonical `/{entityType}/N` segment in the current URL,
 * 2. `drupalSettings.path.currentPath`, which Drupal core always
 *    populates with the unaliased internal route path (e.g. `node/42`),
 * 3. the first canonical `/{entityType}/N/edit` link rendered on the page.
 *
 * `entityType` is the path segment used by the entity's canonical route —
 * typically the machine name (`'node'`, `'media'`, `'user'`, etc.). Works
 * for any entity whose edit route follows `/<entityType>/<id>/edit`. Entity
 * types routed under `/admin/...` (for example some config entities) are
 * not handled here.
 */
export async function extractEntityIdFromPage(
  page: Page,
  entityType: string,
): Promise<string | undefined> {
  const pattern = new RegExp(`(?:^|/)${entityType}/(\\d+)`);
  const directMatch = page.url().match(pattern)?.[1];
  if (directMatch) return directMatch;
  const currentPath = await page
    .evaluate(() => {
      const w = window as unknown as { drupalSettings?: { path?: { currentPath?: string } } };
      return w.drupalSettings?.path?.currentPath ?? null;
    })
    .catch(() => null);
  const settingsMatch = currentPath?.match(pattern)?.[1];
  if (settingsMatch) return settingsMatch;
  const editHref = await page
    .locator(`a[href*="/${entityType}/"][href*="/edit"]`)
    .first()
    .getAttribute('href')
    .catch(() => null);
  return editHref?.match(pattern)?.[1];
}
