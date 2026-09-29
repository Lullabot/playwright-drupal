# `@lullabot/playwright-testing`

Framework-neutral utilities for stable Playwright screenshots, accessibility
baselines, URL-driven visual comparisons, and GitHub reporting.

This package is developed in the
[`playwright-drupal` monorepo](https://github.com/Lullabot/playwright-drupal),
but it has no Drupal runtime assumptions. Drupal projects can instead install
[`@lullabot/playwright-drupal`](https://www.npmjs.com/package/@lullabot/playwright-drupal),
which applies Drupal-specific defaults and preserves the original API.

## Install

```console
npm install --save-dev @lullabot/playwright-testing @playwright/test
```

`@axe-core/playwright` and `@playwright/test` are runtime dependencies of this
package. Your project should still declare its own compatible
`@playwright/test` dependency so the test runner and imported types use the same
version.

## Package entry points

- `@lullabot/playwright-testing` exports screenshot stabilization,
  accessibility checks and baselines, visual-diff definitions, interaction and
  pseudo-state helpers, and reusable mocks.
- `@lullabot/playwright-testing/github` exports the optional GitHub report,
  attachment-upload, and path-remapping APIs.
- `playwright-testing-a11y-summary` and
  `playwright-testing-failure-summary` expose the reporting commands.

The package does not replace Playwright's `test` fixture. Import `test`,
`expect`, and `testInfo` from `@playwright/test`, then pass the page and test
metadata to the helpers:

```typescript
import { expect, test } from '@playwright/test';
import { takeAccessibleScreenshot } from '@lullabot/playwright-testing';

test('home page', async ({ page }, testInfo) => {
  await page.goto('/');
  await takeAccessibleScreenshot(page, testInfo, { fullPage: true });
  await expect(page).toHaveTitle(/Example/);
});
```

## Guides

- [Accessibility testing](https://github.com/Lullabot/playwright-drupal/blob/main/packages/playwright-testing/docs/accessibility.md)
- [Stable screenshots and visual comparisons](https://github.com/Lullabot/playwright-drupal/blob/main/packages/playwright-testing/docs/screenshots-and-visual-comparisons.md)
- [GitHub reporting](https://github.com/Lullabot/playwright-drupal/blob/main/packages/playwright-testing/docs/github-reporting.md)

## Drupal compatibility

Existing `@lullabot/playwright-drupal` imports remain supported. That package
depends on this one, re-exports the generic APIs, and wraps screenshot and
visual-diff calls with its Drupal preset. New framework-neutral code can import
this package directly; Drupal tests that depend on database isolation, Drush,
login helpers, or the `a11y` fixture should continue importing the Drupal
package.
