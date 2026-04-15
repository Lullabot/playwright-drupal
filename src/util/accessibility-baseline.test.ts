import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock AxeBuilder — must be hoisted since vi.mock is hoisted
const { mockWithTags, mockExclude, mockOptions, mockAnalyze, MockAxeBuilder } = vi.hoisted(() => {
  const mockWithTags = vi.fn().mockReturnThis()
  const mockExclude = vi.fn().mockReturnThis()
  const mockOptions = vi.fn().mockReturnThis()
  const mockAnalyze = vi.fn()

  class MockAxeBuilder {
    withTags = mockWithTags
    exclude = mockExclude
    options = mockOptions
    analyze = mockAnalyze
    constructor(_args: any) {}
  }

  return { mockWithTags, mockExclude, mockOptions, mockAnalyze, MockAxeBuilder }
})

vi.mock('@axe-core/playwright', () => ({
  default: MockAxeBuilder,
}))

// Mock @playwright/test
const { mockToMatchSnapshot, mockToBe, mockExpectSoft, mockExpectHard } = vi.hoisted(() => {
  const mockToMatchSnapshot = vi.fn()
  const mockToBe = vi.fn()
  const mockExpectSoft = vi.fn(() => ({
    toMatchSnapshot: mockToMatchSnapshot,
    toHaveScreenshot: vi.fn(),
  }))
  const mockExpectHard = vi.fn((_val?: any, _msg?: string) => ({
    toMatchSnapshot: mockToMatchSnapshot,
    toBe: mockToBe,
  }))
  return { mockToMatchSnapshot, mockToBe, mockExpectSoft, mockExpectHard }
})

vi.mock('@playwright/test', () => {
  const expectFn = Object.assign(mockExpectHard, {
    soft: mockExpectSoft,
  })
  return {
    expect: expectFn,
    Locator: {},
    Page: {},
    TestInfo: {},
  }
})

import { checkAccessibility } from './accessible-screenshot'
import { defineAccessibilityBaseline, AccessibilityBaseline } from './accessibility-baseline'

function makeAxeResults(overrides?: Partial<{ violations: any[], passes: any[] }>) {
  return {
    violations: [],
    passes: [],
    incomplete: [],
    inapplicable: [],
    ...overrides,
  }
}

function makeTestInfo(opts?: { updateSnapshots?: 'all' | 'changed' | 'missing' | 'none', snapshotsDir?: string, title?: string }) {
  // Default to `updateSnapshots: 'all'` so that, in the absence of an
  // explicit `baseline` option, the dispatch routes to snapshot mode (the
  // legacy behavior these tests were originally written against). Tests
  // that want to exercise on-disk baseline mode override this.
  const dir = opts?.snapshotsDir ?? '/tmp/__a11y_test_snapshots__'
  const title = opts?.title ?? 'mocked test'
  return {
    testId: `mocked-${Math.random()}`,
    title,
    titlePath: ['file.spec.ts', title],
    annotations: [] as Array<{ type: string, description?: string }>,
    attach: vi.fn().mockResolvedValue(undefined),
    snapshotPath: (...segs: string[]) => `${dir}/${segs.join('/')}`,
    config: { updateSnapshots: opts?.updateSnapshots ?? 'all' },
  }
}

function makePage() {
  return {
    evaluate: vi.fn().mockResolvedValue(undefined),
    screenshot: vi.fn().mockResolvedValue(Buffer.from('fake-png')),
  }
}

function makeViolation(rule: string, targets: string[][], extras?: { description?: string, impact?: string, helpUrl?: string }) {
  return {
    id: rule,
    description: extras?.description ?? `Description for ${rule}`,
    impact: extras?.impact ?? 'serious',
    helpUrl: extras?.helpUrl ?? `https://dequeuniversity.com/rules/axe/4.8/${rule}`,
    nodes: targets.map(targetArr => ({
      target: targetArr,
    })),
  }
}

describe('accessibility baseline', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAnalyze.mockResolvedValue(makeAxeResults())
  })

  describe('defineAccessibilityBaseline', () => {
    it('returns the entries unchanged', () => {
      const entries: AccessibilityBaseline = [
        { rule: 'color-contrast', targets: ['#sidebar .tag'], reason: 'Known issue', willBeFixedIn: 'PROJ-123' },
      ]
      expect(defineAccessibilityBaseline(entries)).toBe(entries)
    })
  })

  describe('baseline matching', () => {
    it('suppresses violations that match a baseline entry (exact rule + target)', async () => {
      const wcagResults = makeAxeResults({
        violations: [makeViolation('color-contrast', [['#sidebar .tag']])],
      })
      mockAnalyze.mockResolvedValue(wcagResults)

      const testInfo = makeTestInfo()
      const baseline: AccessibilityBaseline = [
        { rule: 'color-contrast', targets: ['#sidebar .tag'], reason: 'Known issue', willBeFixedIn: 'PROJ-123' },
      ]

      await checkAccessibility(makePage() as any, testInfo as any, {
        bestPracticeMode: 'off',
        baseline,
      })

      // Should not call toBe (no failure)
      expect(mockToBe).not.toHaveBeenCalled()
      // Should not call toMatchSnapshot (baseline mode skips it)
      expect(mockToMatchSnapshot).not.toHaveBeenCalled()
    })

    it('suppresses violations with normalized ID match (--UNIQUE-ID replacement)', async () => {
      const wcagResults = makeAxeResults({
        violations: [makeViolation('color-contrast', [['#edit-field--42']])],
      })
      mockAnalyze.mockResolvedValue(wcagResults)

      const testInfo = makeTestInfo()
      const baseline: AccessibilityBaseline = [
        { rule: 'color-contrast', targets: ['#edit-field--UNIQUE-ID'], reason: 'Dynamic ID', willBeFixedIn: 'PROJ-456' },
      ]

      await checkAccessibility(makePage() as any, testInfo as any, {
        bestPracticeMode: 'off',
        baseline,
      })

      expect(mockToBe).not.toHaveBeenCalled()
      expect(mockToMatchSnapshot).not.toHaveBeenCalled()
    })

    it('fails on unmatched violations with full details', async () => {
      const wcagResults = makeAxeResults({
        violations: [makeViolation('color-contrast', [['#sidebar .tag', '.footer__copyright']], {
          description: 'Elements must meet minimum color contrast ratio thresholds',
          impact: 'serious',
          helpUrl: 'https://dequeuniversity.com/rules/axe/4.8/color-contrast',
        })],
      })
      mockAnalyze.mockResolvedValue(wcagResults)

      const testInfo = makeTestInfo()
      await checkAccessibility(makePage() as any, testInfo as any, {
        bestPracticeMode: 'off',
        baseline: [],
      })

      expect(mockToBe).toHaveBeenCalled()
      // First arg is null, second is the message string
      const failureMessage = mockExpectHard.mock.calls.find(
        (call: any[]) => call.length >= 2 && typeof call[1] === 'string'
      )?.[1] as string

      expect(failureMessage).toContain('color-contrast')
      expect(failureMessage).toContain('serious')
      expect(failureMessage).toContain('Elements must meet minimum color contrast ratio thresholds')
      expect(failureMessage).toContain('https://dequeuniversity.com/rules/axe/4.8/color-contrast')
      expect(failureMessage).toContain('#sidebar .tag')
      expect(failureMessage).toContain('.footer__copyright')
    })
  })

  describe('stale detection', () => {
    it('reports stale baseline entries with annotations', async () => {
      const wcagResults = makeAxeResults({ violations: [] })
      mockAnalyze.mockResolvedValue(wcagResults)

      const testInfo = makeTestInfo()
      const baseline: AccessibilityBaseline = [
        { rule: 'color-contrast', targets: ['#old-element'], reason: 'Was broken', willBeFixedIn: 'PROJ-789' },
      ]

      await checkAccessibility(makePage() as any, testInfo as any, {
        bestPracticeMode: 'off',
        baseline,
      })

      const staleAnnotations = testInfo.annotations.filter(a => a.type === 'Stale a11y baseline entry')
      expect(staleAnnotations).toHaveLength(1)
      expect(staleAnnotations[0].description).toContain('color-contrast')
      expect(staleAnnotations[0].description).toContain('#old-element')
      expect(staleAnnotations[0].description).toContain('no longer detected')
    })
  })

  describe('snapshot bypass', () => {
    it('does NOT call toMatchSnapshot when baseline is active', async () => {
      const wcagResults = makeAxeResults({ violations: [] })
      mockAnalyze.mockResolvedValue(wcagResults)

      const testInfo = makeTestInfo()
      await checkAccessibility(makePage() as any, testInfo as any, {
        bestPracticeMode: 'off',
        baseline: [],
      })

      expect(mockToMatchSnapshot).not.toHaveBeenCalled()
    })

    it('calls toMatchSnapshot when no baseline is provided', async () => {
      const testInfo = makeTestInfo()
      await checkAccessibility(makePage() as any, testInfo as any, {
        bestPracticeMode: 'off',
      })

      expect(mockToMatchSnapshot).toHaveBeenCalled()
    })
  })

  describe('copy-pasteable baseline entry in failure message', () => {
    it('includes a copy-pasteable entry for unmatched violations', async () => {
      const wcagResults = makeAxeResults({
        violations: [makeViolation('image-alt', [['img.hero']])],
      })
      mockAnalyze.mockResolvedValue(wcagResults)

      const testInfo = makeTestInfo()
      await checkAccessibility(makePage() as any, testInfo as any, {
        bestPracticeMode: 'off',
        baseline: [],
      })

      const failureMessage = mockExpectHard.mock.calls.find(
        (call: any[]) => call.length >= 2 && typeof call[1] === 'string'
      )?.[1] as string

      expect(failureMessage).toContain("rule: 'image-alt'")
      expect(failureMessage).toContain("targets: ['img.hero']")
      expect(failureMessage).toContain('reason:')
      expect(failureMessage).toContain('willBeFixedIn:')
      expect(failureMessage).toContain('Add to your baseline to accept this violation:')
    })
  })

  describe('baseline annotations', () => {
    it('pushes Baselined a11y violation annotations for matched violations', async () => {
      const wcagResults = makeAxeResults({
        violations: [makeViolation('color-contrast', [['#sidebar .tag']])],
      })
      mockAnalyze.mockResolvedValue(wcagResults)

      const testInfo = makeTestInfo()
      const baseline: AccessibilityBaseline = [
        { rule: 'color-contrast', targets: ['#sidebar .tag'], reason: 'Known issue', willBeFixedIn: 'PROJ-123' },
      ]

      await checkAccessibility(makePage() as any, testInfo as any, {
        bestPracticeMode: 'off',
        baseline,
      })

      const baselinedAnnotations = testInfo.annotations.filter(a => a.type === 'Baselined a11y violation')
      expect(baselinedAnnotations).toHaveLength(1)
      expect(baselinedAnnotations[0].description).toBe('color-contrast: Known issue — PROJ-123')
    })

    it('pushes Stale a11y baseline entry annotations for unmatched baseline entries', async () => {
      const wcagResults = makeAxeResults({ violations: [] })
      mockAnalyze.mockResolvedValue(wcagResults)

      const testInfo = makeTestInfo()
      const baseline: AccessibilityBaseline = [
        { rule: 'old-rule', targets: ['.gone'], reason: 'Was broken', willBeFixedIn: 'PROJ-999' },
      ]

      await checkAccessibility(makePage() as any, testInfo as any, {
        bestPracticeMode: 'off',
        baseline,
      })

      const staleAnnotations = testInfo.annotations.filter(a => a.type === 'Stale a11y baseline entry')
      expect(staleAnnotations).toHaveLength(1)
      expect(staleAnnotations[0].description).toBe('old-rule on .gone — no longer detected')
    })
  })

  describe('baseline summary annotation', () => {
    it('includes correct counts in summary annotation', async () => {
      const wcagResults = makeAxeResults({
        violations: [
          makeViolation('color-contrast', [['#sidebar .tag']]),
          makeViolation('image-alt', [['img.hero']]),
        ],
      })
      mockAnalyze.mockResolvedValue(wcagResults)

      const testInfo = makeTestInfo()
      const baseline: AccessibilityBaseline = [
        { rule: 'color-contrast', targets: ['#sidebar .tag'], reason: 'Known', willBeFixedIn: 'PROJ-1' },
      ]

      await checkAccessibility(makePage() as any, testInfo as any, {
        bestPracticeMode: 'off',
        baseline,
      })

      const summaryAnnotations = testInfo.annotations.filter(
        a => a.type === 'Accessibility' && a.description?.includes('baselined')
      )
      expect(summaryAnnotations).toHaveLength(1)
      expect(summaryAnnotations[0].description).toBe('WCAG scan: 1 new violations (1 baselined)')
    })
  })

  describe('snapshot-mode baseline suggestions', () => {
    it('attaches baseline suggestions when violations exist in snapshot mode', async () => {
      const wcagResults = makeAxeResults({
        violations: [makeViolation('color-contrast', [['#sidebar .tag']])],
      })
      mockAnalyze.mockResolvedValue(wcagResults)

      const testInfo = makeTestInfo()
      await checkAccessibility(makePage() as any, testInfo as any, {
        bestPracticeMode: 'off',
      })

      // Should attach a11y-baseline-suggestions
      expect(testInfo.attach).toHaveBeenCalledWith(
        'a11y-baseline-suggestions',
        expect.objectContaining({
          contentType: 'text/plain',
        })
      )

      // Check the attachment body contains the suggestion
      const attachCall = testInfo.attach.mock.calls.find(
        (call: any[]) => call[0] === 'a11y-baseline-suggestions'
      )
      expect(attachCall).toBeTruthy()
      const body = attachCall![1].body as string
      expect(body).toContain("rule: 'color-contrast'")
      expect(body).toContain("targets: ['#sidebar .tag']")

      // Should push annotation about switching to baseline mode
      const baselineHintAnnotation = testInfo.annotations.find(
        a => a.description?.includes('switch to baseline mode')
      )
      expect(baselineHintAnnotation).toBeTruthy()
      expect(baselineHintAnnotation!.type).toBe('Accessibility')
    })

    it('does not attach baseline suggestions when no violations in snapshot mode', async () => {
      const wcagResults = makeAxeResults({ violations: [] })
      mockAnalyze.mockResolvedValue(wcagResults)

      const testInfo = makeTestInfo()
      await checkAccessibility(makePage() as any, testInfo as any, {
        bestPracticeMode: 'off',
      })

      expect(testInfo.attach).not.toHaveBeenCalledWith(
        'a11y-baseline-suggestions',
        expect.anything()
      )
    })
  })

  describe('on-disk baseline (new default for snapshotless tests)', () => {
    let tmpDir: string
    let originalCI: string | undefined

    beforeEach(async () => {
      const fs = await import('fs')
      const os = await import('os')
      const path = await import('path')
      tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'a11y-disp-'))
      originalCI = process.env.CI
      delete process.env.CI
    })

    afterEach(async () => {
      const fs = await import('fs')
      await fs.promises.rm(tmpDir, { recursive: true, force: true })
      if (originalCI === undefined) delete process.env.CI
      else process.env.CI = originalCI
    })

    it('seeds an empty baseline file when no violations and no snapshot exist (local)', async () => {
      mockAnalyze.mockResolvedValue(makeAxeResults({ violations: [] }))

      const testInfo = makeTestInfo({ updateSnapshots: 'none', snapshotsDir: tmpDir, title: 'clean test' })
      await checkAccessibility(makePage() as any, testInfo as any, {
        bestPracticeMode: 'off',
      })

      const fs = await import('fs')
      const path = await import('path')
      const file = path.join(tmpDir, 'clean-test-1.a11y-baseline.json')
      const written = JSON.parse(await fs.promises.readFile(file, 'utf8'))
      expect(written.note).toBe('No accessibility violations found')
      expect(written.violations).toEqual([])

      // Snapshot mode is NOT used; on-disk baseline mode used assertBaseline.
      expect(mockToMatchSnapshot).not.toHaveBeenCalled()
      // Test does not fail (no toBe call against a "baseline file present" sentinel).
      expect(mockToBe).not.toHaveBeenCalled()
    })

    it('seeds a TODO-prompted baseline file when violations exist and no snapshot (local)', async () => {
      mockAnalyze.mockResolvedValue(makeAxeResults({
        violations: [makeViolation('color-contrast', [['#footer .legal']])],
      }))

      const testInfo = makeTestInfo({ updateSnapshots: 'none', snapshotsDir: tmpDir, title: 'with violations' })
      await checkAccessibility(makePage() as any, testInfo as any, {
        bestPracticeMode: 'off',
      })

      const fs = await import('fs')
      const path = await import('path')
      const file = path.join(tmpDir, 'with-violations-1.a11y-baseline.json')
      const written = JSON.parse(await fs.promises.readFile(file, 'utf8'))
      expect(written.note).toMatch(/TODO/)
      expect(written.violations).toEqual([
        { rule: 'color-contrast', targets: ['#footer .legal'], reason: 'TODO', willBeFixedIn: 'TODO' },
      ])
      expect(mockToBe).not.toHaveBeenCalled()
    })

    it('fails the test on CI when seeding (mirrors Playwright missing-snapshot behaviour)', async () => {
      process.env.CI = '1'
      mockAnalyze.mockResolvedValue(makeAxeResults({
        violations: [makeViolation('color-contrast', [['#x']])],
      }))

      const testInfo = makeTestInfo({ updateSnapshots: 'none', snapshotsDir: tmpDir, title: 'on ci' })
      await checkAccessibility(makePage() as any, testInfo as any, {
        bestPracticeMode: 'off',
      })

      // File is still seeded.
      const fs = await import('fs')
      const path = await import('path')
      const file = path.join(tmpDir, 'on-ci-1.a11y-baseline.json')
      expect(fs.existsSync(file)).toBe(true)

      // Test fails with the seed-and-commit directive.
      expect(mockToBe).toHaveBeenCalled()
      const failureMessage = mockExpectHard.mock.calls.find(
        (call: any[]) => call.length >= 2 && typeof call[1] === 'string' && call[1].includes('a11y baseline file was missing')
      )?.[1] as string
      expect(failureMessage).toContain(file)
      expect(failureMessage).toMatch(/commit it/i)
    })

    it('loads an existing on-disk baseline JSON and matches violations against it', async () => {
      mockAnalyze.mockResolvedValue(makeAxeResults({
        violations: [makeViolation('color-contrast', [['#known']])],
      }))

      // Pre-write a baseline.
      const fs = await import('fs')
      const path = await import('path')
      const file = path.join(tmpDir, 'known-test-1.a11y-baseline.json')
      await fs.promises.writeFile(file, JSON.stringify({
        note: 'Known issue tracked in PROJ-1.',
        violations: [{ rule: 'color-contrast', targets: ['#known'], reason: 'Known', willBeFixedIn: 'PROJ-1' }],
      }))

      const testInfo = makeTestInfo({ updateSnapshots: 'none', snapshotsDir: tmpDir, title: 'known test' })
      await checkAccessibility(makePage() as any, testInfo as any, {
        bestPracticeMode: 'off',
      })

      // Violation matched -> no failure.
      expect(mockToBe).not.toHaveBeenCalled()
      const baselined = testInfo.annotations.filter(a => a.type === 'Baselined a11y violation')
      expect(baselined).toHaveLength(1)
    })

    it('produces per-call counter files for multi-call tests', async () => {
      mockAnalyze.mockResolvedValue(makeAxeResults({ violations: [] }))

      const testInfo = makeTestInfo({ updateSnapshots: 'none', snapshotsDir: tmpDir, title: 'multi call' })
      await checkAccessibility(makePage() as any, testInfo as any, { bestPracticeMode: 'off' })
      await checkAccessibility(makePage() as any, testInfo as any, { bestPracticeMode: 'off' })

      const fs = await import('fs')
      const path = await import('path')
      const f1 = path.join(tmpDir, 'multi-call-1.a11y-baseline.json')
      const f2 = path.join(tmpDir, 'multi-call-2.a11y-baseline.json')
      expect(fs.existsSync(f1)).toBe(true)
      expect(fs.existsSync(f2)).toBe(true)
    })

    it('still uses snapshot mode when a legacy snapshot file exists for the test', async () => {
      mockAnalyze.mockResolvedValue(makeAxeResults({ violations: [] }))

      // Pre-create a Playwright-style snapshot file in the snapshots dir.
      const fs = await import('fs')
      const path = await import('path')
      await fs.promises.writeFile(
        path.join(tmpDir, 'legacy-test-1-chromium-linux.txt'),
        '[]\n',
      )

      const testInfo = makeTestInfo({ updateSnapshots: 'none', snapshotsDir: tmpDir, title: 'legacy test' })
      await checkAccessibility(makePage() as any, testInfo as any, { bestPracticeMode: 'off' })

      // Snapshot mode -> toMatchSnapshot was invoked.
      expect(mockToMatchSnapshot).toHaveBeenCalled()
    })
  })
})
