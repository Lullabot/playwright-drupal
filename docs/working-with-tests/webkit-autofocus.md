# WebKit native autofocus workaround

`@lullabot/playwright-drupal` enables `webkitAutofocusWorkaround: true` by default
when you use its shared `test` fixture:

```typescript
import { test, expect } from '@lullabot/playwright-drupal';
```

It installs `suppressWebKitAutofocus()` from `@lullabot/playwright-testing` for
every project whose `browserName` is `webkit`, including desktop Safari and mobile
device profiles. Project names do not affect selection. Chromium and Firefox retain
their normal autofocus behavior. Installation also runs with
`PLAYWRIGHT_NO_TEST_ISOLATION=1`.

The workaround suppresses native document autofocus to prevent queued WebKit
focus from redirecting `locator.fill()` into the wrong field. It briefly hides
autofocus candidates and restores their authored styles afterward. Tests that
exercise native autofocus or focus/layout during loading should opt out.

The canonical [generic workaround guide](../generic-playwright-utilities/webkit-autofocus.md)
describes installation in custom contexts, the mechanism, coverage, limitations,
validation, upstream issues, and removal criteria. The Drupal package also
re-exports the helper for contexts you create separately; those contexts do not
inherit the shared fixture's workaround.

## Opt out for selected tests

```typescript
import { test, expect } from '@lullabot/playwright-drupal';

test.describe('native autofocus behavior', () => {
  test.use({ webkitAutofocusWorkaround: false });

  test('login field receives native focus', async ({ page }) => {
    await page.goto('/user/login');
    await expect(page.getByLabel('Username')).toBeFocused();
  });
});
```

## Configure an entire suite or project

```typescript
import { definePlaywrightDrupalConfig } from '@lullabot/playwright-drupal/config';

export default definePlaywrightDrupalConfig({
  use: { webkitAutofocusWorkaround: false },
});
```

You can also set the option in a project's `use` options. If you use Playwright's
own configuration helper, use `defineConfig<DrupalTestOptions>` with a type-only
import of `DrupalTestOptions` from `@lullabot/playwright-drupal`.

Set the option before the browser context is created; changing it afterward
cannot remove the installed workaround.
