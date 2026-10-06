# Accessibility testing

`@lullabot/playwright-testing` combines axe-core scans with explicit baselines,
Playwright annotations, JSON attachments, and highlighted violation
screenshots. Its defaults are framework-neutral: no selectors are excluded
unless the caller supplies them.

## Run a scan

```typescript
import { test } from '@playwright/test';
import { checkAccessibility } from '@lullabot/playwright-testing';

test('about page is accessible', async ({ page }, testInfo) => {
  await page.goto('/about');
  await checkAccessibility(page, testInfo, {
    exclude: ['[data-third-party-widget]'],
    rules: {
      'color-contrast': { enabled: true },
    },
  });
});
```

`checkAccessibility()` runs a best-practice scan followed by a WCAG scan. It
adds an `@a11y` annotation, attaches the complete axe results, and attaches a
full-page screenshot with WCAG violations outlined in red. Set
`screenshotViolations: false` to omit that image.

The most useful `AccessibilityOptions` are:

| Field | Default | Purpose |
| --- | --- | --- |
| `wcagTags` | WCAG 2.0/2.1 A and AA | Select the tags used for the WCAG scan. |
| `exclude` | `[]` | Exclude selectors from both scans. |
| `bestPracticeExclude` | `[]` | Exclude selectors only from the best-practice scan. |
| `wcagExclude` | `[]` | Exclude selectors only from the WCAG scan. |
| `bestPracticeMode` | `soft` | Use `off` to skip the best-practice scan. |
| `rules` | none | Enable or disable individual axe rules. |
| `baseline` | none | Supply an in-code allowlist instead of an on-disk baseline. |
| `screenshotViolations` | `true` | Attach a highlighted screenshot when WCAG violations exist. |

## On-disk baselines

Without an in-code baseline, each scan uses a JSON baseline colocated with the
test's screenshots. On the first local run, the helper writes a file such as
`home-page-1.a11y-baseline.json` and allows the run to complete. Fill in the
reason and tracking link before committing it:

```json
{
  "note": "Known accessibility violations accepted by this test.",
  "violations": [
    {
      "rule": "color-contrast",
      "targets": ["#footer .legal"],
      "reason": "Waiting for the approved brand palette update.",
      "willBeFixedIn": "https://example.com/issues/123"
    }
  ]
}
```

When `CI` is set, a missing baseline is still written and attached to the
report, but the test fails. Download and commit the seed rather than silently
accepting new violations. A committed legacy `.txt` accessibility snapshot is
still honored, but new tests should use JSON baselines. Detection uses Playwright's
anonymous text snapshot naming, including counter-dependent truncation and
hashing, and resolves the exact path for the current project and snapshot
suffix with `testInfo.snapshotPath()`. PNG snapshots and files belonging to
other tests or projects do not select snapshot mode.

Detection supports templates that place `{arg}` in the filename, with a
stable parent directory (which may use `{testName}`, `{projectName}`, and
`{ext}`). Explicitly named snapshots and templates that put `{arg}` in a
directory are not discovered. Tests whose titles sanitize to the same filename
have Playwright's own collision limitations. Anonymous argument generation
mirrors Playwright's naming algorithm because no public API generates an
arbitrary counter; runner regression tests guard against upstream changes.

Entries that match current violations are reported as baselined annotations.
New violations fail the assertion with a copy-pasteable entry, while entries
that no longer match are reported as stale so they can be removed.

## Shared baselines

Use `defineAccessibilityBaseline()` for a baseline shared by multiple tests or
generated from test data. An explicit baseline takes precedence over a JSON
file.

For an in-code baseline, an entry is reported as stale once per check only
when none of the enabled scans matches it.

```typescript
import { test } from '@playwright/test';
import {
  checkAccessibility,
  defineAccessibilityBaseline,
} from '@lullabot/playwright-testing';

const baseline = defineAccessibilityBaseline([
  {
    rule: 'color-contrast',
    targets: ['#footer .legal'],
    reason: 'Waiting for the approved brand palette update.',
    willBeFixedIn: 'https://example.com/issues/123',
  },
]);

test('about page', async ({ page }, testInfo) => {
  await page.goto('/about');
  await checkAccessibility(page, testInfo, { baseline });
});
```

The same baseline can be assigned at the top-level, group, or case level of a
visual-diff configuration.

## Combine accessibility with a stable screenshot

`takeAccessibleScreenshot()` waits for page media and fonts, removes incidental
focus and hover state, performs Playwright's screenshot assertion, and then
runs the accessibility scans:

```typescript
import { test } from '@playwright/test';
import { takeAccessibleScreenshot } from '@lullabot/playwright-testing';

test('navigation', async ({ page }, testInfo) => {
  await page.goto('/');
  await takeAccessibleScreenshot(page, testInfo, {
    fullPage: true,
    interactionStates: [
      {
        locator: page.getByRole('button', { name: 'Menu' }),
        states: ['hover', 'focus'],
      },
    ],
    accessibility: { baseline: [] },
  });
});
```

See [Stable screenshots and visual comparisons](screenshots-and-visual-comparisons.md)
for capture options and URL-driven suites. See
[GitHub reporting](github-reporting.md) to render accessibility results in a
workflow summary and as annotations.
