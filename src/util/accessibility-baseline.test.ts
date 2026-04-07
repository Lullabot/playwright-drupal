import { describe, it, expect, vi, beforeEach } from 'vitest'

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

function makeTestInfo() {
  return {
    annotations: [] as Array<{ type: string, description?: string }>,
    attach: vi.fn().mockResolvedValue(undefined),
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
})
