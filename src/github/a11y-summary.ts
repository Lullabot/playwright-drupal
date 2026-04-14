import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { spawnSync } from 'child_process'

/**
 * GitHub's limit for `$GITHUB_STEP_SUMMARY` content is 1 MiB — above that the
 * summary is dropped. Stay comfortably under the cap so there's headroom for
 * any content written by other steps in the same job.
 */
const MAX_SUMMARY_BYTES = 900_000

/**
 * Per-screenshot byte cap (checked after imagemagick optimisation). Base64
 * inflates size by ~33%, so at 150 KiB we keep each embedded image around
 * 200 KiB on the wire. Screenshots that still exceed this after optimisation
 * are dropped with a note — they are still visible in the Playwright HTML report.
 */
const MAX_SCREENSHOT_BYTES = 150_000

/** Maximum number of screenshots to embed regardless of size. */
const MAX_SCREENSHOTS = 5

/** Annotation types that identify accessibility-relevant test data. */
const A11Y_ANNOTATION_TYPES = new Set([
  '@a11y',
  'Accessibility',
  'Baselined a11y violation',
  'Stale a11y baseline entry',
])

/**
 * Escape a string for use inside a GitHub Actions workflow-command message
 * body (the text after `::`). Without this, a crafted value containing a
 * newline or `%` sequence could forge additional workflow commands.
 * See https://docs.github.com/en/actions/reference/workflow-commands-for-github-actions
 */
function escapeWorkflowCommand(value: string): string {
  return String(value)
    .replace(/%/g, '%25')
    .replace(/\r/g, '%0D')
    .replace(/\n/g, '%0A')
}

/**
 * Escape a string for use inside a GitHub Actions workflow-command property
 * value (e.g. `file=...`, `title=...`). Property values additionally require
 * escaping of `:` and `,` on top of the message-body escapes.
 */
function escapeWorkflowCommandProperty(value: string): string {
  return escapeWorkflowCommand(value)
    .replace(/:/g, '%3A')
    .replace(/,/g, '%2C')
}

/**
 * Escape a string for use inside a Markdown table cell. Backslashes must be
 * escaped first (they are Markdown's escape character), then pipes and
 * newlines can be substituted safely.
 */
function escapeMarkdownTableCell(value: string): string {
  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/\|/g, '\\|')
    .replace(/\r?\n/g, ' ')
}

/**
 * Escape a string for use inside a Markdown inline code span (backticks).
 * A literal backtick would close the span early and let the remainder render
 * as Markdown — wrap the value in double backticks and pad literal backticks
 * with spaces, which is the standard CommonMark escape for code spans.
 */
function escapeMarkdownCodeSpan(value: string): string {
  const s = String(value).replace(/\r?\n/g, ' ')
  if (!s.includes('`')) return `\`${s}\``
  return `\`\` ${s.replace(/``/g, '` `')} \`\``
}

/** A test that has accessibility-related annotations and/or attachments. */
export interface A11yTestResult {
  /** Test title path, e.g. "a11y > homepage has accessibility violations" */
  title: string
  /** Source file, e.g. "tests/a11y.spec.ts" */
  file: string
  /** Line number in the source file. */
  line: number
  /** Accessibility annotations from testInfo.annotations. */
  annotations: Array<{ type: string; description?: string }>
  /** Parsed WCAG scan violations (from a11y-wcag-scan-results attachment). */
  violations: NormalizedViolation[]
  /** Raw bytes of the violation screenshot, if any. */
  screenshot?: Buffer
}

interface NormalizedViolation {
  rule: string
  impact: string
  description: string
  helpUrl: string
  targets: string[]
}

/** Parsed report with only accessibility-relevant data. */
export interface A11yReport {
  tests: A11yTestResult[]
  totalViolations: number
  totalBaselined: number
  totalStale: number
}

/**
 * Parse a Playwright JSON report and extract accessibility-related test data.
 */
export function parseA11yResults(reportPath: string): A11yReport {
  if (!fs.existsSync(reportPath)) {
    throw new Error(
      `Playwright JSON report not found at ${reportPath}. ` +
      `Ensure the JSON reporter is enabled (it is included by default in definePlaywrightDrupalConfig CI mode).`
    )
  }

  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'))
  const tests: A11yTestResult[] = []
  let totalViolations = 0
  let totalBaselined = 0
  let totalStale = 0

  walkSuites(report.suites ?? [], '', tests)

  for (const test of tests) {
    for (const ann of test.annotations) {
      if (ann.type === 'Baselined a11y violation') totalBaselined++
      if (ann.type === 'Stale a11y baseline entry') totalStale++
    }
    totalViolations += test.violations.length
  }

  return { tests, totalViolations, totalBaselined, totalStale }
}

/**
 * Collect annotations from both test and result levels. Playwright stores
 * annotations declared at test definition time on `test.annotations`, and
 * annotations added during execution (e.g. `testInfo.annotations.push()`)
 * on `result.annotations`. checkAccessibility() uses the latter.
 */
function collectAnnotations(test: any, lastResult: any): any[] {
  return [
    ...(test.annotations ?? []),
    ...(lastResult?.annotations ?? []),
  ]
}

/** Read and parse the WCAG scan attachment, if present. */
function parseWcagViolations(attachment: any): NormalizedViolation[] {
  if (!attachment) return []
  try {
    const raw = attachment.body
      ? Buffer.from(attachment.body, 'base64').toString('utf8')
      : attachment.path
        ? fs.readFileSync(attachment.path, 'utf8')
        : null
    if (!raw) return []
    const json = JSON.parse(raw)
    if (!json?.violations) return []
    return json.violations.map((v: any) => ({
      rule: v.id,
      impact: v.impact ?? 'unknown',
      description: v.description,
      helpUrl: v.helpUrl,
      targets: v.nodes
        ?.flatMap((n: any) => n.target)
        .filter((t: any) => typeof t === 'string') ?? [],
    }))
  } catch {
    // Parse errors are non-fatal — we'll just report without violation details.
    return []
  }
}

/**
 * Read the bytes of an attachment, whether stored inline as a base64 `body`
 * (the typical shape for `testInfo.attach({ body })`) or as a `path` pointing
 * to a file on disk. Returns undefined if neither form is usable.
 */
function readAttachmentBytes(attachment: any): Buffer | undefined {
  if (!attachment) return undefined
  try {
    if (attachment.body) {
      return Buffer.from(attachment.body, 'base64')
    }
    if (attachment.path) {
      return fs.readFileSync(attachment.path)
    }
  } catch {
    // Fall through — missing file or decoding error means no screenshot.
  }
  return undefined
}

/** Extract an A11yTestResult from a Playwright test, or null if not a11y-related. */
function extractTestResult(spec: any, test: any, file: string): A11yTestResult | null {
  const lastResult = test.results?.[test.results.length - 1]
  const attachments = lastResult?.attachments ?? []

  const a11yAnnotations = collectAnnotations(test, lastResult)
    .filter((a: any) => A11Y_ANNOTATION_TYPES.has(a.type))

  if (a11yAnnotations.length === 0) return null

  const violations = parseWcagViolations(
    attachments.find((a: any) => a.name === 'a11y-wcag-scan-results'),
  )

  const screenshot = readAttachmentBytes(
    attachments.find((a: any) => a.name === 'a11y-violation-screenshot'),
  )

  return {
    title: spec.title,
    file,
    line: spec.line ?? 1,
    annotations: a11yAnnotations,
    violations,
    screenshot,
  }
}

function walkSuites(
  suites: any[],
  parentFile: string,
  out: A11yTestResult[],
) {
  for (const suite of suites) {
    const file = suite.file || parentFile

    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests ?? []) {
        const result = extractTestResult(spec, test, file)
        if (result) out.push(result)
      }
    }

    if (suite.suites) {
      walkSuites(suite.suites, file, out)
    }
  }
}

/** Headline with pass/fail counts. */
function renderHeadline(report: A11yReport): string {
  const hasViolations = report.totalViolations > 0
  const hasBaselined = report.totalBaselined > 0
  const hasStale = report.totalStale > 0

  if (!hasViolations && !hasBaselined && !hasStale) {
    return ':white_check_mark: All accessibility checks passed.\n'
  }

  const parts: string[] = []
  if (hasViolations) parts.push(`**${report.totalViolations}** violation(s)`)
  if (hasBaselined) parts.push(`**${report.totalBaselined}** baselined`)
  if (hasStale) parts.push(`**${report.totalStale}** stale baseline entries`)
  return parts.join(' · ') + '\n'
}

/** Icon for an `Accessibility` annotation based on its violation count. */
function iconForAccessibilityAnnotation(description: string): string {
  // Descriptions look like "WCAG scan: 0 violations ..." or "WCAG scan: 3 violations ...".
  const colonIdx = description.lastIndexOf(': ')
  const afterColon = colonIdx >= 0 ? description.substring(colonIdx + 2) : description
  const violationCount = parseInt(afterColon, 10)
  return violationCount > 0 ? ':x:' : ':white_check_mark:'
}

function iconForAnnotation(ann: { type: string; description?: string }): string {
  switch (ann.type) {
    case 'Baselined a11y violation':
      return ':white_check_mark:'
    case 'Stale a11y baseline entry':
      return ':warning:'
    case 'Accessibility':
      return iconForAccessibilityAnnotation(ann.description ?? '')
    default:
      return ':information_source:'
  }
}

/** Render annotation lines, deduplicated by type+description. */
function renderAnnotations(
  annotations: Array<{ type: string; description?: string }>,
): string[] {
  const lines: string[] = []
  const seen = new Set<string>()
  for (const ann of annotations) {
    const key = `${ann.type}:${ann.description ?? ''}`
    if (seen.has(key)) continue
    seen.add(key)
    lines.push(`${iconForAnnotation(ann)} **${ann.type}**: ${ann.description ?? ''}\n`)
  }
  return lines
}

/** Render the violation table for a single test. */
function renderViolationTable(violations: NormalizedViolation[]): string[] {
  if (violations.length === 0) return []
  const lines: string[] = [
    '| Rule | Impact | Description | Targets |',
    '|------|--------|-------------|---------|',
  ]
  for (const v of violations) {
    const shown = v.targets.slice(0, 3).map(escapeMarkdownCodeSpan).join(', ')
    const targets = v.targets.length > 3
      ? `${shown}, +${v.targets.length - 3} more`
      : shown
    const rule = escapeMarkdownTableCell(v.rule)
    const impact = escapeMarkdownTableCell(v.impact)
    const description = escapeMarkdownTableCell(v.description)
    lines.push(`| [${rule}](${v.helpUrl}) | ${impact} | ${description} | ${targets} |`)
  }
  lines.push('')
  return lines
}

/**
 * Detect the MIME type of an image from its first few bytes so the data URL
 * is tagged correctly. Defaults to `image/png` — the format
 * checkAccessibility() produces — when the signature isn't recognized.
 */
function detectImageMime(bytes: Buffer): string {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return 'image/png'
  }
  if (
    bytes.length >= 12 &&
    bytes.toString('ascii', 0, 4) === 'RIFF' &&
    bytes.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'image/webp'
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg'
  }
  return 'image/png'
}

/**
 * Attempt to shrink a screenshot with ImageMagick: resize to at most 1 200 px
 * wide and re-encode as JPEG at quality 75. This is intentionally best-effort
 * — if `convert` is unavailable or fails the original bytes are returned
 * unchanged so callers always get usable output.
 *
 * The optimised JPEG is only returned when it is smaller than the input;
 * otherwise the original bytes are returned.
 */
function optimizeScreenshot(bytes: Buffer): Buffer {
  let tmpDir: string | undefined
  try {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'a11y-screenshot-'))
    const inputPath = path.join(tmpDir, 'input.png')
    const outputPath = path.join(tmpDir, 'output.jpg')
    fs.writeFileSync(inputPath, bytes)

    const result = spawnSync('convert', [
      inputPath,
      '-resize', '1200x>',  // Shrink to max 1 200 px wide; never upscale.
      '-strip',              // Strip metadata (EXIF, ICC profiles, comments).
      '-quality', '75',
      outputPath,
    ], { timeout: 15_000 })

    if (result.status === 0 && fs.existsSync(outputPath)) {
      const optimized = fs.readFileSync(outputPath)
      // Prefer the optimised version only when it is genuinely smaller.
      return optimized.length < bytes.length ? optimized : bytes
    }
  } catch {
    // ImageMagick not installed or conversion failed — use original bytes.
  } finally {
    if (tmpDir) {
      try { fs.rmSync(tmpDir, { recursive: true }) } catch { /* best-effort */ }
    }
  }
  return bytes
}

/**
 * Render a violation screenshot as an inline base64 image.
 *
 * Attempts to optimise the image with ImageMagick before embedding. Returns
 * null if the buffer is still larger than MAX_SCREENSHOT_BYTES after
 * optimisation — users can still see the screenshot in the Playwright HTML
 * report.
 */
function renderScreenshot(screenshot: Buffer): string[] | null {
  const optimized = optimizeScreenshot(screenshot)
  if (optimized.length > MAX_SCREENSHOT_BYTES) return null
  const mime = detectImageMime(optimized)
  const b64 = optimized.toString('base64')
  return [
    '<details>',
    '<summary>Violation screenshot</summary>\n',
    `<img src="data:${mime};base64,${b64}" alt="Accessibility violations highlighted on page" />\n`,
    '</details>\n',
  ]
}

/** Sum the byte length of lines joined with newlines. */
function byteSize(lines: string[]): number {
  let total = 0
  for (const line of lines) {
    total += Buffer.byteLength(line, 'utf8') + 1 // +1 for the newline separator
  }
  return total
}

/**
 * Generate Markdown for $GITHUB_STEP_SUMMARY.
 */
export function generateSummary(report: A11yReport): string {
  if (report.tests.length === 0) {
    return '## Accessibility Results\n\nNo accessibility tests were found in the report.\n'
  }

  const lines: string[] = ['## Accessibility Results\n', renderHeadline(report)]

  let screenshotCount = 0
  let omittedScreenshots = 0
  const seenTitles = new Set<string>()

  for (const test of report.tests) {
    const testAnnotations = test.annotations.filter(a => a.type !== '@a11y')
    const hasTestViolations = test.violations.length > 0
    if (testAnnotations.length === 0 && !hasTestViolations) continue

    // Skip duplicate test titles (different browsers report the same spec).
    if (seenTitles.has(test.title)) continue
    seenTitles.add(test.title)

    const testLines: string[] = [`### ${test.title}\n`]
    testLines.push(...renderAnnotations(testAnnotations))
    testLines.push(...renderViolationTable(test.violations))

    // Embed the violation screenshot if it fits within per-shot, per-count,
    // and total-summary budgets.
    if (test.screenshot) {
      if (screenshotCount >= MAX_SCREENSHOTS) {
        omittedScreenshots++
      } else {
        const shot = renderScreenshot(test.screenshot)
        if (!shot) {
          omittedScreenshots++
        } else if (byteSize(lines) + byteSize(testLines) + byteSize(shot) > MAX_SUMMARY_BYTES) {
          omittedScreenshots++
        } else {
          testLines.push(...shot)
          screenshotCount++
        }
      }
    }

    lines.push(...testLines)
  }

  if (omittedScreenshots > 0) {
    lines.push(
      `> ${omittedScreenshots} violation screenshot(s) omitted (exceed size or count limits). ` +
      `See the Playwright HTML report for full details.\n`,
    )
  }

  return lines.join('\n')
}

/**
 * Generate GitHub Actions annotation commands (::error, ::warning).
 *
 * All interpolated values are escaped — CSS selectors from axe-core targets
 * are extracted from page DOM and could contain newlines or `%` sequences
 * that would otherwise let a crafted page forge additional workflow commands.
 */
export function generateAnnotations(report: A11yReport): string {
  const lines: string[] = []

  for (const test of report.tests) {
    const file = escapeWorkflowCommandProperty(test.file)
    const line = escapeWorkflowCommandProperty(String(test.line))

    // Emit ::error for each violation.
    for (const v of test.violations) {
      const targets = v.targets.slice(0, 3).join(', ')
      const title = escapeWorkflowCommandProperty(`${v.rule} (${v.impact})`)
      const msg = escapeWorkflowCommand(
        `a11y: ${v.rule} (${v.impact}) — ${v.description}. Targets: ${targets}`,
      )
      lines.push(`::error file=${file},line=${line},title=${title}::${msg}`)
    }

    // Emit ::warning for stale baseline entries.
    for (const ann of test.annotations) {
      if (ann.type === 'Stale a11y baseline entry') {
        const title = escapeWorkflowCommandProperty('Stale a11y baseline')
        const msg = escapeWorkflowCommand(ann.description ?? '')
        lines.push(`::warning file=${file},line=${line},title=${title}::${msg}`)
      }
    }
  }

  return lines.join('\n')
}

/**
 * CLI entry point. Called automatically when this file is run directly
 * (e.g. `node lib/github/a11y-summary.js`), or can be imported and
 * called from the bin wrapper.
 */
export function main(args: string[] = process.argv.slice(2)): void {
  let mode = 'summary'
  let reportPath = 'test-results/results.json'

  for (const arg of args) {
    if (arg.startsWith('--mode=')) mode = arg.slice('--mode='.length)
    if (arg.startsWith('--report-path=')) reportPath = arg.slice('--report-path='.length)
  }

  const validModes = new Set(['summary', 'annotations'])
  if (!validModes.has(mode)) {
    console.error(`Unknown mode: ${mode}. Use summary or annotations.`)
    process.exit(2)
  }

  // Resolve relative to cwd.
  const resolvedPath = path.resolve(reportPath)

  // Missing reports are intentionally non-fatal — the JSON report may be
  // absent if no tests ran. Any other failure (parse error, permissions, etc.)
  // should propagate so CI surfaces the real problem instead of silently
  // reporting zero violations.
  if (!fs.existsSync(resolvedPath)) {
    console.error(
      `Playwright JSON report not found at ${resolvedPath} — skipping a11y summary.`,
    )
    return
  }

  const report = parseA11yResults(resolvedPath)

  switch (mode) {
    case 'summary': {
      const md = generateSummary(report)
      const summaryFile = process.env.GITHUB_STEP_SUMMARY
      if (summaryFile) {
        fs.appendFileSync(summaryFile, md)
        console.log('Accessibility summary written to $GITHUB_STEP_SUMMARY')
      } else {
        // Not in GitHub Actions — just print.
        process.stdout.write(md)
      }
      break
    }
    case 'annotations': {
      const output = generateAnnotations(report)
      if (output) process.stdout.write(output + '\n')
      break
    }
  }
}

// Auto-invoke when run directly (node lib/github/a11y-summary.js).
if (require.main === module) {
  main()
}
