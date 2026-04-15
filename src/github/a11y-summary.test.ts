import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { parseA11yResults, generateSummary, generateAnnotations } from './a11y-summary'

// A minimal Playwright JSON report with a11y data.
function makeReport(overrides: {
  violations?: any[]
  annotations?: any[]
  attachments?: any[]
  specTitle?: string
  file?: string
  line?: number
} = {}) {
  const {
    violations = [],
    annotations = [{ type: '@a11y' }],
    attachments = [],
    specTitle = 'homepage accessibility check',
    file = 'tests/a11y.spec.ts',
    line = 10,
  } = overrides

  return {
    suites: [{
      title: '',
      file,
      specs: [{
        title: specTitle,
        line,
        tests: [{
          annotations: [],
          results: [{
            // Playwright stores runtime annotations (from testInfo.annotations.push())
            // at the result level, not the test level.
            annotations,
            attachments,
          }],
        }],
      }],
    }],
  }
}

function makeWcagAttachment(violations: any[]) {
  const body = Buffer.from(JSON.stringify({
    violations: violations.map(v => ({
      id: v.rule ?? 'color-contrast',
      impact: v.impact ?? 'serious',
      description: v.description ?? 'Elements must have sufficient color contrast',
      helpUrl: v.helpUrl ?? 'https://dequeuniversity.com/rules/axe/4.7/color-contrast',
      nodes: (v.targets ?? ['#main']).map((t: string) => ({ target: [t] })),
    })),
  })).toString('base64')

  return {
    name: 'a11y-wcag-scan-results',
    body,
    contentType: 'application/json',
  }
}

describe('parseA11yResults', () => {
  let tmpDir: string
  let reportPath: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'a11y-summary-'))
    reportPath = path.join(tmpDir, 'test-report.json')
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('throws when report file does not exist', () => {
    expect(() => parseA11yResults('/nonexistent/report.json')).toThrow(
      'Playwright JSON report not found',
    )
  })

  it('returns empty report when no a11y tests exist', () => {
    const report = { suites: [{ specs: [{ tests: [{ annotations: [] }] }] }] }
    fs.writeFileSync(reportPath, JSON.stringify(report))
    const result = parseA11yResults(reportPath)
    expect(result.tests).toHaveLength(0)
    expect(result.totalViolations).toBe(0)
  })

  it('extracts tests with a11y annotations', () => {
    const report = makeReport({
      annotations: [
        { type: '@a11y' },
        { type: 'Accessibility', description: 'WCAG scan: 1 violations (50 rules passed)' },
      ],
      attachments: [makeWcagAttachment([{ rule: 'color-contrast', targets: ['#header'] }])],
    })
    fs.writeFileSync(reportPath, JSON.stringify(report))
    const result = parseA11yResults(reportPath)
    expect(result.tests).toHaveLength(1)
    expect(result.tests[0].violations).toHaveLength(1)
    expect(result.tests[0].violations[0].rule).toBe('color-contrast')
    expect(result.totalViolations).toBe(1)
  })

  it('counts baselined and stale annotations', () => {
    const report = makeReport({
      annotations: [
        { type: '@a11y' },
        { type: 'Baselined a11y violation', description: 'color-contrast: known issue' },
        { type: 'Baselined a11y violation', description: 'link-name: known issue' },
        { type: 'Stale a11y baseline entry', description: 'image-alt on .hero — no longer detected' },
      ],
    })
    fs.writeFileSync(reportPath, JSON.stringify(report))
    const result = parseA11yResults(reportPath)
    expect(result.totalBaselined).toBe(2)
    expect(result.totalStale).toBe(1)
  })

  it('handles nested suites', () => {
    const report = {
      suites: [{
        title: 'outer',
        file: 'tests/a11y.spec.ts',
        specs: [],
        suites: [{
          title: 'inner',
          specs: [{
            title: 'nested test',
            line: 5,
            tests: [{
              annotations: [{ type: '@a11y' }, { type: 'Accessibility', description: 'passed' }],
              results: [{ attachments: [] }],
            }],
          }],
        }],
      }],
    }
    fs.writeFileSync(reportPath, JSON.stringify(report))
    const result = parseA11yResults(reportPath)
    expect(result.tests).toHaveLength(1)
    expect(result.tests[0].file).toBe('tests/a11y.spec.ts')
  })
})

describe('generateSummary', () => {
  it('shows green check when no violations', () => {
    const md = generateSummary({
      tests: [{
        title: 'passes a11y',
        file: 'tests/a11y.spec.ts',
        line: 10,
        annotations: [{ type: 'Accessibility', description: 'WCAG scan: 0 violations (50 rules passed)' }],
        violations: [],
      }],
      totalViolations: 0,
      totalBaselined: 0,
      totalStale: 0,
    })
    expect(md).toContain(':white_check_mark:')
    expect(md).toContain('All accessibility checks passed')
  })

  it('shows violation table when violations exist', () => {
    const md = generateSummary({
      tests: [{
        title: 'homepage check',
        file: 'tests/a11y.spec.ts',
        line: 10,
        annotations: [{ type: 'Accessibility', description: 'WCAG scan: 1 violations' }],
        violations: [{
          rule: 'color-contrast',
          impact: 'serious',
          description: 'Elements must have sufficient color contrast',
          helpUrl: 'https://dequeuniversity.com/rules/axe/4.7/color-contrast',
          targets: ['#header'],
        }],
      }],
      totalViolations: 1,
      totalBaselined: 0,
      totalStale: 0,
    })
    expect(md).toContain('**1** violation(s)')
    expect(md).toContain('color-contrast')
    expect(md).toContain('| Rule |')
    expect(md).toContain('`#header`')
  })

  it('returns message when no tests found', () => {
    const md = generateSummary({ tests: [], totalViolations: 0, totalBaselined: 0, totalStale: 0 })
    expect(md).toContain('No accessibility tests were found')
  })

  it('shows baselined and stale counts', () => {
    const md = generateSummary({
      tests: [{
        title: 'baseline test',
        file: 'test.ts',
        line: 1,
        annotations: [
          { type: 'Baselined a11y violation', description: 'known issue' },
          { type: 'Stale a11y baseline entry', description: 'no longer detected' },
        ],
        violations: [],
      }],
      totalViolations: 0,
      totalBaselined: 1,
      totalStale: 1,
    })
    expect(md).toContain('**1** baselined')
    expect(md).toContain('**1** stale baseline entries')
  })

})

describe('generateAnnotations', () => {
  it('emits ::error for violations', () => {
    const output = generateAnnotations({
      tests: [{
        title: 'test',
        file: 'tests/a11y.spec.ts',
        line: 15,
        annotations: [],
        violations: [{
          rule: 'color-contrast',
          impact: 'serious',
          description: 'Elements must have sufficient color contrast',
          helpUrl: 'https://example.com',
          targets: ['#main'],
        }],
      }],
      totalViolations: 1,
      totalBaselined: 0,
      totalStale: 0,
    })
    expect(output).toContain('::error file=tests/a11y.spec.ts,line=15,title=color-contrast (serious)')
    expect(output).toContain('#main')
  })

  it('emits ::warning for stale baselines', () => {
    const output = generateAnnotations({
      tests: [{
        title: 'test',
        file: 'tests/a11y.spec.ts',
        line: 10,
        annotations: [{ type: 'Stale a11y baseline entry', description: 'no longer detected' }],
        violations: [],
      }],
      totalViolations: 0,
      totalBaselined: 0,
      totalStale: 1,
    })
    expect(output).toContain('::warning file=tests/a11y.spec.ts,line=10,title=Stale a11y baseline')
  })

  it('returns empty string when no violations or stale entries', () => {
    const output = generateAnnotations({
      tests: [{
        title: 'test',
        file: 'test.ts',
        line: 1,
        annotations: [{ type: 'Accessibility', description: 'passed' }],
        violations: [],
      }],
      totalViolations: 0,
      totalBaselined: 0,
      totalStale: 0,
    })
    expect(output).toBe('')
  })
})

describe('workflow-command injection hardening', () => {
  // Defence in depth: CSS target selectors are extracted by axe-core from
  // page DOM, so a crafted page could inject workflow-command syntax.
  it('escapes newlines and % in ::error output', () => {
    const output = generateAnnotations({
      tests: [{
        title: 'test',
        file: 'tests/a11y.spec.ts',
        line: 15,
        annotations: [],
        violations: [{
          rule: 'color-contrast',
          impact: 'serious',
          description: 'bad\ndescription with 100%',
          helpUrl: 'https://example.com',
          targets: ['#evil\n::error title=pwned::gotcha'],
        }],
      }],
      totalViolations: 1,
      totalBaselined: 0,
      totalStale: 0,
    })
    // No raw newlines or literal '%' characters escape into the message body.
    expect(output.split('\n')).toHaveLength(1)
    expect(output).toContain('%0A')
    expect(output).toContain('%25')
    // The forged `::error` must not appear as a standalone command.
    expect(output).not.toMatch(/\n::error title=pwned/)
  })

  it('escapes : and , in property values', () => {
    const output = generateAnnotations({
      tests: [{
        title: 'test',
        file: 'tests/with,comma:colon.spec.ts',
        line: 1,
        annotations: [],
        violations: [{
          rule: 'color-contrast',
          impact: 'serious',
          description: 'ok',
          helpUrl: 'https://example.com',
          targets: ['#main'],
        }],
      }],
      totalViolations: 1,
      totalBaselined: 0,
      totalStale: 0,
    })
    expect(output).toContain('file=tests/with%2Ccomma%3Acolon.spec.ts')
  })

  it('escapes stale baseline warning content', () => {
    const output = generateAnnotations({
      tests: [{
        title: 'test',
        file: 'tests/a11y.spec.ts',
        line: 10,
        annotations: [{ type: 'Stale a11y baseline entry', description: 'stale\n::error::forged' }],
        violations: [],
      }],
      totalViolations: 0,
      totalBaselined: 0,
      totalStale: 1,
    })
    expect(output.split('\n')).toHaveLength(1)
    expect(output).toContain('%0A')
  })
})

describe('markdown escaping in the summary table', () => {
  it('escapes pipes and newlines in description cells', () => {
    const md = generateSummary({
      tests: [{
        title: 'homepage',
        file: 'tests/a11y.spec.ts',
        line: 10,
        annotations: [],
        violations: [{
          rule: 'color-contrast',
          impact: 'serious',
          description: 'pipe | in | description\nand a newline',
          helpUrl: 'https://example.com',
          targets: ['#main'],
        }],
      }],
      totalViolations: 1,
      totalBaselined: 0,
      totalStale: 0,
    })
    // Find the row line — the one that starts with `| [color-contrast]`.
    const row = md.split('\n').find(l => l.startsWith('| [color-contrast]'))
    expect(row).toBeDefined()
    // Row should still have exactly 5 pipe-separated segments (4 columns + trailing).
    expect(row!.split(' | ').length).toBe(4)
    expect(row).toContain('\\|')
    // No literal newline inside the cell.
    expect(row).not.toMatch(/\n/)
  })

  it('escapes backticks in target code spans', () => {
    const md = generateSummary({
      tests: [{
        title: 'homepage',
        file: 'tests/a11y.spec.ts',
        line: 10,
        annotations: [],
        violations: [{
          rule: 'color-contrast',
          impact: 'serious',
          description: 'bad',
          helpUrl: 'https://example.com',
          // A target containing a backtick — would escape a naive `${t}` code span.
          targets: ['#foo`span'],
        }],
      }],
      totalViolations: 1,
      totalBaselined: 0,
      totalStale: 0,
    })
    // The raw selector must not appear wrapped in single backticks
    // (which would be the unescaped form).
    expect(md).not.toMatch(/`#foo`span`/)
    // It should be wrapped in double backticks with padding instead.
    expect(md).toContain('`` #foo`span ``')
  })
})

describe('main() error handling', () => {
  let tmpDir: string
  let origCwd: string
  let origSummary: string | undefined

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'a11y-main-'))
    origCwd = process.cwd()
    origSummary = process.env.GITHUB_STEP_SUMMARY
    delete process.env.GITHUB_STEP_SUMMARY
    process.chdir(tmpDir)
  })

  afterEach(() => {
    process.chdir(origCwd)
    if (origSummary !== undefined) {
      process.env.GITHUB_STEP_SUMMARY = origSummary
    }
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('returns without throwing when the report is missing', async () => {
    const { main } = await import('./a11y-summary')
    expect(() =>
      main(['--mode=summary', '--report-path=nonexistent.json']),
    ).not.toThrow()
  })

  it('propagates parse errors so CI surfaces real problems', async () => {
    const bad = path.join(tmpDir, 'bad.json')
    fs.writeFileSync(bad, '{ this is not json')
    const { main } = await import('./a11y-summary')
    expect(() =>
      main(['--mode=summary', `--report-path=${bad}`]),
    ).toThrow()
  })
})
