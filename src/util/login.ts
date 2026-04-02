import { Page } from '@playwright/test';
import { execDrushInTestSite } from '../testcase/test';
import { quote as shellQuote } from 'shell-quote';

/**
 * Log in to Drupal using a one-time login link.
 *
 * Uses `drush user:login` to generate a one-time login URL, navigates to it,
 * and asserts that the user is logged in by verifying the redirect to the
 * user profile page, which works with any Drupal theme.
 *
 * @param page - The Playwright page object.
 * @param user - The Drupal username to log in as (defaults to "admin").
 */
export async function login(page: Page, user: string = 'admin') {
  // Generate a one-time login link for the user.
  const safeUser = shellQuote([user]);
  const result = await execDrushInTestSite(`user:login --name=${safeUser}`);
  const loginUrl = result.stdout.trim();

  // drush user:login returns an absolute URL (e.g. http://...). Extract the
  // path so we can use page.goto() which prepends baseURL.
  const url = new URL(loginUrl);
  await page.goto(url.pathname + url.search);

  // Assert that login succeeded. After a successful one-time login, Drupal
  // redirects to /user/{uid}/edit. This works with any theme, unlike the
  // `user-logged-in` body class which is theme-dependent.
  await page.waitForURL(/\/user\/\d+/);
}
