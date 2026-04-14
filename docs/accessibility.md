# Accessibility Testing

This library integrates [axe-core](https://github.com/dequelabs/axe-core) for automated accessibility testing. Accessibility checks can be used standalone or combined with visual comparisons via `takeAccessibleScreenshot()`.

## Quick Start

The simplest way to add accessibility checks is through the `a11y` test fixture:

```typescript
import { test, expect } from '@packages/playwright-drupal';

test('home page is accessible', async ({ page, a11y }) => {
  await page.goto('/');
  await a11y.check();
});
```

The `a11y` fixture provides two methods:

| Method | Description |
|---|---|
| `a11y.check(options?)` | Run accessibility checks without taking a screenshot |
| `a11y.screenshot(options?, scrollLocator?, locator?)` | Take a screenshot snapshot and run accessibility checks — produces a snapshot file that must be committed to the repo |

## Standalone Accessibility Checks

For more control, import `checkAccessibility()` directly. Note the `testInfo` second argument to the test function — this is needed to attach scan results and annotations to the test report:

```typescript
import { test, expect, checkAccessibility } from '@packages/playwright-drupal';

test('article page is accessible', async ({ page }, testInfo) => {
  await page.goto('/en/articles');
  await checkAccessibility(page, testInfo);
});
```

`checkAccessibility()` runs two axe-core scan passes:

1. **Best-practice scan** — checks for common best-practice violations (soft failure by default).
2. **WCAG scan** — checks against WCAG 2.0 and 2.1 Level A and AA criteria.

Both scans attach their full JSON results to the test report.

## Configuring Scans

Pass an `AccessibilityOptions` object to customize the scan behavior:

```typescript
await a11y.check({
  wcagTags: ['wcag2a', 'wcag2aa'],
  exclude: ['.cookie-banner'],
  bestPracticeMode: 'off',
});
```

### WCAG Tags

By default, scans run against `['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']`. Override with the `wcagTags` option:

```typescript
await a11y.check({
  wcagTags: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'],
});
```

### Excluding Elements

Use `exclude` to skip specific elements from both scans:

```typescript
await a11y.check({
  exclude: ['.cookie-banner', '#third-party-widget'],
});
```

The library automatically excludes certain Drupal-specific elements that are known to produce false positives (e.g., `.focusable.skip-link`, `[role="article"]` in the best-practice scan, and `[data-drupal-media-preview="ready"]` in the WCAG scan). Set `disableDefaultExclusions: true` to remove these built-in exclusions:

```typescript
await a11y.check({
  disableDefaultExclusions: true,
});
```

### Best-Practice Mode

The `bestPracticeMode` option controls how best-practice violations are reported:

| Value | Behavior |
|---|---|
| `'soft'` | Best-practice violations are asserted via `expect.soft()` — the test is marked as failed but execution continues so the WCAG scan always runs (default) |
| `'off'` | Skips the best-practice scan entirely |

### Custom Rules

Enable or disable specific axe rules:

```typescript
await a11y.check({
  rules: {
    'color-contrast': { enabled: false },
    'landmark-one-main': { enabled: true },
  },
});
```

## Baseline Allowlist

When a project has known accessibility violations that cannot be fixed immediately, baselines provide an alternative to violation snapshots. Instead of committing snapshot files that mark violations as "expected", you define a typed allowlist with explicit reasons and tracking tickets.

### Defining a Baseline

Create a baseline file and pass it to your checks:

```typescript
// test/playwright/src/a11y-baseline.ts
import { defineAccessibilityBaseline } from '@packages/playwright-drupal';

export const baseline = defineAccessibilityBaseline([
  {
    rule: 'color-contrast',
    targets: ['.footer__inner-3 > .footer__section > p > a'],
    reason: 'Footer link contrast is 4.2:1, below the 4.5:1 threshold',
    willBeFixedIn: 'https://drupal.org/node/12345',
  },
]);
```

Then use it in your tests:

```typescript
import { test } from '@packages/playwright-drupal';
import { baseline } from '~/a11y-baseline';

test('home page is accessible', async ({ page, a11y }) => {
  await page.goto('/');
  await a11y.check({ baseline });
});
```

Each `AccessibilityBaselineEntry` has the following fields:

| Field | Description |
|---|---|
| `rule` | The axe rule ID (e.g., `'color-contrast'`) |
| `targets` | CSS selectors for the elements with this violation |
| `reason` | Why this violation is accepted |
| `willBeFixedIn` | Link to the tracking ticket for the fix |

### How Baselines Work

When a baseline is provided, the WCAG scan switches from snapshot-based assertions to baseline-driven assertions:

- **Matched violations** are suppressed and recorded as `Baselined a11y violation` annotations in the test report.
- **Unmatched violations** (new violations not in the baseline) cause the test to fail with detailed output including the rule, description, impact, help URL, and affected targets.
- **Stale baseline entries** (entries in the baseline that no longer match any detected violation) are flagged as `Stale a11y baseline entry` annotations so you can clean them up.

A violation matches a baseline entry when the rule ID matches and at least one CSS selector target overlaps. Targets are normalized to handle dynamic HTML IDs (e.g., `#edit-field--123` becomes `#edit-field--UNIQUE-ID`).

When using baselines, the report annotations show which violations were suppressed and which baseline entries are stale:

![Baseline annotations showing stale entries and scan summary](images/a11y-report-baseline-annotations.webp)

### Copy-Pasteable Entries

When violations are detected, the failure output includes ready-to-paste baseline entries. In snapshot mode, these are also attached to the test as an `a11y-baseline-suggestions` text file. Each suggestion includes placeholder `reason` and `willBeFixedIn` fields for you to fill in:

```typescript
{
  rule: 'color-contrast',
  targets: ['.footer__inner-3 > .footer__section > p > a'],
  reason: '',  // TODO: explain why this is accepted
  willBeFixedIn: '',  // TODO: link to tracking ticket
},
```

In the Playwright HTML report, unmatched violations show the full error details including the copy-pasteable baseline entry:

![Error output showing violation details, help URL, and copy-pasteable baseline entry](images/a11y-report-baseline-errors.webp)

## Test Report Integration

Accessibility results integrate into the Playwright HTML test report in several ways:

- **`@a11y` annotation** — Every test that runs an accessibility check receives an `@a11y` annotation, visible in the test detail view of the HTML report.
- **Summary annotations** — Each scan adds an `Accessibility` annotation summarizing pass/fail counts (e.g., "WCAG scan: 0 new violations (2 baselined)").
- **Baseline annotations** — When using baselines, matched violations appear as `Baselined a11y violation` annotations with the reason and ticket link. Stale entries appear as `Stale a11y baseline entry` annotations.
- **JSON attachments** — Full axe-core results are attached as `a11y-best-practice-scan-results` and `a11y-wcag-scan-results` JSON files for detailed inspection.
- **Violation screenshot** — When violations are detected, a full-page screenshot is attached with all violating elements highlighted in red. Enabled by default; disable with `screenshotViolations: false`.

![Full-page screenshot of a Drupal recipe site with accessibility violations highlighted by red outlines around links](images/a11y-violation-screenshot.webp)

A passing test shows the `@a11y` tag and scan summary:

![Annotations section showing @a11y tag and WCAG scan summary](images/a11y-report-annotations.webp)

## Combined with Visual Comparisons

The `takeAccessibleScreenshot()` method bundles visual comparison and accessibility checking into a single call. It is documented in detail in the [Visual Comparisons](visual-comparisons.md) section.

The `a11y.screenshot()` fixture method provides the same functionality:

```typescript
test('home page screenshot', async ({ page, a11y }) => {
  await page.goto('/');
  await a11y.screenshot();
});
```

When using the visual diff configuration system, you can pass a baseline via the `a11yBaseline` property on `VisualDiffUrlConfig`:

```typescript
import { defineVisualDiffConfig } from '@packages/playwright-drupal';
import { baseline } from '~/a11y-baseline';

export const config = defineVisualDiffConfig({
  name: "Umami Visual Diffs",
  a11yBaseline: baseline,
  groups: [
    {
      name: "Landing Pages",
      testCases: [
        { name: "Home Page", path: "/" },
      ],
    },
  ],
});
```
