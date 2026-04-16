/**
 * Fallback selector utilities for Drupal.
 *
 * Use these only when Playwright's human-focused locators (`getByRole`,
 * `getByLabel`, `getByText`, etc.) cannot target the element. CSS/ID selectors
 * are brittle and harder to maintain; prefer semantic locators wherever
 * possible.
 */

/**
 * Rewrite `#id` selectors so they tolerate Drupal's `--HASHSUFFIX`
 * form-rebuild IDs. For example, `#edit-title` becomes
 * `[id="edit-title"], [id^="edit-title--"]`. Pure string transform — safe to
 * use anywhere a CSS selector is accepted.
 *
 * Use only as a last resort when semantic locators (`getByRole`, `getByLabel`)
 * cannot reach the element.
 */
export function idPrefixSelector(selector: string): string {
  return selector.replace(
    /#([a-zA-Z][\w-]*)/g,
    (_, id: string) => `[id="${id}"], [id^="${id}--"]`,
  );
}
