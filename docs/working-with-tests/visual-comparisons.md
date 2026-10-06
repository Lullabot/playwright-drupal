# Visual Comparisons in Drupal

Stable capture and URL-driven visual comparison behavior is documented in the
generic package's canonical
[screenshots and visual comparisons guide](../generic-playwright-utilities/screenshots-and-visual-comparisons.md).

`@lullabot/playwright-drupal` re-exports those APIs for compatibility. Its
`takeAccessibleScreenshot()`, `defineVisualDiffConfig()`,
`defaultTestFunction()`, and `VisualDiffTestCases` entry points apply the
Drupal preset: toolbar settling, Stage File Proxy-friendly image recovery,
Drupal axe exclusions, and the legacy browser thresholds.

```typescript
import { defineVisualDiffConfig } from '@packages/playwright-drupal';

export const config = defineVisualDiffConfig({
  name: 'Drupal visual comparisons',
  groups: [
    {
      name: 'Landing pages',
      testCases: [
        { name: 'Home', path: '/' },
        { name: 'Articles', path: '/en/articles' },
      ],
    },
  ],
});
```

Register the generated tests as usual:

```typescript
import { config } from '~/visualdiff-urls';

config.describe();
```

Masks, accessibility baselines, mocks, real interaction states, Chromium
pseudo-states, and custom test functions work as described in the generic
guide. Existing Drupal imports do not need to change.

## Direct generic imports

Use the generic package directly when a Drupal project deliberately wants
framework-neutral defaults:

```typescript
import { defineVisualDiffConfig } from '@lullabot/playwright-testing';
```

This bypasses the Drupal preset. Database isolation, the Drupal test fixture,
Drush helpers, and DDEV commands remain available only from
`@lullabot/playwright-drupal`.

## Including a Drupal database fixture

Visual snapshots are only meaningful when the underlying content is stable.
Tie the database fixture to version control or an immutable artifact. Every
site has a different refresh process, so the package does not automate this.
For a project using `lullabot/drainpipe`, a `playwright:install:hook` could
finish with steps like these:

```yaml
# Switch from per-test setup to the visual-comparison fixture.
unset PLAYWRIGHT_SETUP

# Remove old fixtures, then place the committed fixture where refresh expects it.
rm -f .private/databases/MYSITE-live_*_database.sql.gz
mkdir -p ./private/databases
cp ./test/playwright/tests/visualdiff/fixtures/MYSITE-live_*_database.sql.gz ./private/databases/

# Import and update the fixture without fetching a newer database.
task refresh site=@mysite no_fetch=1 production_mode=1

# Fetch missing public files consistently during capture.
./vendor/bin/drush @mysite -y en stage_file_proxy
```

Adapt paths and the refresh command to your project. The important constraint
is that every local and CI run starts from the same content state.

## Running and regenerating snapshots

The Drupal task collection provides two commands. Both target tests that have a
`-snapshots` directory beside them:

```console
ddev task playwright:visualdiff
ddev task playwright:regenerate
```

`playwright:regenerate` deletes existing snapshots before running with
`--update-snapshots`. Pass `delete=0` to keep existing files. Arguments after
`--` are forwarded to Playwright:

```console
ddev task playwright:visualdiff -- --project chromium
ddev task playwright:regenerate delete=0 -- --grep 'Front.page'
```

When filtering regeneration, always set `delete` explicitly so unmatched
snapshots are not deleted. Commit snapshots, use Git LFS, or configure a
snapshot service according to the repository's storage needs.

## Locator-derived page clips

Use `clipLocator` to capture a page region derived from a locator's bounds.
The option is supported by `takeAccessibleScreenshot()` and the Drupal
`a11y.screenshot()` fixture. See the [locator-derived page clips guide](../generic-playwright-utilities/screenshots-and-visual-comparisons.md#locator-derived-page-clips)
for coordinates, readiness waits, and capture limitations.
