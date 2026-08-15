import * as fs from 'fs'
import * as path from 'path'
import { AttachmentUploader, AttachmentUploaderOptions } from './attachments'
import { PathPrefix, PathResolution, createPathResolver, parsePathPrefix } from './report-paths'

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
  /**
   * Set when the recorded path could not be found on this side of a container
   * boundary. Distinguishes "there was nothing to upload with" from "there was
   * nowhere to upload to", which otherwise render identically.
   */
  unreadable?: boolean
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

/** What re-rooting the report's attachment paths achieved. */
export interface PathResolutionSummary {
  /** Attachments whose recorded path had to be rewritten to be readable. */
  remapped: number
  /** The mappings that were used, for the log line. */
  used: PathPrefix[]
  /** Recorded paths with no readable file behind them, on either side. */
  unreadable: string[]
}

/**
 * Point every image at a file this process can open, and note the ones where
 * that was not possible.
 *
 * Runs whether or not uploads are switched on: an unreachable attachment is
 * worth reporting even on a fork build that was never going to upload it,
 * because it is the same misconfiguration either way.
 */
export function resolveImagePaths(
  report: FailureReport,
  resolve: (filePath: string) => PathResolution,
): PathResolutionSummary {
  const summary: PathResolutionSummary = { remapped: 0, used: [], unreadable: [] }

  for (const test of report.tests) {
    for (const image of test.images) {
      if (!image.filePath) continue

      const resolution = resolve(image.filePath)
      if (!resolution.found) {
        image.unreadable = true
        summary.unreadable.push(image.filePath)
        continue
      }

      if (resolution.path === image.filePath) continue

      summary.remapped++
      image.filePath = resolution.path

      const prefix = resolution.prefix
      if (prefix && !summary.used.some(used => used.from === prefix.from && used.to === prefix.to)) {
        summary.used.push(prefix)
      }
    }
  }

  return summary
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
        // resolveImagePaths() has already checked the file is there, so a null
        // from an uploader that is still running means the read itself failed.
        if (!url && uploader.enabled) image.unreadable = true
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

/** Every image across every test, which is what the diagnostics count. */
function allImages(report: FailureReport): FailureImage[] {
  return report.tests.flatMap(test => test.images)
}

/**
 * Say why a set of images was not uploaded, or nothing when they were.
 *
 * "No token" and "the files were not where the report said" are different
 * problems with different fixes, and until they are named apart a reader has
 * no way to tell which one they have. An absent token is the dominant reason
 * when it applies: nothing was going to be uploaded regardless.
 */
function missingImageReason(images: FailureImage[], uploadReason?: string): string | undefined {
  if (uploadReason) return uploadReason

  const unreadable = images.filter(image => image.unreadable).length
  if (unreadable === 0) return undefined

  return `${unreadable} could not be read from the path recorded in the report`
}

export interface SummaryOptions {
  artifactHint?: string
  /**
   * Why uploading did not happen at all, phrased to sit inside a sentence —
   * `no upload token configured`, say. Leave unset when uploads ran.
   */
  uploadReason?: string
}

/**
 * Render the job summary: a heading, a headline, and one collapsed block per
 * test holding its images.
 *
 * Deliberately table-free. Test titles and error messages are arbitrary text,
 * and the runner's masking can eat a cell delimiter and corrupt a whole row.
 */
export function generateSummary(report: FailureReport, options: SummaryOptions = {}): string {
  // A baselined accessibility violation is screenshotted without failing
  // anything, so a green run can still have something to show here.
  const heading = report.totalFailed > 0 ? '## Test Failures' : '## Test Screenshots'
  const lines: string[] = [`${heading}\n`, `${headline(report)}\n`]

  if (report.tests.length === 0) return lines.join('\n')

  // Name the path boundary where it will be read, rather than leaving the
  // reader to conclude they forgot the token.
  const unreadable = allImages(report).filter(image => image.unreadable)
  if (unreadable.length > 0) {
    const example = defuseMaskTriggers(unreadable[0].filePath ?? '')
    lines.push(
      `> :warning: **${unreadable.length} screenshot(s) could not be read.** The report records them ` +
      `under \`${example}\`, which does not exist where this step ran. Playwright ran somewhere else — ` +
      'a container, most likely — so run this command there too, or pass ' +
      '`--path-prefix=CONTAINER_PATH:LOCAL_PATH` to map one onto the other.\n',
    )
  }

  for (const test of report.tests) {
    const title = defuseMaskTriggers(test.title)
    lines.push(`### ${title}\n`)
    lines.push(`\`${test.file}:${test.line}\` — ${test.status}\n`)

    if (test.error) {
      lines.push(`> ${defuseMaskTriggers(test.error)}\n`)
    }

    if (test.images.length === 0) continue

    // The images go in the pull request comment, not here. A job summary is
    // rendered once, when the job finishes, and an attachment uploaded seconds
    // earlier is not resolvable yet — so it renders as a dead link and the
    // cached result never improves, however often the page is reloaded.
    const embedded = test.images.filter(image => image.url).length
    if (embedded > 0) {
      lines.push(`${embedded} screenshot(s) uploaded — see the pull request comment.\n`)
    } else {
      const hint = options.artifactHint ?? 'the Playwright report artifact'
      const reason = missingImageReason(test.images, options.uploadReason)
      const because = reason ? ` (${reason})` : ''
      lines.push(`${test.images.length} screenshot(s) captured, not uploaded${because} — download ${hint}.\n`)
    }
  }

  return lines.join('\n')
}

/** A collapsed block of images for one test, used in the comment. */
function renderImageBlock(test: FailedTest): string[] {
  const embedded = test.images.filter(image => image.url)
  if (embedded.length === 0) return []

  const title = defuseMaskTriggers(test.title)
  const lines = ['<details>', `<summary>Screenshots (${embedded.length})</summary>\n`]

  for (const image of embedded) {
    lines.push(`**${image.kind}**\n`)
    const src = escapeAttribute(image.url ?? '')
    lines.push(`<img src="${src}" alt="${image.kind} for ${escapeAttribute(title)}" width="640">\n`)
  }

  lines.push('</details>\n')
  return lines
}

/**
 * Render the pull request comment. This is where the screenshots go.
 *
 * A comment is rendered afresh every time it is read, so an attachment resolves
 * however recently it was uploaded. A job summary is rendered once when the job
 * ends, before a just-uploaded attachment is resolvable, and that result is
 * what everyone sees from then on.
 *
 * The cost is emailed notifications: those are rendered once when sent, and the
 * signed URLs behind these images expire minutes later, so the images will be
 * broken in the email even though they are fine on the web.
 */
export function generateComment(
  report: FailureReport,
  options: { summaryUrl?: string; title?: string; uploadReason?: string } = {},
): string {
  const heading = options.title ?? 'Playwright results'
  const lines: string[] = [`### ${heading}\n`, `${headline(report)}\n`]

  if (report.tests.length > 0) {
    for (const test of report.tests.slice(0, 10)) {
      const title = defuseMaskTriggers(test.title)
      const images = test.images.length > 0 ? ` — ${test.images.length} screenshot(s)` : ''
      lines.push(`- \`${test.status}\` ${title}${images}`)
    }
    if (report.tests.length > 10) {
      lines.push(`- …and ${report.tests.length - 10} more`)
    }
    lines.push('')

    for (const test of report.tests) {
      const block = renderImageBlock(test)
      if (block.length === 0) continue
      lines.push(`**${defuseMaskTriggers(test.title)}**\n`)
      lines.push(...block)
    }

    // An empty comment where images were expected reads as a broken feature.
    // Whatever the reason, it belongs where the images would have been.
    const missing = allImages(report).filter(image => !image.url)
    const reason = missingImageReason(missing, options.uploadReason)
    if (missing.length > 0 && reason) {
      lines.push(`_${missing.length} screenshot(s) not shown — ${reason}._\n`)
    }
  }

  if (options.summaryUrl) {
    lines.push(`[Full run](${options.summaryUrl})\n`)
  }

  // A machine-readable count, so a workflow assembling several of these can
  // decide whether to post at all without grepping prose — the empty-state
  // sentence contains the words "failing test" too.
  lines.push(`${FAILURE_MARKER_PREFIX}${report.totalFailed} -->\n`)

  return lines.join('\n')
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
  pathPrefixes: PathPrefix[]
}

function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = {
    reportPath: 'test-results/results.json',
    include: 'diff',
    pathPrefixes: [],
  }

  for (const arg of args) {
    // Repeatable: a project can have more than one mount to translate.
    if (arg.startsWith('--path-prefix=')) {
      const prefix = parsePathPrefix(arg.slice('--path-prefix='.length))
      if (prefix) {
        options.pathPrefixes.push(prefix)
      } else {
        console.error(`Ignoring --path-prefix: expected FROM:TO, got ${arg.slice('--path-prefix='.length)}`)
      }
    }
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

/**
 * Raise a warning where someone will see it.
 *
 * A `::warning::` command has to go to stdout for the runner to pick it up,
 * which is only safe once the summary itself is going to a file — otherwise it
 * would land in the middle of the Markdown. Outside Actions, or when the
 * summary is on stdout, stderr is the only sensible place.
 */
function warn(message: string): void {
  const inActions = process.env.GITHUB_ACTIONS === 'true' && !!process.env.GITHUB_STEP_SUMMARY
  if (inActions) {
    process.stdout.write(`::warning title=Playwright screenshots::${escapeAnnotation(message)}\n`)
  } else {
    console.error(`Warning: ${message}`)
  }
}

/** Workflow commands are line-based, so anything that ends a line is encoded. */
function escapeAnnotation(message: string): string {
  return message.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A')
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

  // The report records where the run wrote its attachments, which is not
  // necessarily anywhere this process can reach. Settle that before uploading,
  // so an unreachable file is reported as one rather than as a silent skip.
  const paths = resolveImagePaths(
    report,
    createPathResolver({ reportPath: resolvedPath, prefixes: options.pathPrefixes }),
  )
  if (paths.remapped > 0) {
    const mappings = paths.used.map(prefix => `${prefix.from} → ${prefix.to}`).join(', ')
    console.error(`Remapped ${paths.remapped} attachment path(s): ${mappings || 'no mapping recorded'}`)
  }
  if (paths.unreadable.length > 0) {
    warn(
      `${paths.unreadable.length} screenshot(s) could not be read, starting with ${paths.unreadable[0]}. ` +
      'Playwright ran somewhere this command cannot reach — a container, most likely. Run it there too, ' +
      'or pass --path-prefix=CONTAINER_PATH:LOCAL_PATH.',
    )
  }

  const uploader = uploaderFromEnvironment(
    options.maxUploads === undefined ? {} : { maxUploads: options.maxUploads },
  )
  if (uploader.enabled) {
    await uploadImages(report, uploader)
    const stats = uploader.getStats()
    console.error(`Uploaded ${stats.uploaded} screenshot(s), skipped ${stats.skipped}.`)
    if (uploader.disabledReason) {
      // Reaching an undocumented endpoint that no longer answers is a real
      // fault, unlike an absent token on a fork build.
      warn(`Screenshot uploads stopped early — ${uploader.disabledReason}.`)
    }
  } else {
    console.error(`Screenshot uploads are off — ${uploader.disabledReason}.`)
  }

  const uploadReason = uploader.disabledReason ?? undefined
  const summary = generateSummary(report, { uploadReason })
  const summaryFile = process.env.GITHUB_STEP_SUMMARY
  if (summaryFile) {
    fs.appendFileSync(summaryFile, summary)
    console.error('Failure summary written to $GITHUB_STEP_SUMMARY')
  } else {
    process.stdout.write(summary)
  }

  if (options.commentPath) {
    const comment = generateComment(report, {
      summaryUrl: summaryUrl(),
      title: options.title,
      uploadReason,
    })
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
