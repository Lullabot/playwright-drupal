# Stable screenshots and visual comparisons

`takeAccessibleScreenshot()` stabilizes a page before calling Playwright's
`toHaveScreenshot()` matcher, then runs the same accessibility checks described
in [Accessibility testing](accessibility.md).

The helper:

1. blurs incidental focus and clears incidental hover state;
2. loads lazy frames and images, waits for visible images to decode, and waits
   for fonts;
3. settles video frames for capture and restores playback afterward;
4. applies requested real interaction states;
5. performs a soft screenshot assertion with a minimum 10-second timeout; and
6. runs accessibility scans before cleaning up temporary browser state.

## Capture one page or element

```typescript
import { test } from '@playwright/test';
import { takeAccessibleScreenshot } from '@lullabot/playwright-testing';

test('product details', async ({ page }, testInfo) => {
  await page.goto('/products/green-chair');

  await takeAccessibleScreenshot(
    page,
    testInfo,
    {
      mask: [page.getByTestId('live-inventory')],
      accessibility: {
        exclude: ['[data-third-party-reviews]'],
      },
    },
    page.getByRole('heading', { name: 'Green chair' }),
    page.getByRole('main'),
  );
});
```

The fourth argument is an optional locator to scroll into view. The fifth is
the page or locator to capture; accessibility scans still cover the page.
Standard `toHaveScreenshot()` options are supported, plus:

| Field | Default | Purpose |
| --- | --- | --- |
| `clipLocator` | `undefined` | Derive an integer CSS-pixel page clip from a locator after readiness and scrolling. |
| `blur` | `true` | Blur the current active element before settling. |
| `clearHover` | `true` | Clear stray pointer state before settling. |
| `interactionStates` | `[]` | Apply real `hover` or `focus` to Playwright locators. |
| `stabilization.images` | defaults | Configure image loading, retries, and scroll hooks. |
| `stabilization.videos` | defaults | Configure video waits and scroll hooks. |
| `accessibility` | defaults | Options passed to `checkAccessibility()`. |

At most one locator may receive hover and one may receive focus. A single
locator can receive both. The states remain active for the screenshot and axe
scan, then are cleaned up even if capture fails.

Lower-level helpers such as `waitForAllImages()`, `waitForFrames()`,
`waitForFonts()`, `waitForVideos()`, `blurActiveElement()`, and `clearHover()`
are also exported when a custom capture flow needs individual stages. See
[Page readiness and browser state](page-readiness.md) for their API reference.

## Locator-derived page clips

Use `clipLocator` when you want a locator's bounds to select the region of a
**page** screenshot, with coordinates and dimensions rounded to integer CSS
pixels:

```typescript
await takeAccessibleScreenshot(page, testInfo, {
  clipLocator: page.locator('main'),
  fullPage: true,
});
```

This extends the existing helper. Raw `clip` and the fifth-argument locator
screenshot remain available. `clipLocator` cannot be combined with either raw
`clip` or a locator screenshot target, and must belong to the supplied page.
The Drupal adapter's `a11y.screenshot()` fixture accepts the same option.

The helper runs its existing frame, image, font, and video readiness waits,
performs any requested `scrollLocator` scrolling and interaction states, then
scrolls the clip locator into view. It waits for fonts and two animation frames
before reading its bounding box. Each of x, y, width, and height uses
`Math.round()` in CSS pixels. The crop is measured once before Playwright's
screenshot assertion retries; retries do not remeasure it.

For an ordinary capture, coordinates are relative to the main page viewport.
The rounded region must fit within that viewport. Use `fullPage: true` for a
target larger than the viewport: the helper adds the main page scroll offsets
to obtain document coordinates, and Playwright crops its full-page capture to
that region. `fullPage` does not ignore the clip. Bounding boxes for frame
locators are already relative to the main viewport. Missing bounds, dimensions
that round to zero, and negative rounded origins produce an error. The helper
leaves the page at the resulting scroll position, as with the existing scroll
locator behavior.

Accessibility checks still scan the whole page, with the existing accessibility
options and exclusions. The screenshot crop introduces no axe include or
exclude selectors. Fixed capture heights, toolbar styles, and project-specific
exclusions belong in project configuration.

Rounding reduces crop-size differences caused by fractional bounds and pixel
enclosure. It is not a guarantee of stable rendering: text, borders, transforms,
scroll handlers, sticky elements, and responsive layout can still render
differently. Rounding can omit part of an edge pixel or include surrounding
pixels; changes smaller than half a CSS pixel can be lost in the crop geometry.
`scale: 'device'` still rounds geometry in CSS pixels. Clip-only comparisons
also cannot reliably detect a translation of the entire target when the crop
moves with it; retain a page screenshot when placement relative to surrounding
content matters. Content changes and layout changes *inside* the crop remain
subject to the normal visual assertion thresholds.

Screenshot-only `stylePath` rules and Playwright's animation disabling run after
measurement. Avoid rules or animations that change target geometry during
capture; explicitly settle those in the test before calling the helper. Two
paint frames cannot guarantee an application has finished asynchronous layout
work, so retain application-specific readiness checks where needed.

## Define a URL-driven suite

`defineVisualDiffConfig()` creates grouped Playwright tests from a declarative
list of paths:

```typescript
// visual-pages.ts
import { defineVisualDiffConfig } from '@lullabot/playwright-testing';

export const visualPages = defineVisualDiffConfig({
  name: 'Example site visual comparisons',
  pathPrefix: '/en',
  mask: ['[data-current-time]'],
  groups: [
    {
      name: 'Landing pages',
      testCases: [
        { name: 'Home', path: '/' },
        {
          name: 'Events',
          path: '/events',
          interactionStates: [
            { selector: '.event-card:first-child a', states: ['hover'] },
          ],
        },
        {
          name: 'Draft campaign',
          path: '/campaign',
          skip: {
            reason: 'Content is not stable yet.',
            willBeFixedIn: 'https://example.com/issues/456',
          },
        },
      ],
    },
  ],
});
```

Register the generated tests from a Playwright spec:

```typescript
import { visualPages } from '../visual-pages';

visualPages.describe();
```

The default test function navigates to each configured path, captures a
full-page screenshot, and runs accessibility checks. `pathPrefix`,
`representativeUrl`, `mockClass`, `mask`, `maskColor`, `a11yBaseline`,
`interactionStates`, and `pseudoStates` can be assigned at appropriate config,
group, or case levels. Arrays such as masks and states merge from broad to
specific scopes; the most specific mask color wins.

## Mock changing embeds

Use `YoutubeMock` or implement `Mockable` to replace third-party frames before
navigation:

```typescript
import {
  defineVisualDiffConfig,
  YoutubeMock,
} from '@lullabot/playwright-testing';

export const visualPages = defineVisualDiffConfig({
  name: 'Marketing pages',
  mockClass: YoutubeMock,
  groups: [
    {
      name: 'Campaigns',
      testCases: [{ name: 'Launch', path: '/launch' }],
    },
  ],
});
```

A custom mock is any constructible class with
`mock(page: Page): Promise<void>`.

## Force CSS pseudo-states

Real `interactionStates` are portable across Chromium, Firefox, and WebKit and
update the accessibility tree. For Chromium-only CSS state, declare
`pseudoStates`:

```typescript
{
  name: 'Expanded navigation',
  path: '/',
  pseudoStates: [
    {
      selector: '.main-menu__trigger',
      pseudoClasses: ['hover', 'focus-visible'],
    },
  ],
}
```

Supported pseudo-classes are `active`, `focus`, `focus-visible`,
`focus-within`, `hover`, and `target`. These states are CSS-only; they do not
update DOM focus or accessibility state.

## Customize generated tests

Pass a factory to `describe()` when a case needs extra setup. Calling
`defaultTestFunction()` preserves the standard capture behavior:

```typescript
import { defaultTestFunction } from '@lullabot/playwright-testing';
import { test } from '@playwright/test';
import { visualPages } from '../visual-pages';

visualPages.describe((testCase, group) => {
  const runDefault = defaultTestFunction(testCase, group);

  return async ({ page, context, browserName }, testInfo) => {
    test.skip(browserName === 'firefox' && testCase.path === '/events');
    await page.addInitScript(() => localStorage.setItem('banner', 'dismissed'));
    await runDefault({ page, context }, testInfo);
  };
});
```

A fully custom function bypasses automatic masks and interaction/pseudo-state
handling unless it delegates to the default function.

Commit generated snapshots or store them using a snapshot service. Regenerate
with Playwright's `--update-snapshots` flag; framework adapters may provide
additional project-specific commands around that operation.
