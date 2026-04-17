import { Page } from '@playwright/test';
import { execDrushInTestSite } from '../testcase/test';

/**
 * Drupal module-enabled probes.
 *
 * Drush-first design: `isModuleEnabled` queries `drush pm:list` against the
 * isolated test site, and is the preferred primary path for any test running
 * under this package's lifecycle. `isModuleEnabledByPath` is the UI-only
 * fallback for contexts where Drush isn't available.
 *
 * IMPORTANT: `isModuleEnabled` relies on `execDrushInTestSite`, which targets
 * the test site spun up around each test file. Callers running outside that
 * lifecycle (e.g. against a long-lived local DDEV site) should use
 * `isModuleEnabledByPath` instead.
 */

/**
 * Check whether a Drupal module is enabled, using Drush.
 *
 * Must be called inside a bootstrapped test site — see the module-level
 * caveat above.
 */
export async function isModuleEnabled(name: string): Promise<boolean> {
  const result = await execDrushInTestSite('pm:list --status=enabled --field=name');
  const names = result.stdout.split('\n').map((s: string) => s.trim()).filter(Boolean);
  return names.includes(name);
}

/**
 * Check whether a Drupal module is enabled by attempting to access a
 * module-specific admin path. UI-only fallback for contexts without Drush.
 *
 * Returns `true` when `testPath` responds 200 and no access-denied text is
 * visible; `false` on 403/404 or when the page indicates access was denied.
 */
export async function isModuleEnabledByPath(
  page: Page,
  _moduleName: string,
  testPath: string,
): Promise<boolean> {
  const response = await page.goto(testPath, { waitUntil: 'networkidle' });
  if (!response?.ok()) return false;

  const accessDenied = await page
    .locator('text=/access denied/i, text=/you are not authorized/i')
    .count();
  if (accessDenied > 0) return false;

  const alertBox = page.locator('div[role="alert"]').first();
  if ((await alertBox.count()) > 0) {
    const alertText = (await alertBox.textContent()) || '';
    if (alertText.toLowerCase().includes('access') || alertText.toLowerCase().includes('denied')) {
      return false;
    }
  }

  return true;
}

/**
 * Throw with a Drush remediation hint if any of the required modules are
 * not enabled.
 */
export async function validateRequiredModules(_page: Page, names: string[]): Promise<void> {
  const missing: string[] = [];
  for (const name of names) {
    if (!(await isModuleEnabled(name))) missing.push(name);
  }
  if (missing.length > 0) {
    throw new Error(
      `Required Drupal modules are not enabled: ${missing.join(', ')}.\n` +
      `  Via Drush: drush en ${missing.join(' ')} -y\n` +
      `  Via Admin UI: /admin/modules`,
    );
  }
}
