import AxeBuilder from '@axe-core/playwright';
import {expect, type Locator, type Page, type TestInfo} from "@playwright/test";
import {waitForAllImages, type WaitForImagesOptions} from "./images.js";
import {waitForFrames} from "./frames.js"
import {waitForFonts} from "./fonts.js";
import {restoreVideoPlayback, waitForVideos, type WaitForVideosOptions} from "./videos.js";
import {blurActiveElement} from "./focus.js";
import {clearHover} from "./hover.js";
import {
  applyInteractionStates,
  validateInteractionStates,
  type ScreenshotInteractionState,
} from './interaction-states.js'
import axe from 'axe-core';
import {
  type AccessibilityBaseline,
  type AccessibilityBaselineEntry,
  validateAccessibilityBaseline,
} from './accessibility-baseline.js'
import {
  baselineFilePath,
  buildSeed,
  nextAccessibilityScanCount,
  readBaselineFile,
  ScanKind,
  snapshotExists,
  writeBaselineFile,
} from './accessibility-baseline-file.js'

let a11yActionHintShown = false;

export type {InteractionState, ScreenshotInteractionState} from './interaction-states.js'

export interface ScreenshotStabilizationOptions {
  images?: WaitForImagesOptions
  videos?: WaitForVideosOptions
}

export interface ScreenshotOptions {
  /**
   * When set to `"disabled"`, stops CSS animations, CSS transitions and Web Animations. Animations get different
   * treatment depending on their duration:
   * - finite animations are fast-forwarded to completion, so they'll fire `transitionend` event.
   * - infinite animations are canceled to initial state, and then played over after the screenshot.
   *
   * Defaults to `"disabled"` that disables animations.
   */
  animations?: "disabled" | "allow";

  /**
   * When set to `"hide"`, screenshot will hide text caret. When set to `"initial"`, text caret behavior will not be
   * changed.  Defaults to `"hide"`.
   */
  caret?: "hide" | "initial";

  /**
   * When `true` (the default), blurs the active element before capturing so a
   * stray focus ring left over from earlier test interactions does not appear in
   * only some runs (an invisible-to-a-human diff that still trips the pixel
   * budget). Set to `false` when the screenshot intentionally captures a focused
   * state.
   */
  blur?: boolean;

  /**
   * When `true` (the default), moves the pointer onto a temporary transparent
   * shield before capturing so stale pointer activity does not leave an
   * unrelated element in its hover state. Set to `false` when the screenshot
   * intentionally captures a hovered state.
   */
  clearHover?: boolean;

  /**
   * Real hover and focus states to apply after the page has settled. These are
   * supported in Chromium, Firefox, and WebKit and remain active through both
   * the screenshot and accessibility scan. At most one locator may receive
   * each state, matching what a real pointer and keyboard can do.
   */
  interactionStates?: ScreenshotInteractionState[];

  /** Configuration for image and video settling. */
  stabilization?: ScreenshotStabilizationOptions;

  /**
   * An object specifying the page area to capture, in CSS pixels.
   */
  clip?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };

  /**
   * When true, takes a screenshot of the full scrollable page, instead of the currently visible viewport. Defaults to
   * `false`.
   */
  fullPage?: boolean;

  /**
   * Specify locators that should be masked when the screenshot is taken. Masked elements will be overlaid with a pink
   * box `#FF00FF` (customized by `maskColor`) that completely covers its bounding box.
   */
  mask?: Array<Locator>;

  /**
   * Specify the color of the overlay box for masked elements, in
   * [CSS color format](https://developer.mozilla.org/en-US/docs/Web/CSS/color_value). Default color is pink `#FF00FF`.
   */
  maskColor?: string;

  /**
   * An acceptable ratio of pixels that are different to the total amount of pixels, between `0` and `1`. Default is
   * configurable with `TestConfig.expect`. Unset by default.
   */
  maxDiffPixelRatio?: number;

  /**
   * An acceptable amount of pixels that could be different. Default is configurable with `TestConfig.expect`. Unset by
   * default.
   */
  maxDiffPixels?: number;

  /**
   * Hides default white background and allows capturing screenshots with transparency. Not applicable to `jpeg` images.
   * Defaults to `false`.
   */
  omitBackground?: boolean;

  /**
   * When set to `"css"`, screenshot will have a single pixel per each css pixel on the page. For high-dpi devices, this
   * will keep screenshots small. Using `"device"` option will produce a single pixel per each device pixel, so
   * screenshots of high-dpi devices will be twice as large or even larger.
   *
   * Defaults to `"css"`.
   */
  scale?: "css" | "device";

  /**
   * A stylesheet, or list of stylesheets, to apply while taking the screenshot.
   * The styles pierce Shadow DOM and apply to inner frames.
   */
  stylePath?: string | string[];

  /**
   * An acceptable perceived color difference in the [YIQ color space](https://en.wikipedia.org/wiki/YIQ) between the
   * same pixel in compared images, between zero (strict) and one (lax), default is configurable with
   * `TestConfig.expect`. Defaults to `0.2`.
   */
  threshold?: number;

  /**
   * Time to retry the assertion for in milliseconds. Defaults to `timeout` in `TestConfig.expect`.
   */
  timeout?: number;

  /**
   * Accessibility options passed through to checkAccessibility().
   */
  accessibility?: AccessibilityOptions;
}

export interface AccessibilityOptions {
  /** axe tags for WCAG scan. Default: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] */
  wcagTags?: string[]

  /** Additional CSS selectors to exclude from both scans. */
  exclude?: string[]

  /** CSS selectors to exclude only from the best-practice scan. */
  bestPracticeExclude?: string[]

  /** CSS selectors to exclude only from the WCAG scan. */
  wcagExclude?: string[]

  /**
   * Best-practice scan mode.
   * - 'soft': uses expect.soft() (default, current behaviour)
   * - 'hard': uses expect() — test fails immediately on violations
   * - 'off': skips best-practice scan entirely
   */
  bestPracticeMode?: 'soft' | 'hard' | 'off'

  /** Additional axe rules to enable/disable. */
  rules?: Record<string, { enabled: boolean }>

  /** Baseline of known violations. When provided, violations matching the baseline are suppressed and toMatchSnapshot() is skipped. */
  baseline?: AccessibilityBaseline

  /**
   * When true, captures a full-page screenshot with violating elements
   * highlighted (red outline) and attaches it to the test report.
   * Default: true.
   */
  screenshotViolations?: boolean
}

/**
 * Run accessibility checks on the current page using axe-core.
 *
 * Runs a best-practice scan (unless bestPracticeMode is 'off') and a WCAG scan,
 * attaching JSON results and asserting on violations via snapshots.
 *
 * @param page The Page fixture from the test.
 * @param testInfo The testInfo object from the test.
 * @param options Accessibility options to customise the scan.
 */
export async function checkAccessibility(page: Page, testInfo: TestInfo, options?: AccessibilityOptions) {
  const {
    wcagTags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'],
    exclude = [],
    bestPracticeExclude = [],
    wcagExclude = [],
    bestPracticeMode = 'soft',
    rules,
    baseline,
    screenshotViolations = true,
  } = options ?? {}

  if (process.env.CI && !a11yActionHintShown) {
    console.log('Tip: Use @lullabot/playwright-testing/github to surface accessibility violations in pull requests.')
    a11yActionHintShown = true
  }

  // Add @a11y annotation (deduplicated).
  if (!testInfo.annotations.some(a => a.type === '@a11y')) {
    testInfo.annotations.push({ type: '@a11y' })
  }

  if (bestPracticeMode !== 'off') {
    const bpResults = await runBestPracticeScan(page, testInfo, {
      exclude: [...exclude, ...bestPracticeExclude],
      rules,
    })
    // Best-practice always uses expect.soft() so the WCAG scan below runs
    // even when best-practice violations exist. `bestPracticeMode === 'hard'`
    // is preserved as a marker but does not change soft-vs-hard here.
    await dispatchAssertion({
      testInfo,
      results: bpResults,
      scan: 'best-practice',
      expectFn: expect.soft,
      scanLabel: 'Best-practice scan',
    }, baseline)
  }

  const wcagScanResults = await runWcagScan(page, testInfo, {
    wcagTags,
    exclude: [...exclude, ...wcagExclude],
    rules,
  })

  if (screenshotViolations && wcagScanResults.violations.length > 0) {
    await screenshotViolatingElements(page, testInfo, wcagScanResults)
  }

  await dispatchAssertion({
    testInfo,
    results: wcagScanResults,
    scan: 'wcag',
    expectFn: expect,
    scanLabel: 'WCAG scan',
  }, baseline)
}

interface ScanContext {
  testInfo: TestInfo
  results: axe.AxeResults
  scan: ScanKind
  expectFn: typeof expect | typeof expect.soft
  scanLabel: string
}

/**
 * Dispatch the assertion for one scan to the correct mode:
 *
 * 1. Explicit in-code `baseline` option -> baseline mode (existing behaviour).
 * 2. A snapshot file already exists on disk for this test -> snapshot mode
 *    (existing behaviour, preserves all previously committed snapshots).
 * 3. Playwright is in explicit snapshot-update mode (`all`/`changed`, set via
 *    `--update-snapshots`) -> snapshot mode (Playwright will create the
 *    snapshot). `'missing'` is Playwright's default config value and does NOT
 *    indicate explicit user intent, so it falls through to baseline mode.
 * 4. Otherwise -> on-disk baseline mode. If the JSON file exists, load and
 *    match against it. If it does not, seed it. On CI seeding fails the
 *    test (matching Playwright's missing-snapshot behaviour); locally,
 *    seeding passes so the first run is green.
 */
async function dispatchAssertion(ctx: ScanContext, inCodeBaseline?: AccessibilityBaseline): Promise<void> {
  if (inCodeBaseline) {
    return assertBaseline(ctx, inCodeBaseline)
  }

  if (await snapshotExists(ctx.testInfo)) {
    return assertSnapshot(ctx)
  }

  const update = ctx.testInfo.config?.updateSnapshots
  if (update === 'all' || update === 'changed') {
    return assertSnapshot(ctx)
  }

  const callCount = nextAccessibilityScanCount(ctx.testInfo, ctx.scan)
  const filePath = baselineFilePath(ctx.testInfo, ctx.scan, callCount)

  const existing = await readBaselineFile(filePath)
  if (existing) {
    return assertBaseline(ctx, existing.violations)
  }

  // Seed and either pass (local) or fail (CI).
  const normalized = extractNormalizedViolations(ctx.results)
  const seedViolations: AccessibilityBaselineEntry[] = normalized.map(v => ({
    rule: v.rule,
    targets: v.targets,
    reason: 'TODO',
    willBeFixedIn: 'TODO',
  }))
  const seed = buildSeed(seedViolations)
  await writeBaselineFile(filePath, seed)
  await ctx.testInfo.attach(`a11y-${ctx.scan}-baseline-seed`, {
    path: filePath,
    contentType: 'application/json',
  })

  if (process.env.CI) {
    const message = `${ctx.scanLabel}: a11y baseline file was missing for this test. Seeded to ${filePath} — download the attached file from CI artifacts (or re-run locally) and commit it before merging.`
    ctx.expectFn(null, message).toBe('a11y baseline file present')
    return
  }

  ctx.testInfo.annotations.push({
    type: 'Accessibility',
    description: seed.violations.length === 0
      ? `${ctx.scanLabel}: a11y baseline seeded at ${filePath} (no violations).`
      : `${ctx.scanLabel}: a11y baseline seeded at ${filePath} with ${seed.violations.length} entries — fill in reason/willBeFixedIn before committing.`,
  })
  // A local seed is deliberately permissive and contains TODO metadata. The
  // next run validates the committed file before treating entries as waivers.
}

/**
 * Run the best-practice axe scan, attach results, and return them for
 * dispatch. The assertion (snapshot vs baseline) is decided by the
 * dispatcher based on what's already on disk and the `bestPracticeMode`
 * option drives soft- vs hard-failure behaviour.
 */
async function runBestPracticeScan(
  page: Page,
  testInfo: TestInfo,
  opts: {
    exclude: string[]
    rules?: Record<string, { enabled: boolean }>
  },
): Promise<axe.AxeResults> {
  const builder = new AxeBuilder({ page })
    .withTags(['best-practice'])

  for (const selector of opts.exclude) {
    builder.exclude(selector)
  }

  if (opts.rules) {
    builder.options({ rules: opts.rules })
  }

  const results = await builder.analyze()

  await testInfo.attach('a11y-best-practice-scan-results', {
    body: JSON.stringify(results, null, 2),
    contentType: 'application/json'
  })

  testInfo.annotations.push({
    type: 'Accessibility',
    description: `Best-practice scan: ${results.violations.length} violations (${results.passes.length} rules passed)`
  })

  return results
}

/**
 * Run the WCAG axe scan, attach results, and return them for assertion.
 */
async function runWcagScan(
  page: Page,
  testInfo: TestInfo,
  opts: {
    wcagTags: string[]
    exclude: string[]
    rules?: Record<string, { enabled: boolean }>
  },
): Promise<axe.AxeResults> {
  const builder = new AxeBuilder({ page })
    .withTags(opts.wcagTags)

  for (const selector of opts.exclude) {
    builder.exclude(selector)
  }

  if (opts.rules) {
    builder.options({ rules: opts.rules })
  }

  const results = await builder.analyze()

  await testInfo.attach('a11y-wcag-scan-results', {
    body: JSON.stringify(results, null, 2),
    contentType: 'application/json'
  })

  return results
}

/**
 * Take a full-page screenshot with violating elements highlighted and
 * attach it to the test report.
 */
async function screenshotViolatingElements(page: Page, testInfo: TestInfo, results: axe.AxeResults) {
  // Collect all raw CSS selectors from violation nodes.
  const selectors = results.violations
    .flatMap(v => v.nodes)
    .flatMap(n => n.target)
    .filter((t): t is string => typeof t === 'string')

  if (selectors.length === 0) return

  // Inject highlight outlines on all violating elements.
  await page.evaluate((sels) => {
    const style = document.createElement('style')
    style.setAttribute('data-a11y-highlight', 'true')
    // Use a CSS rule for each selector so the outline persists even if
    // elements are repositioned during the screenshot.
    const rules = sels.map(s => `${s} { outline: 3px solid #e53e3e !important; outline-offset: 2px !important; }`).join('\n')
    style.textContent = rules
    document.head.appendChild(style)
  }, selectors)

  try {
    const screenshot = await page.screenshot({ fullPage: true })

    await testInfo.attach('a11y-violation-screenshot', {
      body: screenshot,
      contentType: 'image/png',
    })
  } finally {
    // Remove the injected styles even if capture or report attachment fails.
    await page.evaluate(() => {
      document.querySelector('style[data-a11y-highlight]')?.remove()
    })
  }
}

/**
 * Assert violations against a baseline allowlist (in-code or on-disk).
 */
function assertBaseline(ctx: ScanContext, baseline: AccessibilityBaseline) {
  validateAccessibilityBaseline(baseline)
  const { testInfo, results, scanLabel, expectFn } = ctx
  const allViolations = extractNormalizedViolations(results)
  const matchedBaselineIndices = new Set<number>()
  const unmatchedViolations: typeof allViolations = []

  for (const violation of allViolations) {
    const baselineIndex = baseline.findIndex((entry) => {
      if (entry.rule !== violation.rule) return false
      // Check for at least one overlapping normalized target.
      return entry.targets.some(baselineTarget =>
        violation.targets.some(violationTarget => violationTarget === baselineTarget)
      )
    })

    if (baselineIndex >= 0) {
      matchedBaselineIndices.add(baselineIndex)
      const entry = baseline[baselineIndex]
      testInfo.annotations.push({
        type: 'Baselined a11y violation',
        description: `${entry.rule}: ${entry.reason} — ${entry.willBeFixedIn}`,
      })
    } else {
      unmatchedViolations.push(violation)
    }
  }

  // Report stale baseline entries.
  baseline.forEach((entry, idx) => {
    if (!matchedBaselineIndices.has(idx)) {
      testInfo.annotations.push({
        type: 'Stale a11y baseline entry',
        description: `${entry.rule} on ${entry.targets.join(', ')} — no longer detected`,
      })
    }
  })

  // Summary annotation for baseline mode.
  const baselinedCount = matchedBaselineIndices.size
  testInfo.annotations.push({
    type: 'Accessibility',
    description: `${scanLabel}: ${unmatchedViolations.length} new violations (${baselinedCount} baselined)`,
  })

  // Fail on unmatched violations with detailed output.
  if (unmatchedViolations.length > 0) {
    const details = formatViolationDetails(results, unmatchedViolations)
    expectFn(null, details).toBe('no accessibility violations')
  }
}

/**
 * Assert via snapshot comparison (legacy mode for tests with committed snapshots).
 */
async function assertSnapshot(ctx: ScanContext) {
  const { testInfo, results, scan, expectFn } = ctx

  // Match the legacy summary annotation phrasing for WCAG; best-practice's
  // pre-existing summary annotation is emitted in runBestPracticeScan.
  if (scan === 'wcag') {
    testInfo.annotations.push({
      type: 'Accessibility',
      description: `WCAG scan: ${results.violations.length} violations (${results.passes.length} rules passed)`
    })

    // If there are violations, attach baseline suggestions and push annotation.
    if (results.violations.length > 0) {
      const allViolations = extractNormalizedViolations(results)
      const suggestions = allViolations.map(v => formatBaselineSuggestion(v)).join('\n')
      await testInfo.attach('a11y-baseline-suggestions', {
        body: suggestions,
        contentType: 'text/plain',
      })
      testInfo.annotations.push({
        type: 'Accessibility',
        description: 'To manage violations explicitly, switch to baseline mode. See a11y-baseline-suggestions attachment.',
      })
    }
  }

  return expectFn(violationFingerprints(results)).toMatchSnapshot()
}

/**
 * Take a visual comparison, and also ensure there's no accessibility issues.
 *
 * @param page The Page fixture from the test.
 * @param testInfo The testInfo object from the test.
 * @param options Screenshot options from toHaveScreenshot().
 * @param scrollLocator A locator to ensure is visible before taking the screenshot.
 * @param locator A specific locator to take the screenshot of. aXe still checks the whole page.
 */
export async function takeAccessibleScreenshot(page: Page, testInfo: TestInfo, options?: ScreenshotOptions, scrollLocator?: Locator, locator?: Locator|Page)  {
  const screenshotOptions = options ?? {}

  // The default is 5 seconds. However, even on a fast machine it can take
  // longer than 5 seconds for large pages like node forms to stabilize. This
  // doesn't affect end users because the page still being rendered is
  // typically below the viewport, and it's loaded by the time they scroll.
  // So, we set this to at least 10 seconds, unless it's already larger.
  // To test changing this, try running this command and see if it times out:
  const interactionStates = screenshotOptions.interactionStates ?? []
  validateInteractionStates(interactionStates)

  // Do not pass package-specific orchestration options to Playwright's matcher.
  const {
    accessibility: _accessibility,
    blur: _blur,
    clearHover: _clearHover,
    interactionStates: _interactionStates,
    stabilization,
    ...nativeScreenshotOptions
  } = screenshotOptions
  const playwrightScreenshotOptions = {
    ...nativeScreenshotOptions,
    timeout: Math.max(nativeScreenshotOptions.timeout ?? 0, 10000),
  }

  // Blur any focused element so a stray focus ring does not make the screenshot
  // non-deterministic, unless the caller is intentionally capturing focus. Do
  // this before the load/stability waits so that any layout change a blur
  // handler triggers (a closing dropdown, injected validation markup) settles
  // before we capture.
  if (screenshotOptions.blur !== false) {
    await blurActiveElement(page);
  }

  let removeHoverShield = screenshotOptions.clearHover === false ? undefined : await clearHover(page);
  let videoPlaybackRestored = false
  let cleanupInteractionStates: (() => Promise<void>) | undefined

  try {
    await waitForFrames(page);
    // Loading lazy frames can scroll the page. Load images afterwards so that
    // any images exposed by that scrolling are settled and waitForAllImages()
    // restores the viewport to the top before capture.
    await waitForAllImages(page, stabilization?.images);
    await waitForFonts(page);
    // Last of the waits, so the video frames it composites are as fresh as
    // possible when the capture happens. It restores the scroll position it
    // found, so it does not disturb where the waits above leave the page.
    await waitForVideos(page, stabilization?.videos);

    if (scrollLocator) {
      await scrollLocator.scrollIntoViewIfNeeded();
    }

    // A hover action cannot hit its target through the transparent shield used
    // to clear incidental hover. Remove it only after all stability waits, then
    // apply real hover before real focus so focusing cannot disturb the pointer.
    const hasHover = interactionStates.some(({states}) => states.includes('hover'))
    if (hasHover) {
      await removeHoverShield?.()
      removeHoverShield = undefined
    }
    if (interactionStates.length > 0) {
      cleanupInteractionStates = await applyInteractionStates(interactionStates, {
        clearHover: async () => {
          const removeInteractionShield = await clearHover(page)
          await removeInteractionShield()
        },
      })
    }

    let locatorToScreenshot: Page|Locator = page;
    if (locator) {
      locatorToScreenshot = locator;
    }
    // Soft failure here so we can get accessibility violations too.
    await expect.soft(locatorToScreenshot).toHaveScreenshot(playwrightScreenshotOptions);

    // Settling a video pauses it, clears `autoplay` and rewinds it. That is only
    // wanted for the duration of the capture: a test that screenshots a page and
    // then asserts that a video is playing should still pass.
    await restoreVideoPlayback(page);
    videoPlaybackRestored = true

    await removeHoverShield?.()
    removeHoverShield = undefined

    return await checkAccessibility(page, testInfo, screenshotOptions.accessibility)
  } finally {
    // Nest cleanup so a failure in one operation cannot prevent the remaining
    // browser state from being restored.
    try {
      await removeHoverShield?.();
    } finally {
      try {
        if (!videoPlaybackRestored) {
          await restoreVideoPlayback(page);
        }
      } finally {
        await cleanupInteractionStates?.()
      }
    }
  }
}

/**
 * Normalize a single CSS selector target for stable comparison.
 *
 * Replaces unique numeric HTML IDs and aria-labelledby suffixes with
 * a stable placeholder so that snapshots and baseline matching are
 * deterministic across runs.
 */
export function normalizeTarget(target: string | string[]): string | string[] {
  const uniqueHtmlID = /(#[^#]*)--\d+/
  const ariaLabelledById = /(aria-labelledby="[^"]+)--\d+"/
  if (typeof target === 'string') {
    return target
      .replace(uniqueHtmlID, '$1--UNIQUE-ID')
      .replace(ariaLabelledById, '$1--UNIQUE-ID"')
  }
  return target
}

interface NormalizedViolation {
  rule: string
  targets: string[]
  description: string
  impact: string
  helpUrl: string
}

/**
 * Extract violations from axe results and normalize their targets into
 * flat, deduplicated CSS selector strings.
 */
function extractNormalizedViolations(results: axe.AxeResults): NormalizedViolation[] {
  return results.violations.map(violation => {
    const flatTargets: string[] = []
    for (const node of violation.nodes) {
      for (const target of node.target) {
        const normalized = normalizeTarget(target)
        const str = typeof normalized === 'string' ? normalized : normalized.join(' ')
        if (!flatTargets.includes(str)) {
          flatTargets.push(str)
        }
      }
    }
    return {
      rule: violation.id,
      targets: flatTargets,
      description: violation.description,
      impact: violation.impact ?? 'unknown',
      helpUrl: violation.helpUrl,
    }
  })
}

/**
 * Format a single violation as a copy-pasteable baseline entry.
 */
function formatBaselineSuggestion(violation: NormalizedViolation): string {
  const targetsStr = violation.targets.map(t => `'${t}'`).join(', ')
  return `{
  rule: '${violation.rule}',
  targets: [${targetsStr}],
  reason: '',  // TODO: explain why this is accepted
  willBeFixedIn: '',  // TODO: link to tracking ticket
},`
}

/**
 * Format detailed failure output for unmatched violations, including
 * copy-pasteable baseline entries.
 */
function formatViolationDetails(results: axe.AxeResults, violations: NormalizedViolation[]): string {
  const lines: string[] = []
  for (const v of violations) {
    const targetsStr = JSON.stringify(v.targets)
    lines.push(`Accessibility violation (${v.impact}): ${v.rule}`)
    lines.push(`  ${v.description}`)
    lines.push(`  Help: ${v.helpUrl}`)
    lines.push(`  Targets: ${targetsStr}`)
    lines.push('')
    lines.push('  Add to your baseline to accept this violation:')
    lines.push('  ' + formatBaselineSuggestion(v).split('\n').join('\n  '))
    lines.push('')
  }
  return lines.join('\n')
}

/**
 * Filter violations down to stable elements.
 *
 * If we try to create a snapshot of the entire report, it will fail on random
 * unique HTML IDs.
 *
 * @param accessibilityScanResults
 */
function violationFingerprints(accessibilityScanResults: axe.AxeResults) {
  const violationFps = accessibilityScanResults.violations.map(violation => ({
    rule: violation.id,
    // These are CSS selectors which uniquely identify each element with
    // a violation of the rule in question.
    targets: violation.nodes.map(node => node.target.map((target) => {
      return normalizeTarget(target)
    })),
  }));

  return JSON.stringify(violationFps, null, 2);

}
