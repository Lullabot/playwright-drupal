# Writing Tests

The important part of writing a test is to use the Test class shipped with this library (that extends Playwright's normal Test class):

```typescript
import { test, expect } from '@packages/playwright-drupal';
```

This will trigger the setup and teardown of the separate Drupal site.

If you have a test that you don't want to run this way, import test and expect from `@playwright/test` as normal.

## Recording Tests in VS Code

The VS Code "Record new" command generates absolute URLs and default imports. To keep URLs relative and use `@lullabot/playwright-drupal` helpers, record **at cursor** into a test file.

1. Create a test from the following template:

   ```ts
   // test/playwright/tests/test1.spec.ts
   import { test, expect, execDrushInTestSite } from '@packages/playwright-drupal';

   // 1. Update the test name.
   test('new test', async ({ page }) => {
     // 2. Keep paths relative; "Record new" would supply the absolute URL.
     await page.goto('/');
     // 3. Place cursor here, then use "Record at cursor"
   });
   ```

2. In the VS Code Testing sidebar, under Playwright:

   * Scroll to and toggle the correct configs (gear icon) pointing to your project's `test/playwright/playwright.config.ts`.
   * Use **Record at cursor** to append steps into the template.
     (If the recorder adds an extra absolute `page.goto('http://…')`, change it to keep them relative `/`.)

This keeps tests portable across DDEV/CI, leverages `use.baseURL`, and ensures Lullabot helpers are available.

## Running Tests Without Isolation

There are times you may want to run Playwright without isolating test runs. Perhaps you're manually scaffolding test content by hand, before writing code to create it. Or perhaps you would like to be absolutely sure that a test passes or fails when running against mariadb.

To do this, run `export PLAYWRIGHT_NO_TEST_ISOLATION=1`. This **must** be done inside a ddev shell (via ddev ssh) and not `ddev playwright` or `ddev exec`. Consider running Playwright with `--workers=1` and with a single browser, since any changes to the database will persist.

## Verbose CLI Output

By default, output from CLI commands (drush, task) and browser web errors is captured and attached to each test result as text files. This keeps the terminal clean when running tests in parallel, since output from different workers would otherwise be interleaved.

To print CLI output inline instead (the original behavior), set in your DDEV shell:

```bash
export PLAYWRIGHT_DRUPAL_VERBOSE=1
```

This is useful when debugging a single test or running with `--workers=1`, where interleaved output is not a concern. The attached output files are available in the HTML test report regardless of this setting.

## Running Drush in Tests

There's many good reasons to want to run Drush in a test. The above example sets a known password for an account so the test can log in. Other good reasons are to scaffold out test data, or turn on testing-related modules.

To run Drush during a test, use `execDrushInTestSite` as shown in the example test. This ensures that Drush bootstraps against the test site, and not the default site.

There may be times you want to run Drush once, globally before all tests. In that case, add a `playwright:install:hook` task to your Taskfile, and from there you can call Drush or anything else you may need to do during setup.

## Logging In

The `login()` helper authenticates a Drupal user during a test. It uses `drush user:login` to generate a one-time login link, navigates to it, and asserts that login succeeded by checking for the admin toolbar.

```typescript
import { test, expect, login } from '@packages/playwright-drupal';

test('can access the admin dashboard', async ({ page }) => {
  await login(page);
  await page.goto('/admin');
  await expect(page).toHaveTitle(/Administration/);
});

test('can log in as a specific user', async ({ page }) => {
  await login(page, 'editor');
  // ...
});
```

**API:** `login(page: Page, user?: string): Promise<void>`

| Parameter | Default | Description |
|---|---|---|
| `page` | *(required)* | The Playwright page object |
| `user` | `'admin'` | The Drupal username to log in as |

The helper supports both the legacy Admin Toolbar (`#toolbar-administration`) and the Navigation module (`#admin-toolbar`, available since Drupal 10.3).
