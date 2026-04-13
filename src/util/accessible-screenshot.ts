import AxeBuilder from '@axe-core/playwright';
import {expect, Locator, Page, TestInfo} from "@playwright/test";
import {waitForAllImages} from "./images";
import {waitForFrames} from "./frames"
import axe from 'axe-core';
import {AccessibilityBaseline} from './accessibility-baseline'

let a11yActionHintShown = false;

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

  /** When true, removes hardcoded Drupal exclusions from scans. Default: false. */
  disableDefaultExclusions?: boolean

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
    bestPracticeMode = 'soft',
    rules,
    baseline,
    disableDefaultExclusions = false,
    screenshotViolations = true,
  } = options ?? {}

  if (process.env.CI && !a11yActionHintShown) {
    console.log('Tip: Surface a11y violations in your PR with the a11y-annotations action. See: https://github.com/Lullabot/playwright-drupal#github-accessibility-annotations')
    a11yActionHintShown = true
  }

  // Add @a11y annotation (deduplicated).
  if (!testInfo.annotations.some(a => a.type === '@a11y')) {
    testInfo.annotations.push({ type: '@a11y' })
  }

  if (bestPracticeMode !== 'off') {
    await runBestPracticeScan(page, testInfo, { exclude, rules, disableDefaultExclusions, bestPracticeMode })
  }

  const wcagScanResults = await runWcagScan(page, testInfo, { wcagTags, exclude, rules, disableDefaultExclusions })

  if (screenshotViolations && wcagScanResults.violations.length > 0) {
    await screenshotViolatingElements(page, testInfo, wcagScanResults)
  }

  // Baseline mode: match violations against the baseline instead of using snapshots.
  if (baseline) {
    return assertBaseline(testInfo, wcagScanResults, baseline)
  }

  // Snapshot mode (no baseline).
  return assertSnapshot(testInfo, wcagScanResults)
}

/**
 * Run the best-practice axe scan and assert on violations via snapshot.
 *
 * Always uses expect.soft() so the WCAG scan runs regardless of failures.
 * When bestPracticeMode is 'hard', failures still mark the test as failed
 * (that's what expect.soft() does) but execution continues.
 */
async function runBestPracticeScan(
  page: Page,
  testInfo: TestInfo,
  opts: {
    exclude: string[]
    rules?: Record<string, { enabled: boolean }>
    disableDefaultExclusions: boolean
    bestPracticeMode: 'soft' | 'hard'
  },
) {
  const builder = new AxeBuilder({ page })
    .withTags(['best-practice'])

  // Default Drupal exclusions for best-practice scan.
  if (!opts.disableDefaultExclusions) {
    builder
      // Exclude "Skip to main content" anchor.
      // See https://dequeuniversity.com/rules/axe/4.7/region?application=playwright
      .exclude('.focusable.skip-link')
      // Exclude duplicated landmarks.
      // See https://dequeuniversity.com/rules/axe/4.7/landmark-unique?application=playwright
      .exclude('[role="article"]')
      .exclude('[role="region"]')
      .exclude('.footer__inner-3')
  }

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

  // Always use expect.soft() so the WCAG scan below runs even if
  // best-practice violations are found.
  expect.soft(violationFingerprints(results)).toMatchSnapshot()
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
    disableDefaultExclusions: boolean
  },
): Promise<axe.AxeResults> {
  const builder = new AxeBuilder({ page })
    .withTags(opts.wcagTags)

  // Default Drupal exclusion for WCAG scan.
  if (!opts.disableDefaultExclusions) {
    builder.exclude('[data-drupal-media-preview="ready"]')
  }

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

/** Padding in CSS pixels around the violation bounding rect when cropping. */
const CROP_PADDING = 100

/**
 * Maximum crop height in CSS pixels. Caps the screenshot when violations are
 * spread far apart on a long page so the embedded image stays manageable.
 */
const MAX_CROP_HEIGHT = 2000

/**
 * Take a screenshot with violating elements highlighted and attach it to the
 * test report. The screenshot is cropped to the bounding rect of all violating
 * elements (plus padding) rather than capturing the full page, keeping the
 * image small enough to embed in the GitHub step summary.
 */
async function screenshotViolatingElements(page: Page, testInfo: TestInfo, results: axe.AxeResults) {
  // Collect all raw CSS selectors from violation nodes.
  const selectors = results.violations
    .flatMap(v => v.nodes)
    .flatMap(n => n.target)
    .filter((t): t is string => typeof t === 'string')

  if (selectors.length === 0) return

  // Inject highlight outlines on all violating elements and, in the same
  // evaluate call, compute the union bounding rect in document coordinates
  // (viewport rect + scroll offset) so we know where to crop.
  const violationBounds = await page.evaluate((sels) => {
    const style = document.createElement('style')
    style.setAttribute('data-a11y-highlight', 'true')
    // Use a CSS rule for each selector so the outline persists even if
    // elements are repositioned during the screenshot.
    const rules = sels.map(s => `${s} { outline: 3px solid #e53e3e !important; outline-offset: 2px !important; }`).join('\n')
    style.textContent = rules
    document.head.appendChild(style)

    // Compute the union bounding rect of all violating elements in document
    // coordinates. getBoundingClientRect() returns viewport-relative coords;
    // adding scrollX/scrollY converts to page-absolute coordinates that
    // Playwright's clip option expects.
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const sel of sels) {
      try {
        const elements = document.querySelectorAll(sel)
        for (const el of elements) {
          const rect = el.getBoundingClientRect()
          // Skip zero-size elements (hidden or collapsed).
          if (rect.width === 0 && rect.height === 0) continue
          minX = Math.min(minX, rect.left + window.scrollX)
          minY = Math.min(minY, rect.top + window.scrollY)
          maxX = Math.max(maxX, rect.right + window.scrollX)
          maxY = Math.max(maxY, rect.bottom + window.scrollY)
        }
      } catch {
        // Invalid selector — skip.
      }
    }

    return minX === Infinity
      ? null
      : { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
  }, selectors)

  // Crop to the violation area with padding. Fall back to full-page when no
  // bounding rect could be computed (e.g. all elements are hidden).
  let screenshotOptions: Parameters<typeof page.screenshot>[0]

  if (violationBounds) {
    const x = Math.max(0, violationBounds.x - CROP_PADDING)
    const y = Math.max(0, violationBounds.y - CROP_PADDING)
    const width = violationBounds.width + 2 * CROP_PADDING
    // Cap height so violations spread across a very long page don't produce a
    // huge image. The GitHub summary embeds this as inline base64.
    const height = Math.min(violationBounds.height + 2 * CROP_PADDING, MAX_CROP_HEIGHT)
    screenshotOptions = { clip: { x, y, width, height } }
  } else {
    screenshotOptions = { fullPage: true }
  }

  const screenshot = await page.screenshot(screenshotOptions)

  await testInfo.attach('a11y-violation-screenshot', {
    body: screenshot,
    contentType: 'image/png',
  })

  // Remove the injected styles so they don't affect subsequent assertions.
  await page.evaluate(() => {
    document.querySelector('style[data-a11y-highlight]')?.remove()
  })
}

/**
 * Assert WCAG violations against a baseline allowlist.
 */
function assertBaseline(testInfo: TestInfo, wcagScanResults: axe.AxeResults, baseline: AccessibilityBaseline) {
  const allViolations = extractNormalizedViolations(wcagScanResults)
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
    description: `WCAG scan: ${unmatchedViolations.length} new violations (${baselinedCount} baselined)`,
  })

  // Fail on unmatched violations with detailed output.
  if (unmatchedViolations.length > 0) {
    const details = formatViolationDetails(wcagScanResults, unmatchedViolations)
    expect(null, details).toBe('no accessibility violations')
  }
}

/**
 * Assert WCAG violations via snapshot comparison (default mode).
 */
async function assertSnapshot(testInfo: TestInfo, wcagScanResults: axe.AxeResults) {
  testInfo.annotations.push({
    type: 'Accessibility',
    description: `WCAG scan: ${wcagScanResults.violations.length} violations (${wcagScanResults.passes.length} rules passed)`
  })

  // If there are violations, attach baseline suggestions and push annotation.
  if (wcagScanResults.violations.length > 0) {
    const allViolations = extractNormalizedViolations(wcagScanResults)
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

  return expect(violationFingerprints(wcagScanResults)).toMatchSnapshot()
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
  if (!options) {
    options = {}
  }

  // The default is 5 seconds. However, even on a fast machine it can take
  // longer than 5 seconds for large pages like node forms to stabilize. This
  // doesn't affect end users because the page still being rendered is
  // typically below the viewport, and it's loaded by the time they scroll.
  // So, we set this to at least 10 seconds, unless it's already larger.
  // To test changing this, try running this command and see if it times out:
  options.timeout = Math.max(options.timeout ?? 0, 10000)

  // Handle browsers that have strongly non-deterministic rendering of images.
  if (testInfo.project.name == 'desktop firefox') {
    options.threshold = 0.5;
  }
  if (testInfo.project.name == 'desktop safari') {
    options.threshold = 0.8;
  }

  await waitForAllImages(page);
  await waitForFrames(page);

  if (scrollLocator) {
    await scrollLocator.scrollIntoViewIfNeeded();
  }

  let locatorToScreenshot: Page|Locator = page;
  if (locator) {
    locatorToScreenshot = locator;
  }
  // Soft failure here so we can get accessibility violations too.
  await expect.soft(locatorToScreenshot).toHaveScreenshot(options);

  return checkAccessibility(page, testInfo, options.accessibility)
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
