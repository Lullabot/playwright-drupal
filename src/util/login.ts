import { expect, Page } from '@playwright/test';
import { execDrushInTestSite } from '../testcase/test';

/**
 * Log in to Drupal using a one-time login link.
 *
 * Uses `drush user:login` to generate a one-time login URL, navigates to it,
 * and asserts that the user is logged in by checking for the `user-logged-in`
 * body class that Drupal adds for authenticated users.
 *
 * @param page - The Playwright page object.
 * @param user - The Drupal username to log in as (defaults to "admin").
 */
export async function login(page: Page, user: string = 'admin') {
  // Generate a one-time login link for the user.
  const result = await execDrushInTestSite(`user:login --name="${user}"`);
  const loginUrl = result.stdout.trim();

  // drush user:login returns an absolute URL (e.g. http://...). Extract the
  // path so we can use page.goto() which prepends baseURL.
  const url = new URL(loginUrl);
  await page.goto(url.pathname + url.search);

  // Assert that login succeeded. Drupal adds the `user-logged-in` class to
  // <body> for authenticated users — this is more reliable than checking for
  // the toolbar, which may remain CSS-hidden due to toolbarAntiFlicker.
  await expect(page.locator('body.user-logged-in')).toBeAttached();
}
