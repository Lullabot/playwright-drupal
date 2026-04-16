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

## Drupal Testing Utilities

<!-- Subsection order for Drupal Testing Utilities — insert new subsections in this order:
     1. Authentication
     2. Forms
     3. Entities
     4. Media Library
     5. Managed Files
     6. oEmbed
     7. CKEditor 5
     8. autosave_form workarounds
     9. Modules
     10. Database log (dblog)
     11. Status report
     12. Page readiness
     13. Docroot resolution
     14. Gin theme workarounds -->

This package ships a set of Drupal-aware Playwright utilities. Each utility targets a specific piece of Drupal behaviour that would otherwise have to be reimplemented in every test suite. Import from the package root:

```typescript
import { login, waitForAllImages, getDocroot } from '@packages/playwright-drupal';
```

### Authentication

The `login()` helper authenticates a Drupal user during a test. It uses `drush user:login` to generate a one-time login link, navigates to it, and asserts that login succeeded by checking for a Drupal session cookie (`SESS*`/`SSESS*`), which works with any theme and any login redirect configuration.

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

### Forms

Utilities for driving Drupal's form system: waiting on AJAX, expanding collapsed `<details>`, clicking Save buttons on distributions with `autosave_form`, and waiting for a submit to resolve one way or another. For Gin-sticky-header-safe clicks, see [Gin theme workarounds](#gin-theme-workarounds).

```typescript
import { test, openAllDetails, waitForAjax, clickSaveButton, waitForSaveOutcome } from '@packages/playwright-drupal';

test('creates an article', async ({ page }) => {
  await page.goto('/node/add/article');
  await openAllDetails(page);
  await page.getByLabel('Title').fill('Hello');
  await clickSaveButton(page, 'input[type=submit][value^="Save"]');
  const outcome = await waitForSaveOutcome(page, { addFormPathPattern: /\/node\/add\// });
  expect(outcome).toBe('ok');
});
```

**API:** `waitForAjax(page: Page, opts?: { timeout?: number }): Promise<void>`

| Parameter | Default | Description |
|---|---|---|
| `page` | *(required)* | The Playwright page object. |
| `opts.timeout` | `5000` | Maximum time to wait, in milliseconds. |

Waits for `Drupal.ajax.instances[i].ajaxing`, `jQuery.active`, and `jQuery(':animated')` to all be clear. Mirrors the predicate used by Drupal core's `JSWebAssert::assertWaitOnAjaxRequest()`. Call *after* the action that triggers AJAX — the wait resolves immediately if nothing is in flight. The animation check catches post-AJAX transitions (throbbers, vertical tabs) that can otherwise race with assertions.

**API:** `openAllDetails(page: Page): Promise<void>`

Expands every `<details>` element on the page (vertical tabs, field groups, collapsible regions) so nested fields become interactable.

**API:** `clickSaveButton(page: Page, fallback: string): Promise<void>`

| Parameter | Default | Description |
|---|---|---|
| `page` | *(required)* | The Playwright page object. |
| `fallback` | *(required)* | CSS selector to click when no `Save*` submit is found. |

Clicks the first submit button whose `value` starts with `Save` and which is not hijacked by `autosave_form`'s once-marker. Falls back to the supplied selector if no candidate matches. Handles Thunder's moderation "Save as" automatically. Uses `clickSubmit` from the [Gin theme workarounds](#gin-theme-workarounds) so the click survives a pinned admin header.

**API:** `waitForSaveOutcome(page: Page, opts: { addFormPathPattern: RegExp; timeout?: number }): Promise<'ok' | 'error'>`

| Parameter | Default | Description |
|---|---|---|
| `page` | *(required)* | The Playwright page object. |
| `opts.addFormPathPattern` | *(required)* | Regex matching the add-form URL; success is detected by the URL moving away from it. |
| `opts.timeout` | `30000` | Maximum time to wait for either outcome, in milliseconds. |

Races two signals: URL change away from `addFormPathPattern` (returns `'ok'`), or a visible `.messages--error` (returns `'error'`). Throws a descriptive error when neither signal appears within the timeout.

!!! note
    `waitForSaveOutcome` throws on timeout. If your test needs a soft "neither happened" branch, wrap the call in `try/catch`.

### Entities

Some Drupal distributions (notably Drupal CMS) add path aliases to freshly created entities, so the post-save redirect lands on `/my-article` rather than `/node/42`. `extractEntityIdFromPage` recovers the numeric ID by falling back to the first canonical edit link on the page.

```typescript
import { extractEntityIdFromPage } from '@packages/playwright-drupal';

// after saving a node form …
const nodeId = await extractEntityIdFromPage(page, 'node');
expect(nodeId).toBeDefined();
```

**API:** `extractEntityIdFromPage(page: Page, entityType: 'node' | 'media'): Promise<string | undefined>`

| Parameter | Default | Description |
|---|---|---|
| `page` | *(required)* | The Playwright page object. |
| `entityType` | *(required)* | `'node'` or `'media'`. |

Returns the numeric ID as a string, or `undefined` when neither the URL nor any rendered edit link matches `/\<entityType\>/(\\d+)`.

### Gin theme workarounds

Helpers scoped to quirks introduced by the [Gin](https://www.drupal.org/project/gin) admin theme. Today the only helper is a click wrapper that survives Gin's pinned page header, which routinely overlaps submit buttons near the bottom of a form.

```typescript
import { test, clickSubmit } from '@packages/playwright-drupal';

test('deletes a node', async ({ page }) => {
  await page.goto('/node/1/delete');
  await clickSubmit(page.locator('input[type=submit][value="Delete"]'));
});
```

**API:** `clickSubmit(locator: Locator): Promise<void>`

Scrolls `locator` into view and clicks it with `force: true`. Two steps are needed because Playwright's default actionability check passes once the button is in the viewport, but Gin's sticky header can still cover it; `force: true` bypasses the overlap check, and the scroll ensures the button actually lands at a free position. Use for delete buttons, moderation actions, and any other submit-style click you don't want the pinned header to intercept. `clickSaveButton` already delegates here internally.

### Page readiness

Lazy-loaded images and iframes are often not present when Playwright first queries the DOM. These utilities scroll hidden regions into view and wait for network-backed resources to settle, so assertions run against a stable page. They are especially important before visual comparisons.

```typescript
import { test, waitForAllImages, waitForFrames } from '@packages/playwright-drupal';

test('hero renders with images and embedded video', async ({ page }) => {
  await page.goto('/');
  await waitForAllImages(page);
  await waitForFrames(page);
  await expect(page).toHaveScreenshot();
});
```

**API:** `waitForImages(page: Page, selector: string): Promise<void>`

| Parameter | Default | Description |
|---|---|---|
| `page` | *(required)* | The Playwright page object. |
| `selector` | *(required)* | CSS selector for the `<img>` elements to wait for. |

Scrolls each matching image into view (to trigger lazy loading) and waits for them to finish loading. After all images have loaded, the page is scrolled back to the top so screenshots are stable.

**API:** `waitForAllImages(page: Page): Promise<void>`

Shorthand for `waitForImages(page, 'img:visible')`.

**API:** `waitForFrames(page: Page): Promise<void>`

| Parameter | Default | Description |
|---|---|---|
| `page` | *(required)* | The Playwright page object. |

Scrolls every `<iframe>` into view and waits for each one to have loaded a URL. Operates serially to avoid concurrency bugs; fast enough that parallelism is not worth the complexity.

### Docroot resolution

Tests sometimes need to resolve files relative to the Drupal docroot — for example when generating fixtures or computing paths inside the Drupal site. `getDocroot()` reads `composer.json#extra.drupal-scaffold.locations.web-root` so tests don't hard-code `'web'` (or `'docroot'`) and work across Drupal scaffold configurations.

```typescript
import { getDocroot } from '@packages/playwright-drupal';

const docroot = getDocroot(); // 'web' on drupal/recommended-project, 'docroot' on other setups
```

**API:** `getDocroot(composerJsonPath?: string): string`

| Parameter | Default | Description |
|---|---|---|
| `composerJsonPath` | `'../../composer.json'` | Path to the repo's `composer.json`, relative to the Playwright working directory. |

Returns the docroot directory name without a trailing slash. Falls back to `'web'` if the file is missing, the scaffold key is absent, or parsing fails.
