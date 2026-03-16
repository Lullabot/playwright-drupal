import { Page } from '@playwright/test';
import { execDrushInTestSite } from '../testcase/test';

/**
 * Log in to Drupal as an admin user.
 *
 * Reads credentials from DRUPAL_USER/DRUPAL_PASS environment variables,
 * defaulting to admin/admin. Resets the password via drush to ensure it
 * matches the expected value in the test's isolated database.
 *
 * Supports both the legacy Admin Toolbar (#toolbar-administration) and
 * the Navigation module (#admin-toolbar).
 */
export async function login(page: Page) {
  const username = process.env.DRUPAL_USER || 'admin';
  const password = process.env.DRUPAL_PASS || 'admin';

  // Reset password for this test's isolated database.
  await execDrushInTestSite(`user:password "${username}" "${password}"`);

  await page.goto('/user/login');

  // Detect both toolbar variants — they are mutually exclusive.
  const toolbar = page.locator('#toolbar-administration, #admin-toolbar');
  const loginForm = page.locator('form#user-login-form');

  const visible = await Promise.race([
    toolbar.waitFor({ state: 'visible', timeout: 5000 }).then(() => 'toolbar' as const),
    loginForm.waitFor({ state: 'visible', timeout: 5000 }).then(() => 'form' as const),
  ]);

  if (visible === 'toolbar') {
    return; // Already logged in
  }

  await page.getByLabel('Username').fill(username);
  await page.getByLabel('Password').fill(password);
  await page.click('form#user-login-form input#edit-submit');
  await toolbar.waitFor({ state: 'visible' });
}
