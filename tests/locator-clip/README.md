# Locator clip investigation

Upstream inspected at `b533b94` (1.12.1, matching origin HEAD). The existing
helper already forwards raw `clip` to the page assertion and accepts a locator
as its fifth argument. This experiment adds one option to that implementation.

Run from the repository root:

```sh
npm ci
npx playwright install --with-deps chromium firefox webkit
node tests/locator-clip/verify.mjs
```

The verifier runs the 18 browser checks normally, then runs the six derived-clip
comparisons twice with intentional mutations. It requires actual screenshot
comparison failures for every browser and both coordinate modes: changing the
heading text, and moving the heading 20 CSS pixels inside the crop. It rejects
browser launch failures or unrelated failures as evidence of regression
sensitivity. Snapshot updating is disabled during verification.

To intentionally regenerate baselines after reviewing rendering changes:

```sh
npx playwright test -c tests/locator-clip/playwright.config.ts --update-snapshots
```

The reproduction deliberately moves an otherwise blank, white element from
`left: 40.125px` to `40.375px`, keeping its width at `240.75px`. Playwright's
locator capture encloses fractional bounds in integer pixels, so one edge
crosses a pixel boundary and the PNG width changes by one pixel. A rounded
page clip produces identical PNGs. Blank content isolates crop dimensions from
subpixel painting. This is a deterministic reproduction of the enclosure
mechanism, not proof that every screenshot failure has the same cause; it does not
reproduce application-specific scroll handlers or fonts. The separate text
fixtures verify that clipping still detects meaningful rendered differences.

Tests also cover below-the-fold targets, horizontal scrolling, iframe bounds,
oversized targets requiring fullPage, and an unlabelled image outside the crop
that must still fail the page-wide accessibility scan. Baselines are specific
to the browser and rendering environment, as with other Playwright snapshots.

Validation environment: Debian 13, Playwright 1.63.0, Chromium 153.0.8010.12,
Firefox 155.0, WebKit 26.6. See the linked documentation for the API's limits:
[locator-derived clips](../../docs/working-with-tests/visual-comparisons.md#locator-derived-page-clips).

Recorded validation: 18 browser checks passed; all six content-mutation and all
six layout-mutation comparisons failed specifically on visual assertions.
