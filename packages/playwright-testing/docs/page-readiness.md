# Page readiness and browser state

These helpers are exported by `@lullabot/playwright-testing` and work without Drupal. [`takeAccessibleScreenshot()`](screenshots-and-visual-comparisons.md#capture-one-page-or-element) runs the readiness and incidental browser-state cleanup stages automatically; use the individual helpers for custom capture flows.

Lazy-loaded images and iframes may not have loaded when Playwright first queries the DOM. These utilities scroll resources into view and wait for them to settle before assertions. They are especially important before visual comparisons.

```typescript
import { expect, test } from '@playwright/test';
import { waitForAllImages, waitForFrames } from '@lullabot/playwright-testing';

test('hero renders with images and embedded video', async ({ page }) => {
  await page.goto('/');
  await waitForAllImages(page);
  await waitForFrames(page);
  await expect(page).toHaveScreenshot();
});
```

### waitForImages()

`waitForImages(page: Page, selector: string, options?: WaitForImagesOptions): Promise<void>`

| Parameter | Default | Description |
|---|---|---|
| `page` | *(required)* | The Playwright page object. |
| `selector` | *(required)* | CSS selector for the `<img>` elements to wait for. |

Scrolls each matching image into view to trigger lazy loading, waits for requests to settle and visible images to decode, then returns the page to the top. Requests that fail also settle, so broken images do not hang the initial load wait.

`WaitForImagesOptions` accepts:

| Option | Default | Description |
|---|---|---|
| `decodeTimeoutMs` | `15000` | Maximum time to wait for visible images to decode. |
| `recoverErroredImages` | `false` | Re-request broken images with a cache-busting URL. This rewrites `src`, removes `srcset`, and removes enclosing `<picture>` sources. |
| `afterScroll` | `undefined` | Optional async callback receiving the page after it returns to the top. |

### waitForAllImages()

`waitForAllImages(page: Page, options?: WaitForImagesOptions): Promise<void>`

Shorthand for [`waitForImages(page, 'img:visible', options)`](#waitforimages).

### waitForImagesToDecode()

`waitForImagesToDecode(page: Page, timeoutMs?: number, recoverErroredImages?: boolean): Promise<string[]>`

| Parameter | Default | Description |
|---|---|---|
| `page` | *(required)* | The Playwright page object. |
| `timeoutMs` | `15000` | How long to wait for images to decode before giving up. |
| `recoverErroredImages` | `false` | Allow broken image sources to be rewritten and re-requested. |

Called by [`waitForImages()`](#waitforimages); call it directly only to use a different timeout or to assert on the result. Waits for every visible image to decode. When `recoverErroredImages` is enabled, it re-requests failed images with a cache-busting query parameter. Images that never decode are not an error. Instead, they are warned about on the console and returned, so a broken image in a screenshot has an explanation instead of just a pixel diff.

### waitForFonts()

`waitForFonts(page: Page): Promise<void>`

| Parameter | Default | Description |
|---|---|---|
| `page` | *(required)* | The Playwright page object. |

Awaits `document.fonts.ready` so text is not captured with fallback-font metrics. Fallback glyphs have different widths, so text can wrap onto a different number of lines and render the page at a slightly different height until the real web fonts apply — a flake that typically only shows up on the first attempt.

### waitForFrames()

`waitForFrames(page: Page): Promise<void>`

| Parameter | Default | Description |
|---|---|---|
| `page` | *(required)* | The Playwright page object. |

Scrolls each visible, connected `<iframe>` into view and waits for its frame URL and `load` state. Operates serially to avoid concurrency bugs; fast enough that parallelism is not worth the complexity.

### blurActiveElement()

`blurActiveElement(page: Page): Promise<boolean>`

| Parameter | Default | Description |
|---|---|---|
| `page` | *(required)* | The Playwright page object. |

Removes keyboard focus from a genuinely focused control so its focus ring does not appear in only some screenshot runs. Returns `true` if an element was blurred, `false` if nothing was focused (the `<body>`/`<html>` fallback is left alone). [`takeAccessibleScreenshot()`](screenshots-and-visual-comparisons.md#capture-one-page-or-element) calls this for you unless `blur: false` is passed.

### clearHover()

`clearHover(page: Page): Promise<() => Promise<void>>`

| Parameter | Default | Description |
|---|---|---|
| `page` | *(required)* | The Playwright page object. |

Moves the pointer onto a temporary transparent viewport shield so stale pointer activity cannot leave unrelated page content in its `:hover` state. Returns an idempotent cleanup function that removes the shield and restores normal pointer hit testing. [`takeAccessibleScreenshot()`](screenshots-and-visual-comparisons.md#capture-one-page-or-element) calls and cleans this up automatically unless `clearHover: false` is passed.

### forcePseudoState()

`forcePseudoState(page: Page, selector: string, pseudoClasses: ForcedPseudoClass[]): Promise<() => Promise<void>>`

| Parameter | Default | Description |
|---|---|---|
| `page` | *(required)* | The Playwright page object. |
| `selector` | *(required)* | CSS selector whose first matching element receives the forced state. |
| `pseudoClasses` | *(required)* | One or more of `active`, `focus`, `focus-visible`, `focus-within`, `hover`, or `target`. |

Uses Chromium's `CSS.forcePseudoState` DevTools command to hold interaction CSS
in a deterministic state. It is Chromium-only and throws when the selector has
no match. The returned cleanup function clears the forced classes, detaches the
DevTools session, and is safe to call more than once.

For ordinary cross-browser hover and focus testing, prefer the
[`interactionStates`](screenshots-and-visual-comparisons.md#capture-one-page-or-element) option. It uses
real Playwright interactions and keeps them active through the screenshot and
accessibility scan.

Forced pseudo-states are independent of real pointer hover and DOM focus, so
[`takeAccessibleScreenshot()`](screenshots-and-visual-comparisons.md#capture-one-page-or-element)
can still clear those incidental states while preserving the requested styling
through both the screenshot and accessibility scan. See [Force CSS pseudo-states](screenshots-and-visual-comparisons.md#force-css-pseudo-states) for the
declarative visual-diff configuration and a custom-test example.

### openAllDetails()

`openAllDetails(page: Page): Promise<void>`

Expands every collapsed native HTML `<details>` element on the page so nested
controls become interactable. Call after navigation and before filling fields
inside collapsible regions. This sets the `open` property directly.

```typescript
import { openAllDetails } from '@lullabot/playwright-testing';

await openAllDetails(page);
await page.getByLabel('Title').fill('Hello');
```
