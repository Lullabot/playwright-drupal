# `@lullabot/playwright-testing`

Framework-neutral utilities for stable Playwright screenshots, accessibility
baselines, URL-driven visual comparisons, CKEditor 5 editing, WebKit autofocus
stabilization, and GitHub reporting.

This package is developed in the
[`playwright-drupal` monorepo](https://github.com/Lullabot/playwright-drupal),
but it has no Drupal runtime assumptions. Drupal projects can instead install
[`@lullabot/playwright-drupal`](https://www.npmjs.com/package/@lullabot/playwright-drupal),
which applies Drupal-specific defaults and preserves the original API.

## Install

```console
npm install --save-dev @lullabot/playwright-testing @playwright/test
```

`@axe-core/playwright` is a runtime dependency. `@playwright/test` is a required
peer dependency: install Playwright 1.50.0 or newer within 1.x in your project.
Both Lullabot packages use that exact runner instance.

For an existing project that has not declared the runner directly, run
`npm install --save-dev '@playwright/test@^1.50.0'` or
`yarn add --dev '@playwright/test@^1.50.0'`, then commit the updated manifest and
lockfile. If you already declare a supported runner, keep its chosen version.
npm 7 and newer install required peers by default; Yarn expects your project to
provide them.

## Package entry points

- `@lullabot/playwright-testing` exports screenshot stabilization,
  accessibility checks and baselines, visual-diff definitions, interaction and
  pseudo-state helpers, `openAllDetails()`, CKEditor 5 editing, reusable mocks,
  and the `suppressWebKitAutofocus()` init script (installed explicitly in WebKit
  contexts).
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

- [Accessibility testing][testing-accessibility]
- [Stable screenshots and visual comparisons][testing-screenshots]
- [Page readiness and browser state][testing-page-readiness]
- [CKEditor 5 editing][testing-ckeditor5]
- [WebKit native autofocus workaround][testing-webkit-autofocus]
- [GitHub reporting][testing-github-reporting]

## Drupal compatibility

Existing `@lullabot/playwright-drupal` imports remain supported. That package
depends on this one, re-exports the generic APIs, and wraps screenshot and
visual-diff calls with its Drupal preset. New framework-neutral code can import
this package directly; Drupal tests that depend on database isolation, Drush,
login helpers, or the `a11y` fixture should continue importing the Drupal
package.

[testing-accessibility]: https://github.com/Lullabot/playwright-drupal/blob/main/packages/playwright-testing/docs/accessibility.md
[testing-screenshots]: https://github.com/Lullabot/playwright-drupal/blob/main/packages/playwright-testing/docs/screenshots-and-visual-comparisons.md
[testing-github-reporting]: https://github.com/Lullabot/playwright-drupal/blob/main/packages/playwright-testing/docs/github-reporting.md
[testing-webkit-autofocus]: https://github.com/Lullabot/playwright-drupal/blob/main/packages/playwright-testing/docs/webkit-autofocus.md

[testing-page-readiness]: https://github.com/Lullabot/playwright-drupal/blob/main/packages/playwright-testing/docs/page-readiness.md

[testing-ckeditor5]: https://github.com/Lullabot/playwright-drupal/blob/main/packages/playwright-testing/docs/ckeditor5.md
