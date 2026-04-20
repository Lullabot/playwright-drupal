# Drupal Testing Utilities

<!-- Subsection order for Drupal Testing Utilities — insert new subsections in this order:
     1. Authentication
     2. Forms
     3. autosave_form workarounds
     4. Gin theme workarounds
     5. CKEditor 5
     6. Media Library
     7. Managed Files
     8. oEmbed
     9. Entities
     10. Page readiness
     11. Fallback selectors
     12. Modules
     13. Database log (dblog)
     14. Status report
     15. Docroot resolution -->

This package ships a set of Drupal-aware Playwright utilities. Each utility targets a specific piece of Drupal behaviour that would otherwise have to be reimplemented in every test suite. Import from the package root:

```typescript
import { login, waitForAllImages, getDocroot } from '@packages/playwright-drupal';
```

## Authentication

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

### login()

`login(page: Page, user?: string): Promise<void>`

| Parameter | Default | Description |
|---|---|---|
| `page` | *(required)* | The Playwright page object |
| `user` | `'admin'` | The Drupal username to log in as |

## Forms

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

### waitForAjax()

`waitForAjax(page: Page, opts?: { timeout?: number }): Promise<void>`

| Parameter | Default | Description |
|---|---|---|
| `page` | *(required)* | The Playwright page object. |
| `opts.timeout` | `5000` | Maximum time to wait, in milliseconds. |

Waits for `Drupal.ajax.instances[i].ajaxing`, `jQuery.active`, and `jQuery(':animated')` to all be clear. Mirrors the predicate used by Drupal core's `JSWebAssert::assertWaitOnAjaxRequest()`. Call *after* the action that triggers AJAX — the wait resolves immediately if nothing is in flight. The animation check catches post-AJAX transitions (throbbers, vertical tabs) that can otherwise race with assertions.

### openAllDetails()

`openAllDetails(page: Page): Promise<void>`

Expands every `<details>` element on the page (vertical tabs, field groups, collapsible regions) so nested fields become interactable.

### clickSaveButton()

`clickSaveButton(page: Page, fallback: string): Promise<void>`

| Parameter | Default | Description |
|---|---|---|
| `page` | *(required)* | The Playwright page object. |
| `fallback` | *(required)* | CSS selector to click when no `Save*` submit is found. |

Clicks the first submit button whose `value` starts with `Save` and which is not hijacked by `autosave_form`'s once-marker. Falls back to the supplied selector if no candidate matches. Handles Thunder's moderation "Save as" automatically. Uses `clickSubmit` from the [Gin theme workarounds](#gin-theme-workarounds) so the click survives a pinned admin header.

### waitForSaveOutcome()

`waitForSaveOutcome(page: Page, opts: { addFormPathPattern: RegExp; timeout?: number }): Promise<'ok' | 'error'>`

| Parameter | Default | Description |
|---|---|---|
| `page` | *(required)* | The Playwright page object. |
| `opts.addFormPathPattern` | *(required)* | Regex matching the add-form URL; success is detected by the URL moving away from it. |
| `opts.timeout` | `30000` | Maximum time to wait for either outcome, in milliseconds. |

Races two signals: URL change away from `addFormPathPattern` (returns `'ok'`), or a visible `.messages--error` (returns `'error'`). Throws a descriptive error when neither signal appears within the timeout.

!!! note
    `waitForSaveOutcome` throws on timeout. If your test needs a soft "neither happened" branch, wrap the call in `try/catch`.

## autosave_form workarounds

Workarounds for sites that install the [autosave_form](https://www.drupal.org/project/autosave_form) contrib module (Drupal CMS ships it). Without these, forms lock up behind the "Resume editing / Discard" modal and file uploads race the module's autosave AJAX. Each function is a no-op on sites that don't install the module.

```typescript
import { test, dismissAutosaveDraft, waitForAutosaveReady } from '@packages/playwright-drupal';

test('fills a Drupal CMS form', async ({ page }) => {
  await page.goto('/node/add/article');
  await dismissAutosaveDraft(page);
  await waitForAutosaveReady(page);
  await page.getByLabel('Title').fill('Hello');
});
```

### dismissAutosaveDraft()

`dismissAutosaveDraft(page: Page): Promise<void>`

Clicks `.autosave-form-reject-button` if the "Resume editing / Discard" dialog is open. No-op otherwise.

### waitForAutosaveReady()

`waitForAutosaveReady(page: Page): Promise<void>`

Waits for `input[name="autosave_form_last_autosave_timestamp"]` to have a non-empty value. Resolves immediately on forms without the module.

## Gin theme workarounds

Helpers scoped to quirks introduced by the [Gin](https://www.drupal.org/project/gin) admin theme. Today the only helper is a click wrapper that survives Gin's pinned page header, which routinely overlaps submit buttons near the bottom of a form.

```typescript
import { test, clickSubmit } from '@packages/playwright-drupal';

test('deletes a node', async ({ page }) => {
  await page.goto('/node/1/delete');
  await clickSubmit(page.locator('input[type=submit][value="Delete"]'));
});
```

### clickSubmit()

`clickSubmit(locator: Locator): Promise<void>`

Scrolls `locator` into view and clicks it with `force: true`. Two steps are needed because Playwright's default actionability check passes once the button is in the viewport, but Gin's sticky header can still cover it; `force: true` bypasses the overlap check, and the scroll ensures the button actually lands at a free position. Use for delete buttons, moderation actions, and any other submit-style click you don't want the pinned header to intercept. `clickSaveButton` already delegates here internally.

## CKEditor 5

The `Ckeditor5` class drives **CKEditor 5** fields — the editor Drupal core has shipped by default since Drupal 10. It clears any existing content, then types the new value through `page.keyboard` so CKEditor's event pipeline processes the edits correctly (Playwright's `locator.fill()` can be silently dropped because the editor re-renders from its internal model).

!!! warning
    This class is for CKEditor **5** only. It does not work with CKEditor 4, which Drupal 10 still ships via the `ckeditor` module for sites that opted in. For CKEditor 4 use a plain `page.frameLocator(...)` + `fill()`.

```typescript
import { test, Ckeditor5 } from '@packages/playwright-drupal';

test('edits the body copy', async ({ page }) => {
  await page.goto('/node/1/edit');
  const body = new Ckeditor5(page, '#edit-body-wrapper');
  await body.fill('New body text');
});
```

**Constructor:** `new Ckeditor5(page: Page, selector: string, root?: Page | FrameLocator)`

| Parameter | Default | Description |
|---|---|---|
| `page` | *(required)* | The owning `Page`. Keyboard events target this page. |
| `selector` | *(required)* | Selector for the widget **wrapper** containing the editor (e.g. `#edit-body-wrapper`, `[data-drupal-selector="edit-field-body-wrapper"]`). The class drills into `.ck-editor__editable` internally. |
| `root` | `page` | Optional `FrameLocator` if the editor renders inside an iframe. |

### fill()

`async fill(text: string): Promise<void>`

Waits for the editor to become visible, clicks to place the caret, clears existing content via select-all + Backspace (platform-aware), and types the new text. Final value is exactly `text`, regardless of whether the field was empty — matching Playwright's `fill()` semantics.

## Media Library

Drive Drupal's `media_library` widget end-to-end: open the modal, optionally upload a fixture when the library is empty, select the first available item, and click "Insert selected". `findMediaIdFromListing` covers the post-save fallback for distributions where the redirect doesn't land on `/media/N`.

```typescript
import path from 'node:path';
import { test, selectFirstMediaFromLibrary } from '@packages/playwright-drupal';

test('selects a media item for a required widget', async ({ page }) => {
  await page.goto('/node/add/article');
  await selectFirstMediaFromLibrary(
    page,
    '[data-drupal-selector="edit-field-media-image"]',
    { uploadFixturePath: path.join(__dirname, 'fixtures', 'test.png') },
  );
});
```

!!! warning
    Empty-library auto-upload **only runs when you supply `uploadFixturePath`**. When the library is empty and no fixture path is provided, the function throws.

### selectFirstMediaFromLibrary()

`selectFirstMediaFromLibrary(page: Page, wrapperSelector: string, opts?: { uploadFixturePath?: string }): Promise<void>`

| Parameter | Default | Description |
|---|---|---|
| `page` | *(required)* | The Playwright page object. |
| `wrapperSelector` | *(required)* | Selector for the fieldset wrapping the widget (e.g. `[data-drupal-selector="edit-field-media-image"]`). |
| `opts.uploadFixturePath` | `undefined` | Path to a file to upload when the media library is empty. |

### findMediaIdFromListing()

`findMediaIdFromListing(page: Page, baseUrl: string, name: string): Promise<string | undefined>`

Looks up a media entity by name on `/admin/content/media` and extracts the ID from the first matching link. Useful when a post-save redirect skipped `/media/N` (e.g. on distributions with path aliases).

## Managed Files

Reliable file upload into a Drupal `managed_file` element, resilient to the races that plague the default flow — `autosave_form` posting the partial form on change, widgets like `image_focal_point` overriding the automatic JS click on the upload button, and the rare case where the file-ID hidden input never lands server-side.

```typescript
import path from 'node:path';
import { test, uploadManagedFile } from '@packages/playwright-drupal';

test('uploads an image into a managed_file field', async ({ page }) => {
  await page.goto('/media/add/image');
  await uploadManagedFile(
    page,
    '[data-drupal-selector="edit-field-media-image-0"]',
    path.join(__dirname, 'fixtures', 'test.png'),
  );
});
```

### uploadManagedFile()

`uploadManagedFile(page: Page, fieldSelector: string, fixturePath: string, opts?: { retry?: boolean; maxPollMs?: number }): Promise<void>`

| Parameter | Default | Description |
|---|---|---|
| `page` | *(required)* | The Playwright page object. |
| `fieldSelector` | *(required)* | Selector for the field wrapper (not the `<input type=file>` itself). |
| `fixturePath` | *(required)* | Absolute path to the file to upload. |
| `opts.retry` | `true` | Retry the upload once if the file-ID hidden input never populates. |
| `opts.maxPollMs` | `15000` | Maximum time to wait for the file-ID hidden input, in milliseconds. |

Throws when the file ID still isn't present after the retry.

!!! note
    Works especially well with `autosave_form`-enabled distributions (e.g. Drupal CMS) because the internal `waitForAjax` covers both core AJAX and the autosave post.

## oEmbed

Fill a Drupal oEmbed URL field, blur to trigger validation, and warn (don't throw) if Drupal rejects the URL.

```typescript
import { test, fillOembedUrl } from '@packages/playwright-drupal';

test('embeds a YouTube video', async ({ page }) => {
  await page.goto('/media/add/video');
  await fillOembedUrl(page, '[name="field_media_oembed_video[0][value]"]', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
});
```

### fillOembedUrl()

`fillOembedUrl(page: Page, selector: string, url: string): Promise<void>`

| Parameter | Default | Description |
|---|---|---|
| `page` | *(required)* | The Playwright page object. |
| `selector` | *(required)* | Selector for the oEmbed input. |
| `url` | *(required)* | URL to fill. |

Fills, blurs (Tab), waits for AJAX, then warns via `console.warn` if a `.messages--error` is visible. Invalid URLs are common during fixture setup; callers who need hard-fail behaviour should inspect the error message themselves or use `waitForSaveOutcome`.

## Entities

Some Drupal distributions (notably Drupal CMS) add path aliases to freshly created entities, so the post-save redirect lands on `/my-article` rather than `/node/42`. `extractEntityIdFromPage` recovers the numeric ID by falling back to the first canonical edit link on the page.

```typescript
import { extractEntityIdFromPage } from '@packages/playwright-drupal';

// after saving a node form …
const nodeId = await extractEntityIdFromPage(page, 'node');
expect(nodeId).toBeDefined();
```

### extractEntityIdFromPage()

`extractEntityIdFromPage(page: Page, entityType: string): Promise<string | undefined>`

| Parameter | Default | Description |
|---|---|---|
| `page` | *(required)* | The Playwright page object. |
| `entityType` | *(required)* | The entity type's canonical-route path segment (typically the machine name) — e.g. `'node'`, `'media'`, `'user'`. |

Returns the numeric ID as a string, or `undefined` when neither the URL nor any rendered edit link matches `/\<entityType\>/(\\d+)`. Works for any entity whose edit route follows `/<entityType>/<id>/edit`. Entity types routed under `/admin/...` (some config entities) are not handled — that is a separate helper for another day.

## Page readiness

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

### waitForImages()

`waitForImages(page: Page, selector: string): Promise<void>`

| Parameter | Default | Description |
|---|---|---|
| `page` | *(required)* | The Playwright page object. |
| `selector` | *(required)* | CSS selector for the `<img>` elements to wait for. |

Scrolls each matching image into view (to trigger lazy loading) and waits for them to finish loading. After all images have loaded, the page is scrolled back to the top so screenshots are stable.

### waitForAllImages()

`waitForAllImages(page: Page): Promise<void>`

Shorthand for `waitForImages(page, 'img:visible')`.

### waitForFrames()

`waitForFrames(page: Page): Promise<void>`

| Parameter | Default | Description |
|---|---|---|
| `page` | *(required)* | The Playwright page object. |

Scrolls every `<iframe>` into view and waits for each one to have loaded a URL. Operates serially to avoid concurrency bugs; fast enough that parallelism is not worth the complexity.

## Fallback selectors

Use these only when Playwright's human-focused locators (`getByRole`, `getByLabel`, `getByText`, etc.) cannot target the element. CSS/ID selectors are brittle and harder to maintain; prefer semantic locators wherever possible.

```typescript
import { idPrefixSelector } from '@packages/playwright-drupal';

// Only when getByRole / getByLabel cannot reach the element.
const wrapper = page.locator(idPrefixSelector('#edit-body-wrapper'));
```

### idPrefixSelector()

`idPrefixSelector(selector: string): string`

Pure string transform that rewrites every `#id` chunk in `selector` to `[id="<id>"], [id^="<id>--"]`. Lets consumers target Drupal IDs even after form rebuilds add the `--HASHSUFFIX`. Safe on non-ID selectors (they pass through unchanged).

## Modules

Check whether a Drupal module is enabled, or assert that a list of modules is enabled before a test runs. Drush-first: tests running inside this package's lifecycle get a fast, reliable check via `drush pm:list`. A UI fallback is available for contexts without Drush.

!!! warning
    `isModuleEnabled` requires a bootstrapped test site because it uses `execDrushInTestSite`. For probes against a long-lived local site, use `isModuleEnabledByPath` directly.

```typescript
import { test, validateRequiredModules } from '@packages/playwright-drupal';

test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage();
  await validateRequiredModules(page, ['field_ui', 'dblog']);
});
```

### isModuleEnabled()

`isModuleEnabled(name: string): Promise<boolean>`

Queries `drush pm:list --status=enabled --field=name` and checks for the module's machine name on its own line.

### isModuleEnabledByPath()

`isModuleEnabledByPath(page: Page, moduleName: string, testPath: string): Promise<boolean>`

| Parameter | Default | Description |
|---|---|---|
| `page` | *(required)* | The Playwright page object. |
| `moduleName` | *(required)* | Informational — used in error messages. |
| `testPath` | *(required)* | An admin path that is accessible only when the module is enabled. |

UI-only fallback. Returns `true` when the path responds 200 and no access-denied text is visible; `false` on 403/404 or when access-denied markers are present.

### validateRequiredModules()

`validateRequiredModules(page: Page, names: string[]): Promise<void>`

Throws with a Drush remediation hint if any of the listed modules are not enabled.

## Database log (dblog)

Treat Drupal's watchdog log as an assertion target: truncate at the start of a test, drive the system under test, then fail if any `error` or `critical` entries accumulate. All functions go through `drush watchdog:*` via `execDrushInTestSite`, so they must run inside the bootstrapped test site this package manages.

```typescript
import { test, truncateDblog, checkDblogForErrors, formatLogErrors } from '@packages/playwright-drupal';

test('content creation logs no errors', async ({ page }) => {
  await truncateDblog();

  // … drive the flow under test …

  const errors = await checkDblogForErrors();
  expect(errors, formatLogErrors(errors)).toEqual([]);
});
```

**Types:** `DblogSeverity` (enum, lowercase values matching Drupal's RfcLogLevel names), `DblogEntry`, `DblogMonitorConfig`

### isDblogEnabled()

`isDblogEnabled(): Promise<boolean>`

Thin wrapper around `isModuleEnabled('dblog')`.

### truncateDblog()

`truncateDblog(): Promise<void>`

Runs `drush watchdog:delete all -y`.

### fetchDblogEntries()

`fetchDblogEntries(config?: DblogMonitorConfig): Promise<DblogEntry[]>`

Runs `drush watchdog:show --format=json --extended --count=…` and returns the entries with severities normalised to lowercase. `config.moduleFilter` maps to `--type=`. The count cap is deliberately high so tests don't silently drop entries.

### checkDblogForErrors()

`checkDblogForErrors(config?: DblogMonitorConfig): Promise<DblogEntry[]>`

Returns only entries whose severity is in `config.failOnSeverities` (default: `CRITICAL` + `ERROR`).

### formatLogErrors()

`formatLogErrors(entries: DblogEntry[]): string`

Human-readable formatter for use in assertion messages.

## Status report

Grab the contents of `/admin/reports/status` as typed arrays grouped by severity. Useful as a post-install smoke check. Runs `drush core:requirements --format=json` under the hood, so this shares the `execDrushInTestSite` lifecycle — must run inside the bootstrapped test site this package manages.

```typescript
import { test, getStatusReport, filterStatusItems, formatStatusItems } from '@packages/playwright-drupal';

test('site has no unexpected status-report errors', async () => {
  const report = await getStatusReport();
  const errors = filterStatusItems(report.errors, { ignoreItems: ['Trusted Host Settings'] });
  expect(errors, formatStatusItems(errors)).toEqual([]);
});
```

**Types:** `StatusReportItem` (with `id`, `title`, `severity`, `description`, `value`), `StatusReportResult`, `StatusReportConfig`

### getStatusReport()

`getStatusReport(): Promise<StatusReportResult>`

Returns `{ errors, warnings, info, ok }`, each a `StatusReportItem[]`. `severity` is lowercased to `'error' | 'warning' | 'info' | 'ok'`; entries without a title are skipped; unknown severity values fall into `ok`.

### filterStatusItems()

`filterStatusItems(items: StatusReportItem[], config?: StatusReportConfig): StatusReportItem[]`

Removes items whose title contains any of `config.ignoreItems` (case-insensitive substring match).

### formatStatusItems()

`formatStatusItems(items: StatusReportItem[]): string`

Formats items as a bulleted list with optional truncated-details lines, suitable for use in assertion messages.

## Docroot resolution

Tests sometimes need to resolve files relative to the Drupal docroot — for example when generating fixtures or computing paths inside the Drupal site. `getDocroot()` reads `composer.json#extra.drupal-scaffold.locations.web-root` so tests don't hard-code `'web'` (or `'docroot'`) and work across Drupal scaffold configurations.

```typescript
import { getDocroot } from '@packages/playwright-drupal';

const docroot = getDocroot(); // 'web' on drupal/recommended-project, 'docroot' on other setups
```

### getDocroot()

`getDocroot(composerJsonPath?: string): string`

| Parameter | Default | Description |
|---|---|---|
| `composerJsonPath` | `'../../composer.json'` | Path to the repo's `composer.json`, relative to the Playwright working directory. |

Returns the docroot directory name without a trailing slash. Falls back to `'web'` if the file is missing, the scaffold key is absent, or parsing fails.
