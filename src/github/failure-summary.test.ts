import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import {
  parseFailures,
  resolveImagePaths,
  generateSummary,
  generateComment,
  uploadImages,
  defuseMaskTriggers,
  FailureReport,
} from './failure-summary'
import { createPathResolver } from './report-paths'
import { AttachmentUploader, FetchLike } from './attachments'

let tmpDir: string

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'failure-summary-test-'))
})

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

interface TestCase {
  title?: string
  status?: string
  attachments?: any[]
  error?: { message: string }
}

/** Build a minimal Playwright JSON report and write it to disk. */
function writeReport(cases: TestCase[]): string {
  const report = {
    suites: [{
      title: '',
      file: 'tests/visual.spec.ts',
      specs: cases.map((testCase, index) => ({
        title: testCase.title ?? `case ${index}`,
        line: 10 + index,
        tests: [{
          results: [{
            status: testCase.status ?? 'failed',
            attachments: testCase.attachments ?? [],
            error: testCase.error,
          }],
        }],
      })),
    }],
  }

  const reportPath = path.join(tmpDir, 'results.json')
  fs.writeFileSync(reportPath, JSON.stringify(report))
  return reportPath
}

function image(name: string, filePath = `/tmp/${name}`) {
  return { name, contentType: 'image/png', path: filePath }
}

describe('parseFailures', () => {
  it('collects failing tests and ignores passing ones', () => {
    const reportPath = writeReport([
      { title: 'homepage matches', status: 'failed', attachments: [image('homepage-diff.png')] },
      { title: 'about page matches', status: 'passed' },
    ])

    const report = parseFailures(reportPath)

    expect(report.tests).toHaveLength(1)
    expect(report.tests[0].title).toBe('homepage matches')
    expect(report.totalFailed).toBe(1)
    expect(report.totalImages).toBe(1)
  })

  it('classifies the snapshot comparison images', () => {
    const reportPath = writeReport([{
      attachments: [
        image('homepage-diff.png'),
        image('homepage-actual.png'),
        image('homepage-expected.png'),
      ],
    }])

    const diffOnly = parseFailures(reportPath, 'diff')
    expect(diffOnly.tests[0].images.map(i => i.kind)).toEqual(['diff'])

    const all = parseFailures(reportPath, 'all')
    expect(all.tests[0].images.map(i => i.kind)).toEqual(['diff', 'actual', 'expected'])
  })

  it('keeps an inlined attachment body, which is how a11y screenshots arrive', () => {
    const reportPath = writeReport([{
      attachments: [
        { name: 'a11y-violation-screenshot', contentType: 'image/png', body: 'aGVsbG8=' },
      ],
    }])

    const image = parseFailures(reportPath).tests[0].images[0]

    expect(image.body).toBe('aGVsbG8=')
    expect(image.filePath).toBeUndefined()
  })

  it('keeps an accessibility screenshot even when the test passed', () => {
    // A baselined violation still passes, and its screenshot is still the
    // thing worth looking at.
    const reportPath = writeReport([{
      title: 'homepage a11y',
      status: 'passed',
      attachments: [image('a11y-violation-screenshot')],
    }])

    const report = parseFailures(reportPath)

    expect(report.tests).toHaveLength(1)
    expect(report.tests[0].images[0].kind).toBe('a11y')
    expect(report.totalFailed).toBe(0)
  })

  it('ignores attachments that are not images', () => {
    const reportPath = writeReport([{
      attachments: [
        { name: 'trace.zip', contentType: 'application/zip', path: '/tmp/trace.zip' },
        { name: 'stdout.txt', contentType: 'text/plain', body: 'aGk=' },
      ],
    }])

    expect(parseFailures(reportPath).tests[0].images).toHaveLength(0)
  })

  it('takes the first line of the error, without ANSI codes', () => {
    const reportPath = writeReport([{
      error: { message: '\u001b[31mScreenshot comparison failed\u001b[0m\n\n  expected 1000 pixels' },
    }])

    expect(parseFailures(reportPath).tests[0].error).toBe('Screenshot comparison failed')
  })
})

describe('generateSummary', () => {
  function reportWith(url?: string): FailureReport {
    return {
      tests: [{
        title: 'homepage matches',
        file: 'tests/visual.spec.ts',
        line: 10,
        status: 'failed',
        error: 'Screenshot comparison failed',
        images: [{ name: 'homepage-diff.png', contentType: 'image/png', kind: 'diff', url }],
      }],
      totalFailed: 1,
      totalImages: 1,
    }
  }

  it('points at the comment rather than embedding images', () => {
    // A summary is rendered once when the job ends, before a just-uploaded
    // attachment resolves, and that dead render is cached for good.
    const summary = generateSummary(reportWith('https://example.test/a'))

    expect(summary).not.toContain('<img')
    expect(summary).toContain('1 screenshot(s) uploaded — see the pull request comment.')
    expect(summary).toContain('homepage matches')
  })

  it('points at the artifact when nothing was uploaded', () => {
    const summary = generateSummary(reportWith(undefined))

    expect(summary).not.toContain('<img')
    expect(summary).toContain('not uploaded')
  })

  it('says an absent token is why nothing was uploaded', () => {
    const summary = generateSummary(reportWith(undefined), {
      uploadReason: 'no upload token configured',
    })

    expect(summary).toContain('not uploaded (no upload token configured)')
  })

  it('says so when the images were not where the report said they were', () => {
    // The reason a reader most needs, and the one that used to be silent: the
    // token is fine, the files are on the other side of a container boundary.
    const report = reportWith(undefined)
    report.tests[0].images[0].filePath = '/var/www/html/test/playwright/test-results/home-1-diff.png'
    report.tests[0].images[0].unreadable = true

    const summary = generateSummary(report)

    expect(summary).toContain('1 screenshot(s) could not be read')
    expect(summary).toContain('/var/www/html/test/playwright/test-results/home-1-diff.png')
    expect(summary).toContain('--path-prefix=')
    expect(summary).toContain('not uploaded (1 could not be read')
  })

  it('does not mention a path boundary when there is none', () => {
    expect(generateSummary(reportWith(undefined))).not.toContain('could not be read')
  })

  it('does not claim zero failing tests when only a11y captured something', () => {
    const summary = generateSummary({
      tests: [{
        title: 'homepage a11y',
        file: 'tests/a11y.spec.ts',
        line: 7,
        status: 'passed',
        images: [{ name: 'a11y-violation-screenshot', contentType: 'image/png', kind: 'a11y' }],
      }],
      totalFailed: 0,
      totalImages: 1,
    })

    expect(summary).not.toContain('**0** failing test(s)')
    expect(summary).toContain('No failing tests · **1** screenshot(s)')
    // Nothing failed, so do not head the section "Test Failures".
    expect(summary).toContain('## Test Screenshots')
  })

  it('says so plainly when there is nothing to report', () => {
    const summary = generateSummary({ tests: [], totalFailed: 0, totalImages: 0 })

    expect(summary).toContain('No failing tests')
    expect(summary).not.toContain('<details>')
  })

  it('escapes the asset URL, which may one day carry query parameters', () => {
    const report = reportWith('https://example.test/a?x=1&y=2')

    expect(generateComment(report)).toContain('src="https://example.test/a?x=1&amp;y=2"')
  })

  it('escapes quotes coming from a test title', () => {
    const report = reportWith('https://example.test/a')
    report.tests[0].title = 'renders "quoted" text'

    expect(generateComment(report)).toContain('alt="diff for renders &quot;quoted&quot; text"')
  })
})

describe('generateComment', () => {
  const report: FailureReport = {
    tests: [{
      title: 'homepage matches',
      file: 'tests/visual.spec.ts',
      line: 10,
      status: 'failed',
      images: [{ name: 'homepage-diff.png', contentType: 'image/png', kind: 'diff' }],
    }],
    totalFailed: 1,
    totalImages: 1,
  }

  it('summarises the failures and links to the summary', () => {
    const comment = generateComment(report, { summaryUrl: 'https://example.test/run/1' })

    expect(comment).toContain('**1** failing test(s)')
    expect(comment).toContain('homepage matches')
    expect(comment).toContain('(https://example.test/run/1)')
  })

  it('says why the screenshots it promised are not there', () => {
    // The bullet list still advertises the screenshots, so a comment with no
    // images has to account for them or it reads as a broken feature.
    const comment = generateComment(report, { uploadReason: 'no upload token configured' })

    expect(comment).toContain('1 screenshot(s) not shown — no upload token configured')
  })

  it('distinguishes unreadable images from an absent token', () => {
    const unreadable: FailureReport = {
      ...report,
      tests: [{
        ...report.tests[0],
        images: [{ ...report.tests[0].images[0], unreadable: true }],
      }],
    }

    const comment = generateComment(unreadable)

    expect(comment).toContain('1 could not be read from the path recorded in the report')
  })

  it('embeds uploaded images in a collapsed block', () => {
    // A comment re-renders on every read, so an attachment resolves however
    // recently it was uploaded. This is the only place they display.
    const withUrls: FailureReport = {
      ...report,
      tests: [{
        ...report.tests[0],
        images: [{
          name: 'homepage-diff.png',
          contentType: 'image/png',
          kind: 'diff',
          url: 'https://github.com/user-attachments/assets/abc',
        }],
      }],
    }

    const comment = generateComment(withUrls)

    expect(comment).toContain('<details>')
    expect(comment).toContain('<img src="https://github.com/user-attachments/assets/abc"')
    expect(comment).toContain('width="640"')
  })

  it('shows no image block when nothing was uploaded', () => {
    const comment = generateComment(report)

    expect(comment).not.toContain('<img')
    expect(comment).not.toContain('<details>')
  })

  it('marks the failure count for a workflow to read', () => {
    // The empty-state sentence contains the words "failing test", so anything
    // grepping the prose would treat a green run as a failure.
    expect(generateComment(report)).toContain('<!-- playwright-drupal-failures: 1 -->')

    const green = generateComment({ tests: [], totalFailed: 0, totalImages: 0 })
    expect(green).toContain('<!-- playwright-drupal-failures: 0 -->')
    expect(green).toMatch(/No failing tests/)
  })

  it('truncates a long list rather than posting a wall of text', () => {
    const many: FailureReport = {
      tests: Array.from({ length: 12 }, (_, i) => ({
        title: `case ${i}`,
        file: 'tests/visual.spec.ts',
        line: i,
        status: 'failed',
        images: [],
      })),
      totalFailed: 12,
      totalImages: 0,
    }

    expect(generateComment(many)).toContain('…and 2 more')
  })
})

describe('defuseMaskTriggers', () => {
  it('breaks up the pattern the runner redacts in job summaries', () => {
    const defused = defuseMaskTriggers('sends Bearer tokens')

    expect(defused).not.toContain('Bearer tokens')
    expect(defused.replace(/\u200B/g, '')).toBe('sends Bearer tokens')
  })

  it('leaves the bare word alone, which the runner does not redact', () => {
    expect(defuseMaskTriggers('Bearer')).toBe('Bearer')
  })
})

describe('resolveImagePaths', () => {
  /**
   * A report as it arrives from a run inside DDEV: every path absolute and
   * under /var/www/html, read from a checkout that has no such directory.
   */
  function containerRun(diffPath: string) {
    const raw = {
      config: {
        // What Playwright actually records: the *test* directory, which is why
        // the report's own config is no use for locating the mount point.
        rootDir: '/var/www/html/test/playwright/tests',
        projects: [{ name: 'chromium', outputDir: '/var/www/html/test/playwright/test-results' }],
      },
      suites: [{
        title: '',
        file: 'tests/visual.spec.ts',
        specs: [{
          title: 'homepage matches',
          line: 10,
          tests: [{
            results: [{
              status: 'failed',
              attachments: [{ name: 'homepage-1-diff.png', contentType: 'image/png', path: diffPath }],
            }],
          }],
        }],
      }],
    }

    const reportPath = path.join(tmpDir, 'test/playwright/test-results/results.json')
    fs.mkdirSync(path.dirname(reportPath), { recursive: true })
    fs.writeFileSync(reportPath, JSON.stringify(raw))

    return reportPath
  }

  it('finds a diff image written by a container and read from outside it', () => {
    // The bind mount that makes the two views differ also makes this work:
    // the same file is under the checkout, at a different prefix.
    const diffPath = path.join(tmpDir, 'test/playwright/test-results/homepage-chromium/homepage-1-diff.png')
    fs.mkdirSync(path.dirname(diffPath), { recursive: true })
    fs.writeFileSync(diffPath, 'png')

    const reportPath = containerRun(
      '/var/www/html/test/playwright/test-results/homepage-chromium/homepage-1-diff.png',
    )
    const report = parseFailures(reportPath)

    const summary = resolveImagePaths(report, createPathResolver({ reportPath }))

    expect(summary.unreadable).toEqual([])
    expect(summary.remapped).toBe(1)
    expect(summary.used).toEqual([{ from: '/var/www/html', to: tmpDir }])
    expect(report.tests[0].images[0].filePath).toBe(diffPath)
    expect(report.tests[0].images[0].unreadable).toBeUndefined()
  })

  it('marks an image it cannot reach, rather than passing the path on', () => {
    const reportPath = containerRun(
      '/var/www/html/test/playwright/test-results/never-written/never-written-diff.png',
    )
    const report = parseFailures(reportPath)

    const summary = resolveImagePaths(report, createPathResolver({ reportPath }))

    expect(summary.remapped).toBe(0)
    expect(summary.unreadable).toEqual([
      '/var/www/html/test/playwright/test-results/never-written/never-written-diff.png',
    ])
    expect(report.tests[0].images[0].unreadable).toBe(true)
  })

  it('leaves an inlined accessibility screenshot alone', () => {
    // These carry a body rather than a path, which is why they were the one
    // attachment kind that never hit the boundary.
    const report = parseFailures(writeReport([{
      title: 'homepage a11y',
      status: 'failed',
      attachments: [{
        name: 'a11y-violation-screenshot',
        contentType: 'image/png',
        body: 'aGVsbG8=',
      }],
    }]))

    const summary = resolveImagePaths(report, createPathResolver({ reportPath: '/nowhere/results.json' }))

    expect(summary).toEqual({ remapped: 0, used: [], unreadable: [] })
    expect(report.tests[0].images[0].body).toBe('aGVsbG8=')
  })
})

describe('uploadImages', () => {
  it('uploads an inlined body, giving it a name derived from the content type', async () => {
    const names: string[] = []
    const impl: FetchLike = async (url) => {
      names.push(new URL(url).searchParams.get('name') ?? '')
      return { ok: true, status: 201, text: async () => '{"url":"https://example.test/a"}' }
    }

    const report: FailureReport = {
      tests: [{
        title: 'a', file: 'f', line: 1, status: 'passed',
        images: [{
          name: 'a11y-violation-screenshot',
          body: Buffer.from('png bytes').toString('base64'),
          contentType: 'image/png',
          kind: 'a11y',
        }],
      }],
      totalFailed: 0,
      totalImages: 1,
    }

    await uploadImages(report, new AttachmentUploader({ token: 't', repositoryId: '1', fetchImpl: impl }))

    expect(names).toEqual(['a11y-violation-screenshot.png'])
    expect(report.tests[0].images[0].url).toBe('https://example.test/a')
  })

  it('records a URL per image and leaves the rest alone once uploads stop', async () => {
    const filePath = path.join(tmpDir, 'diff.png')
    fs.writeFileSync(filePath, Buffer.alloc(8, 1))

    const responses = [
      { ok: true, status: 201, body: '{"url":"https://example.test/one"}' },
      { ok: false, status: 404, body: '{"message":"Not Found"}' },
    ]
    const impl: FetchLike = async () => {
      const next = responses.shift()!
      return { ok: next.ok, status: next.status, text: async () => next.body }
    }

    const report: FailureReport = {
      tests: [{
        title: 'a', file: 'f', line: 1, status: 'failed',
        images: [
          { name: 'one.png', filePath, contentType: 'image/png', kind: 'diff' },
          { name: 'two.png', filePath, contentType: 'image/png', kind: 'diff' },
          { name: 'three.png', filePath, contentType: 'image/png', kind: 'diff' },
        ],
      }],
      totalFailed: 1,
      totalImages: 3,
    }

    await uploadImages(report, new AttachmentUploader({ token: 't', repositoryId: '1', fetchImpl: impl }))

    const urls = report.tests[0].images.map(i => i.url)
    expect(urls).toEqual(['https://example.test/one', undefined, undefined])
  })
})
