import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import {
  parseFailures,
  generateSummary,
  generateComment,
  uploadImages,
  defuseMaskTriggers,
  FailureReport,
} from './failure-summary'
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

  it('embeds uploaded images in a collapsed block', () => {
    const summary = generateSummary(reportWith('https://example.test/a'))

    expect(summary).toContain('<details>')
    expect(summary).toContain('<img src="https://example.test/a"')
    expect(summary).toContain('width="640"')
    expect(summary).toContain('homepage matches')
  })

  it('points at the artifact when nothing was uploaded', () => {
    const summary = generateSummary(reportWith(undefined))

    expect(summary).not.toContain('<img')
    expect(summary).toContain('Images were not uploaded')
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

    expect(generateSummary(report)).toContain('src="https://example.test/a?x=1&amp;y=2"')
  })

  it('escapes quotes coming from a test title', () => {
    const report = reportWith('https://example.test/a')
    report.tests[0].title = 'renders "quoted" text'

    expect(generateSummary(report)).toContain('alt="diff for renders &quot;quoted&quot; text"')
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

  it('carries no images, because notification emails would break them', () => {
    expect(generateComment(report)).not.toContain('<img')
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
