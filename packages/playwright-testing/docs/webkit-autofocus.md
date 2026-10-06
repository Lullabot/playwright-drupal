# WebKit native autofocus workaround

Upstream reports: [WebKit bug 308393](https://bugs.webkit.org/show_bug.cgi?id=308393)
and [Playwright issue 43086](https://github.com/microsoft/playwright/issues/43086).
See also the [proposed WebKit fix](https://github.com/WebKit/WebKit/pull/75897) and
[standalone reproduction](https://github.com/deviantintegral/playwright-autofocus-repro).

Playwright's bundled WebKit can apply native HTML `autofocus` after another field
has received focus. If this happens during `locator.fill()`, text can land in the
wrong field. `@lullabot/playwright-testing` exports
`suppressWebKitAutofocus()` for installing a workaround in your own browser
contexts. You can keep using Playwright's bundled browser.

## Install in your context fixture

The utility runs in the browser through `BrowserContext.addInitScript()`; do not
call it directly in Node.js. Install it before navigating any pages, and only
when `browserName === 'webkit'`. This includes desktop Safari and mobile device
profiles; project names do not affect selection. Importing the package alone
installs nothing and leaves native autofocus unchanged.

The package does not export a shared `test` fixture. Extend Playwright's fixture
locally if you want automatic installation and a per-test opt-out:

```typescript
import { test as base, expect } from '@playwright/test';
import { suppressWebKitAutofocus } from '@lullabot/playwright-testing';

interface AutofocusOptions {
  webkitAutofocusWorkaround: boolean;
}

const test = base.extend<AutofocusOptions>({
  webkitAutofocusWorkaround: [true, { option: true }],
  context: async ({ context, browserName, webkitAutofocusWorkaround }, use) => {
    if (browserName === 'webkit' && webkitAutofocusWorkaround) {
      await context.addInitScript(suppressWebKitAutofocus);
    }
    await use(context);
  },
});

export { test, expect };
```

Chromium and Firefox retain their normal autofocus behavior because this fixture
skips installation in those browsers. The helper itself does not select a browser.
For manually created WebKit contexts, install it explicitly before navigation:

```typescript
const context = await browser.newContext();
await context.addInitScript(suppressWebKitAutofocus);
const page = await context.newPage();
await page.goto('/login');
```

`@lullabot/playwright-drupal` installs the same helper by default in its shared
fixture. See its [configuration and opt-out guide][drupal-webkit-autofocus].

## What changes in your tests

**Native document autofocus is suppressed.** Elements with `autofocus` briefly
become unfocusable while WebKit discards their pending autofocus requests. Normal
form controls become invisible but keep their layout boxes; other HTML candidates
and their descendants temporarily leave layout. Their authored styles are restored
afterward, and the `autofocus` attribute is retained.

Ordinary Playwright actions wait for these elements to become visible. The
workaround leaves `Locator.fill()`, focus methods, selection, keyboard input,
input events, disabled/read-only checks and timeouts unchanged. However, application
code that measures or focuses an affected element during loading can observe the
temporary hiding. Slow stylesheets and background-page rendering can extend it.

## Opt out when testing autofocus or loading behavior

Skip installation for tests that exercise native autofocus, dialog/popover
autofocus, initial scripted focus, or layout while the page is loading. With the
local fixture above, use:

```typescript
test.describe('native autofocus behavior', () => {
  test.use({ webkitAutofocusWorkaround: false });

  test('login field receives native focus', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByLabel('Username')).toBeFocused();
  });
});
```

For configuration-level options with that local fixture, use
`defineConfig<AutofocusOptions>` and set `use.webkitAutofocusWorkaround` to `false`.
The option is defined by your fixture, not registered by the generic package.
Set it before the browser context is created; changing it afterward cannot remove
an installed init script.

## Coverage and limitations

The workaround protects standard light-DOM HTML forms in the browser context
where it is installed. Coverage includes navigations, reloads, popups,
`context.newPage()`, same-origin frame navigations, `srcdoc`, and dynamic form
insertion, replacement and reinsertion.
It handles queued candidates even if application code removes their `autofocus`
attribute or temporarily detaches them before the queue is processed.

Keep these boundaries in mind when deciding whether a test should opt out:

- Contexts created separately with `browser.newContext()` do not inherit the
  workaround. Install it explicitly in each context that needs it. Tests using
  `test` directly from `@playwright/test` do not install it automatically.
- Cross-origin frames are left alone because WebKit already rejects their native
  document autofocus candidates.
- Application JavaScript can still steal focus during a fill. The reproduction's
  controlled JavaScript focus-stealing case remains observable with the workaround
  enabled; it is separate from the native autofocus race.
- SVG autofocus, shadow-root internals, synchronous dialog/popover focusing, and
  CSS transitions or animations that keep a hidden candidate focusable are outside
  the validated scope.
- `force: true`, direct keyboard input and page scripts can bypass the visibility
  wait. Wait for an autofocus candidate to become visible before using them.
- An application style change to exactly the temporary
  `visibility: hidden !important` or `display: none !important` value cannot be
  distinguished from the workaround's own value during that interval.

## Validation

The original implementation was validated on Debian 13 with Playwright 1.63.0
and bundled WebKit 26.6 (build 2359). The standalone reproduction, using the shared fixture,
completed 2,000 desktop native navigations without a wrong-field fill. The iPhone 13
project also completed 2,000 native navigations. Both runs suppressed native
autofocus before filling. Chromium and Firefox retained native autofocus and
passed 300 repeated navigations each.

The original browser suite passed 44 tests covering navigation, frames, popups,
dynamic forms, blocked stylesheets, authored styles, input behavior and opt-out. Native
stress runs can also pass without the workaround because the race is intermittent;
queue-specific regressions verify suppression separately. The controlled
JavaScript route still produces Username `alicesecret` and an empty Password.

Desktop Safari and iPhone 13 here use Playwright's Linux WebKit and device
emulation. macOS, Windows, system Safari, physical iPhones and older Playwright
bundles were not tested. Check your tests on the host and bundled browser versions
you support when adopting the workaround or upgrading Playwright.

Run the generic browser regressions from the monorepo root with:

```console
npm run build
npm run test:autofocus --workspace=@lullabot/playwright-testing
```

The root `npm run test:autofocus` command also runs the Drupal fixture integration
checks. Both suites use bundled Chromium, Firefox, desktop WebKit, and iPhone 13
emulation. Set `REPEATS` to change the native navigation stress count (default 300).

## When the workaround can be removed

Keep the workaround enabled until the WebKit bundled with your Playwright version
includes the upstream fix and your native autofocus tests pass with
`webkitAutofocusWorkaround: false`. A merged WebKit PR alone does not establish
that your bundled browser is fixed.

The package can remove the workaround once its minimum supported Playwright
version includes the fix and native stress, focus-preservation, dynamic-form and
frame tests pass without it on supported platforms and desktop/mobile profiles.

## Implementation details

WebKit queues autofocus candidates on insertion and does not recheck the
`autofocus` attribute when processing them. Removing the attribute in a
MutationObserver therefore cannot reliably cancel the pending focus.

The workaround instead temporarily makes candidates unfocusable so WebKit discards
them. It restores their styles after the top document's `DOMContentLoaded` and an
animation-frame callback: WebKit flushes autofocus before these callbacks, but a
parser waiting for stylesheets can defer the flush. This uses investigated WebKit
rendering order rather than assuming that a two-frame delay guarantees safety.
Relevant source: [candidate insertion](https://github.com/WebKit/WebKit/blob/0971e7a2270b21f25bac302361018c20175f445e/Source/WebCore/dom/Element.cpp),
[queue processing](https://github.com/WebKit/WebKit/blob/0971e7a2270b21f25bac302361018c20175f445e/Source/WebCore/dom/Document.cpp),
and [rendering order](https://github.com/WebKit/WebKit/blob/0971e7a2270b21f25bac302361018c20175f445e/Source/WebCore/page/Page.cpp).

[drupal-webkit-autofocus]: https://github.com/Lullabot/playwright-drupal/blob/main/docs/working-with-tests/webkit-autofocus.md
