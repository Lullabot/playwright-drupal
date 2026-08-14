import * as fs from 'fs'
import * as path from 'path'
import { AttachmentUploader, AttachmentUploaderOptions } from './attachments'

/**
 * Turn a Playwright JSON report into a job summary — and optionally a PR
 * comment body — with the failure screenshots embedded inline.
 *
 * Playwright already captures everything worth looking at: `toHaveScreenshot`
 * attaches `-expected`/`-actual`/`-diff` images when a comparison fails, and
 * checkAccessibility() attaches a full-page screenshot with the violating
 * elements outlined. Both normally end up zipped inside an artifact nobody
 * downloads. Given an upload token they can be embedded where the failure is
 * actually read.
 *
 * Without a token this still produces a useful text summary, so the feature
 * degrades rather than disappearing.
 */

/** Attachment names Playwright gives the three snapshot comparison images. */
const SNAPSHOT_SUFFIXES: Array<{ suffix: string; kind: ImageKind }> = [
  { suffix: '-diff', kind: 'diff' },
  { suffix: '-actual', kind: 'actual' },
  { suffix: '-expected', kind: 'expected' },
  { suffix: '-previous', kind: 'previous' },
]

/** Attachment name used by checkAccessibility() for its highlighted screenshot. */
const A11Y_SCREENSHOT = 'a11y-violation-screenshot'

export type ImageKind = 'diff' | 'actual' | 'expected' | 'previous' | 'a11y' | 'screenshot'

export interface FailureImage {
  /** Attachment name as it appears in the report. */
  name: string
  /** Path on disk. Attachments the reporter inlined have none. */
  filePath?: string
  /**
   * Base64 bytes, for attachments added with `testInfo.attach({ body })`. The
   * JSON reporter inlines those rather than writing them out, which is how the
   * accessibility screenshots arrive.
   */
  body?: string
  contentType: string
  kind: ImageKind
  /** Populated once the image has been uploaded. */
  url?: string
}

export interface FailedTest {
  title: string
  file: string
  line: number
  /** Playwright result status, e.g. `failed` or `timedOut`. */
  status: string
  /** First error message, trimmed to something a comment can carry. */
  error?: string
  images: FailureImage[]
}

export interface FailureReport {
  tests: FailedTest[]
  totalFailed: number
  totalImages: number
}

/** Which snapshot images to include. `diff` is the one that shows the problem. */
export type IncludeMode = 'diff' | 'all'

/**
 * Prefix of the HTML comment carrying the failure count in a generated comment
 * body. Invisible when rendered, and greppable by a workflow that has to decide
 * whether the run is worth commenting on.
 */
export const FAILURE_MARKER_PREFIX = '<!-- playwright-drupal-failures: '

/**
 * Neutralise text that the Actions runner would redact.
 *
 * Job summaries pass through the runner's secret masking (comments posted over
 * the API do not). The masker replaces `Bearer <value>` with `***` and takes
 * the following characters with it, so a test name or error containing the
 * word can silently swallow the Markdown that follows it. A zero-width space
 * inside the word reads identically and no longer matches.
 */
export function defuseMaskTriggers(text: string): string {
  return text.replace(/Bearer(?=\s)/g, 'Bear\u200Ber')
}

/** Strip ANSI colour codes Playwright puts in error messages. */
function stripAnsi(text: string): string {
  return text.replace(/\u001b\[[0-9;]*m/g, '')
}

function classifyAttachment(name: string, contentType: string): ImageKind | null {
  if (!contentType.startsWith('image/')) return null
  if (name === A11Y_SCREENSHOT) return 'a11y'

  const withoutExtension = name.replace(/\.[^.]+$/, '')
  for (const { suffix, kind } of SNAPSHOT_SUFFIXES) {
    if (withoutExtension.endsWith(suffix)) return kind
  }
  return 'screenshot'
}

/**
 * Collect the images worth showing for one test result.
 *
 * Accessibility screenshots are kept even when the test passed, because a
 * baselined violation still passes and its screenshot is still the thing you
 * want to look at.
 */
function collectImages(attachments: any[], include: IncludeMode): FailureImage[] {
  const images: FailureImage[] = []

  for (const attachment of attachments) {
    const name = String(attachment?.name ?? '')
    const contentType = String(attachment?.contentType ?? '')
    const kind = classifyAttachment(name, contentType)
    if (!kind) continue

    // Uploading three near-identical images per failure is rarely worth it;
    // the diff is the one that shows what changed.
    if (include === 'diff' && (kind === 'expected' || kind === 'actual' || kind === 'previous')) {
      continue
    }

    images.push({
      name,
      filePath: attachment?.path ? String(attachment.path) : undefined,
      body: attachment?.body ? String(attachment.body) : undefined,
      contentType,
      kind,
    })
  }

  return images
}

function firstError(result: any): string | undefined {
  const message = result?.error?.message ?? result?.errors?.[0]?.message
  if (typeof message !== 'string' || !message.trim()) return undefined
  const cleaned = stripAnsi(message).trim().split('\n')[0]
  return cleaned.length > 300 ? `${cleaned.slice(0, 300)}…` : cleaned
}

function walkSuites(suites: any[], parentFile: string, include: IncludeMode, out: FailedTest[]): void {
  for (const suite of suites ?? []) {
    const file = suite.file || parentFile

    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests ?? []) {
        const result = test.results?.[test.results.length - 1]
        if (!result) continue

        const images = collectImages(result.attachments ?? [], include)
        const failed = result.status !== 'passed' && result.status !== 'skipped'
        const hasA11yImage = images.some(image => image.kind === 'a11y')
        if (!failed && !hasA11yImage) continue

        out.push({
          title: spec.title,
          file,
          line: spec.line ?? 1,
          status: String(result.status ?? 'unknown'),
          error: firstError(result),
          images,
        })
      }
    }

    walkSuites(suite.suites ?? [], file, include, out)
  }
}

/**
 * Parse a Playwright JSON report into the failures worth reporting.
 */
export function parseFailures(reportPath: string, include: IncludeMode = 'diff'): FailureReport {
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'))
  const tests: FailedTest[] = []
  walkSuites(report.suites ?? [], '', include, tests)

  const totalFailed = tests.filter(test => test.status !== 'passed' && test.status !== 'skipped').length
  const totalImages = tests.reduce((sum, test) => sum + test.images.length, 0)

  return { tests, totalFailed, totalImages }
}

/**
 * Upload every collected image, annotating each one with its URL. Images the
 * uploader declines are simply left without a URL, which the renderers treat
 * as "link to the artifact instead".
 */
export async function uploadImages(
  report: FailureReport,
  uploader: AttachmentUploader,
): Promise<void> {
  for (const test of report.tests) {
    for (const image of test.images) {
      let url: string | null = null

      if (image.filePath) {
        url = await uploader.upload(image.filePath, path.basename(image.filePath))
      } else if (image.body) {
        url = await uploader.uploadBuffer(
          Buffer.from(image.body, 'base64'),
          `${image.name}${extensionFor(image.contentType)}`,
          image.contentType,
        )
      }

      if (url) image.url = url
    }
  }
}

/** Inlined attachments carry no file name, so derive one from the content type. */
function extensionFor(contentType: string): string {
  if (contentType === 'image/png') return '.png'
  if (contentType === 'image/jpeg') return '.jpg'
  if (contentType === 'image/gif') return '.gif'
  if (contentType === 'image/webp') return '.webp'
  return ''
}

function headline(report: FailureReport): string {
  if (report.tests.length === 0) return ':white_check_mark: No failing tests with screenshots.'

  // Nothing failed, but an accessibility check still captured something worth
  // seeing — a baselined violation passes and is still screenshotted.
  const parts = report.totalFailed === 0
    ? [':white_check_mark: No failing tests']
    : [`**${report.totalFailed}** failing test(s)`]

  if (report.totalImages > 0) parts.push(`**${report.totalImages}** screenshot(s)`)
  return parts.join(' · ')
}

/**
 * Render the job summary: a heading, a headline, and one collapsed block per
 * test holding its images.
 *
 * Deliberately table-free. Test titles and error messages are arbitrary text,
 * and the runner's masking can eat a cell delimiter and corrupt a whole row.
 */
export function generateSummary(report: FailureReport, options: { artifactHint?: string } = {}): string {
  // A baselined accessibility violation is screenshotted without failing
  // anything, so a green run can still have something to show here.
  const heading = report.totalFailed > 0 ? '## Test Failures' : '## Test Screenshots'
  const lines: string[] = [`${heading}\n`, `${headline(report)}\n`]

  if (report.tests.length === 0) return lines.join('\n')

  for (const test of report.tests) {
    const title = defuseMaskTriggers(test.title)
    lines.push(`### ${title}\n`)
    lines.push(`\`${test.file}:${test.line}\` — ${test.status}\n`)

    if (test.error) {
      lines.push(`> ${defuseMaskTriggers(test.error)}\n`)
    }

    if (test.images.length === 0) continue

    lines.push('<details>')
    lines.push(`<summary>Screenshots (${test.images.length})</summary>\n`)

    const embedded = test.images.filter(image => image.url)
    if (embedded.length === 0) {
      const hint = options.artifactHint ?? 'the Playwright report artifact'
      lines.push(`Images were not uploaded — download ${hint} to view them.\n`)
    }

    for (const image of embedded) {
      lines.push(`**${image.kind}**\n`)
      const src = escapeAttribute(image.url ?? '')
      lines.push(`<img src="${src}" alt="${image.kind} for ${escapeAttribute(title)}" width="640">\n`)
    }

    lines.push('</details>\n')
  }

  return lines.join('\n')
}

/**
 * Render a short PR comment. It carries counts and a link rather than the
 * images themselves: emailed notifications render once, and the signed image
 * URLs expire minutes later, so an inline image in a comment is a broken image
 * in everyone's inbox.
 */
export function generateComment(
  report: FailureReport,
  options: { summaryUrl?: string; title?: string } = {},
): string {
  const heading = options.title ?? 'Playwright results'
  const lines: string[] = [`### ${heading}\n`, `${headline(report)}\n`]

  if (report.tests.length > 0) {
    for (const test of report.tests.slice(0, 10)) {
      const images = test.images.length > 0 ? ` — ${test.images.length} screenshot(s)` : ''
      lines.push(`- \`${test.status}\` ${defuseMaskTriggers(test.title)}${images}`)
    }
    if (report.tests.length > 10) {
      lines.push(`- …and ${report.tests.length - 10} more`)
    }
    lines.push('')
  }

  if (options.summaryUrl) {
    lines.push(`[View the screenshots in the job summary](${options.summaryUrl})\n`)
  }

  // A machine-readable count, so a workflow assembling several of these can
  // decide whether to post at all without grepping prose — the empty-state
  // sentence contains the words "failing test" too.
  lines.push(`${FAILURE_MARKER_PREFIX}${report.totalFailed} -->\n`)
  lines.push(renderBindingBlock(report))

  return lines.join('\n')
}

/**
 * Reference every uploaded image in an HTML comment.
 *
 * An uploaded attachment does not render in a job summary until it has been
 * referenced from real content — an issue or pull request body. Naming the URLs
 * here does that without showing the images, which is deliberate: notification
 * emails are rendered once when they are sent, and the signed URLs GitHub
 * generates expire minutes later, so a visible image here is a broken image in
 * everyone's inbox.
 */
function renderBindingBlock(report: FailureReport): string {
  const urls = report.tests
    .flatMap(test => test.images)
    .map(image => image.url)
    // A URL containing `--` would close the comment early. None do, but the
    // consequence of being wrong is a mangled comment.
    .filter((url): url is string => Boolean(url) && !url!.includes('--'))

  if (urls.length === 0) return ''

  return [
    '<!--',
    'Referencing the uploaded screenshots so they render in the job summary.',
    'They are not shown here on purpose: emailed notifications render once, and',
    'these URLs expire minutes after that.',
    ...urls,
    '-->',
    '',
  ].join('\n')
}

function escapeAttribute(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
}

interface CliOptions {
  reportPath: string
  commentPath?: string
  include: IncludeMode
  maxUploads?: number
  title?: string
}

function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = {
    reportPath: 'test-results/results.json',
    include: 'diff',
  }

  for (const arg of args) {
    if (arg.startsWith('--report-path=')) options.reportPath = arg.slice('--report-path='.length)
    if (arg.startsWith('--comment-path=')) options.commentPath = arg.slice('--comment-path='.length)
    if (arg.startsWith('--title=')) options.title = arg.slice('--title='.length)
    if (arg.startsWith('--include=')) {
      const value = arg.slice('--include='.length)
      options.include = value === 'all' ? 'all' : 'diff'
    }
    if (arg.startsWith('--max-uploads=')) {
      const value = Number.parseInt(arg.slice('--max-uploads='.length), 10)
      if (Number.isFinite(value) && value >= 0) options.maxUploads = value
    }
  }

  return options
}

/** Build the run's job summary URL, which is the best anchor a comment can link to. */
function summaryUrl(): string | undefined {
  const { GITHUB_SERVER_URL, GITHUB_REPOSITORY, GITHUB_RUN_ID } = process.env
  if (!GITHUB_SERVER_URL || !GITHUB_REPOSITORY || !GITHUB_RUN_ID) return undefined
  return `${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}`
}

export function uploaderFromEnvironment(
  overrides: AttachmentUploaderOptions = {},
): AttachmentUploader {
  return new AttachmentUploader({
    token: process.env.SCREENSHOT_GITHUB_TOKEN,
    repositoryId: process.env.GITHUB_REPOSITORY_ID,
    log: message => console.error(message),
    ...overrides,
  })
}

/**
 * CLI entry point. Runs once and writes both outputs, so images are never
 * uploaded twice for the same run.
 */
export async function main(args: string[] = process.argv.slice(2)): Promise<void> {
  const options = parseArgs(args)
  const resolvedPath = path.resolve(options.reportPath)

  // A missing report is not an error: the suite may not have run at all.
  if (!fs.existsSync(resolvedPath)) {
    console.error(`Playwright JSON report not found at ${resolvedPath} — skipping failure summary.`)
    return
  }

  const report = parseFailures(resolvedPath, options.include)

  const uploader = uploaderFromEnvironment(
    options.maxUploads === undefined ? {} : { maxUploads: options.maxUploads },
  )
  if (uploader.enabled) {
    await uploadImages(report, uploader)
    const stats = uploader.getStats()
    console.error(`Uploaded ${stats.uploaded} screenshot(s), skipped ${stats.skipped}.`)
    if (uploader.disabledReason) {
      console.error(`Uploads stopped early — ${uploader.disabledReason}.`)
    }
  } else {
    console.error(`Screenshot uploads are off — ${uploader.disabledReason}.`)
  }

  const summary = generateSummary(report)
  const summaryFile = process.env.GITHUB_STEP_SUMMARY
  if (summaryFile) {
    fs.appendFileSync(summaryFile, summary)
    console.error('Failure summary written to $GITHUB_STEP_SUMMARY')
  } else {
    process.stdout.write(summary)
  }

  if (options.commentPath) {
    const comment = generateComment(report, { summaryUrl: summaryUrl(), title: options.title })
    fs.writeFileSync(path.resolve(options.commentPath), comment)
    console.error(`Comment body written to ${options.commentPath}`)
  }
}

// Auto-invoke when run directly (node lib/github/failure-summary.js).
if (require.main === module) {
  main().catch((error: unknown) => {
    console.error(error)
    process.exit(1)
  })
}
