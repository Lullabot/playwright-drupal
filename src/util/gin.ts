import { Locator } from '@playwright/test';

/**
 * Workarounds for the [Gin](https://www.drupal.org/project/gin) admin theme.
 *
 * The file is named for Gin because that's the specific theme that motivates
 * these helpers today, but the helpers themselves are generic clicks — they
 * just happen to be the form needed when a sticky header (or any other
 * pinned element) overlaps the target. Keeping them in a theme-named file
 * makes it clear what the upstream reason is without promising to cover every
 * future overlap case.
 */

/**
 * Click a locator in a way that survives Gin's sticky page header.
 *
 * Gin pins the admin header as the page scrolls, and that pinned bar
 * routinely overlaps otherwise-visible submit buttons near the bottom of a
 * form. Two steps defeat the overlap without having to disable the theme:
 *
 *   1. `scrollIntoViewIfNeeded()` — Playwright's default visibility check
 *      passes once a button is in the viewport, but the sticky header may
 *      still cover it. Scrolling explicitly makes sure the button ends up at
 *      a position the header is not currently occupying.
 *   2. `click({ force: true })` — bypasses Playwright's actionability checks
 *      (which would otherwise fail because the header intercepts pointer
 *      events on the button).
 */
export async function clickSubmit(locator: Locator): Promise<void> {
  await locator.scrollIntoViewIfNeeded();
  await locator.click({ force: true });
}
