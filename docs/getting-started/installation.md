# Installation

Integrating this library into a site takes several steps. For the sake of completeness, these steps start as if you are starting a brand-new Drupal site.

## Create the Drupal Site and Initialize DDEV

```console
mkdir pwtest && cd pwtest
ddev config --project-type=drupal11 --docroot=web
ddev composer create-project drupal/recommended-project
ddev composer require drush/drush
ddev add-on get Lullabot/ddev-playwright
ddev start
```

## Initialize Playwright Tests

```console
mkdir -p test/playwright
ddev exec -- npx create-playwright@latest --lang=TypeScript --quiet test/playwright --no-browsers
```

## Install Playwright Dependencies

This command will build a web image that contains the browsers we omitted above. Building this way allows for much faster startup times for environments that don't need Playwright, and also allows for caching of large downloads.

```console
ddev install-playwright
```

## Check Playwright Works

Before going further, make sure Playwright can run a sample test against https://playwright.dev.

```console
ddev exec -d /var/www/html/test/playwright npx playwright test
```

## Add the playwright-drupal Integration

```console
ddev exec -d /var/www/html/test/playwright npm i lullabot/playwright-drupal
```

```console
# Or, to pull from GitHub's main branch:
ddev exec -d /var/www/html/test/playwright npm i lullabot/playwright-drupal@github:Lullabot/playwright-drupal
```

## Configure Playwright

Set the following in `test/playwright/tsconfig.json`, merging with any existing configuration:

```json
{
  "compilerOptions": {
    "noEmit": true,
    "baseUrl": ".",
    "paths": {
      "~": ["./src"],
      "~*": ["./src/*"],
      "@packages/playwright-drupal": ["./packages/playwright-drupal"]
    }
  },
  "include": [
    "tests/**/*.ts"
  ]
}
```

Replace the contents of `test/playwright/playwright.config.ts` with:
```typescript
import { definePlaywrightDrupalConfig } from '@lullabot/playwright-drupal/config';
import { devices } from '@playwright/test';

export default definePlaywrightDrupalConfig({
  testDir: './tests',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  use: {
    ignoreHTTPSErrors: true,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    }
  ],
});
```

`definePlaywrightDrupalConfig()` automatically provides sensible defaults (see [Configuration Helper](../getting-started/configuration.md)), so you only need to specify project-specific settings. Import from `@lullabot/playwright-drupal/config` (the subpath export) to avoid loading the test fixture module, which would conflict with the source copy used by test files.

## Ignore playwright-drupal from Git

We have to copy the library outside the `node_modules` directory for Playwright to work correctly. Ignore this directory from git, since it's effectively a npm package:

```console
echo '/packages/playwright-drupal' >> test/playwright/.gitignore
```

## Create Taskfile.yml

In the root of your project, create `Taskfile.yml`:

```yaml
version: '3'
silent: true
includes:
  playwright:
    taskfile: test/playwright/node_modules/@lullabot/playwright-drupal/tasks/playwright.yml
    optional: true
```

## Add Playwright to Drupal's Settings

Add the following to your Drupal `sites/default/settings.php` (e.g. `web/sites/default/settings.php` or `docroot/sites/default/settings.php`, depending on your project). A `file_exists()` guard is used so that Drupal can still boot normally when the package is not installed:

```php
if (file_exists('../test/playwright/node_modules/@lullabot/playwright-drupal/settings/settings.playwright.php')) {
  include '../test/playwright/node_modules/@lullabot/playwright-drupal/settings/settings.playwright.php';
}
```

The relative path `../test/playwright/...` resolves from Drupal's docroot directory (where `index.php` lives), since PHP's working directory is set to that location during request handling — not from the directory where `settings.php` itself resides.

This addon assumes that DDEV's built in settings.php management is used. If you have set `disable_settings_management` in your `.ddev/config.yml` file, or are testing with a multisite where bootstrapping is not in `sites/default`, edit your custom files manually to make sure tests can bootstrap properly.

## Create and Run an Example Drupal Test

Copy the following to `test/playwright/tests/example.drupal.spec.ts`.

```typescript
import { test, expect, execDrushInTestSite } from '@packages/playwright-drupal';

test('has title', async ({ page }) => {
  await page.goto('/');

  // Expect a title "to contain" a substring.
  await expect(page).toHaveTitle(/Playwright/);
});

// This tests proves parallel databases work by setting a random title for the
// first node created in the site.
test('proves parallel tests work', async ({ page }) => {
  await execDrushInTestSite('user:password admin "correct horse battery staple"');
  await page.goto('/user/login');
  const username = page.getByLabel('Username');
  const password = page.getByLabel('Password');
  const loginButton = page.getByRole('button', { name: 'Log in' });
  await username.fill('admin');
  await password.fill('correct horse battery staple');
  await loginButton.click();
  // A waitForURL or page assertion is needed here; otherwise Playwright's
  // next goto() call won't wait for the form submission to finish before
  // navigating, which can cause the login to be skipped.
  await page.waitForURL(/\/user\//);

  await page.goto('/node/add/article');

  let randomTitle = (Math.random() + 1).toString(36).substring(2);
  await page.getByLabel('Title', { exact: true }).fill(randomTitle);
  await page.getByRole('button', { name: 'Save' }).click();

  // Since we're testing with Umami, upstream changes may change the node ID.
  // If you are creating a test like this on your own site, and the node ID is
  // deterministic, consider hard-coding that node ID instead.
  await expect(page).toHaveURL(/\/node\/\d+(?:\?.*)?$/);

  await expect(page).toHaveTitle(`${randomTitle} | Playwright`);
  await expect(page.locator('h1')).toHaveText(randomTitle);
});
```

Run the test with:

```console
ddev playwright test
```

```console
# Or you can run inside the container with:
ddev ssh
cd test/playwright
npx playwright test
```

You should see output similar to this. If you see JavaScript browser console errors, those are likely Drupal core bugs to investigate and report.

```console
$ ddev playwright test
Task playwright:install:hook does not exist. Running drush site:install --yes...
 You are about to:
 * CREATE the '/tmp/sqlite/.ht.sqlite' database.

 // Do you want to continue?: yes.

 [notice] Starting Drupal installation. This takes a while.
 [notice] Performed install task: install_select_language
 [notice] Performed install task: install_select_profile
 [notice] Performed install task: install_load_profile
 [notice] Performed install task: install_verify_requirements
 [notice] Performed install task: install_verify_database_ready
 [notice] Performed install task: install_base_system
 [notice] Performed install task: install_bootstrap_full
 [notice] Performed install task: install_profile_modules
 [notice] Performed install task: install_profile_themes
 [notice] Performed install task: install_install_profile
 [notice] Performed install task: install_configure_form
 [notice] Performed install task: install_finished
 [success] Installation complete.  User name: admin  User password: ifVQZgGpRK

Running 6 tests using 4 workers

  ✓  1 [chromium] › example.spec.ts:3:5 › has title (1.9s)
     2 [firefox] › example.spec.ts:3:5 › has title
  ✓  2 [firefox] › example.spec.ts:3:5 › has title (2.4s)
  ✓  3 [chromium] › example.spec.ts:12:5 › proves parallel tests work (4.2s)
  ✓  4 [firefox] › example.spec.ts:12:5 › proves parallel tests work (4.5s)
  ✓  5 [webkit] › example.spec.ts:3:5 › has title (1.6s)

 [success] Changed password for admin.


 [success] Changed password for admin.

  ✓  6 [webkit] › example.spec.ts:12:5 › proves parallel tests work (2.8s)

 [success] Changed password for admin.


  6 passed (9.9s)

To open last HTML report run:

  npx playwright show-report
```

You're now ready for the hard part - writing tests for your own application!

## Replacing the Standard Profile With Your Own

Out of the box, we can't know what setup steps your site needs to work correctly. To use your own steps, add a `playwright:install:hook` task to your Taskfile. This will be called with the right environment set so that the site is installed into sqlite (and not your normal ddev database). From here, run Drush commands or call other tasks as needed to install your site. To test this when developing, feel free to call `task playwright:install` without actually running tests.

If your site is too complex for a fresh install, consider using `playwright:mysql-to-sqlite` to convert an existing database instead. See [Testing With an Existing Database](#testing-with-an-existing-database) for details.

## Testing With an Existing Database

Instead of installing a fresh site, you can convert your existing MySQL/MariaDB database to SQLite. This is useful when your site has complex configuration, content, or setup that is difficult to reproduce with `drush site:install`.

The `playwright:mysql-to-sqlite` task converts the active DDEV database to SQLite:

```console
ddev exec task playwright:mysql-to-sqlite
```

This creates the base SQLite database at `/tmp/sqlite/.ht.sqlite`, which is the same location used by `playwright:install`. From there, tests run identically — each test gets its own copy of the database.

To integrate this into your workflow, create a `playwright:install:hook` task in your `Taskfile.yml` that calls `mysql-to-sqlite` instead of (or after) a site install:

```yaml
version: '3'
silent: true
includes:
  playwright:
    taskfile: test/playwright/node_modules/@lullabot/playwright-drupal/tasks/playwright.yml
    optional: true

tasks:
  playwright:install:hook:
    cmds:
      # Import your database first (e.g. from a dump file).
      # - drush sql:cli < path/to/dump.sql

      # Then convert it to SQLite for parallel test isolation.
      - task playwright:mysql-to-sqlite
```

The conversion uses [mysql-to-sqlite3](https://github.com/techouse/mysql-to-sqlite3) and requires `uv` (which is pre-installed in DDEV). No additional dependencies need to be installed.
