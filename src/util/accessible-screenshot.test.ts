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

// Mock @playwright/test — use vi.hoisted to define values before the hoisted vi.mock call
const { mockToMatchSnapshot, mockExpectSoft, mockExpectHard } = vi.hoisted(() => {
  const mockToMatchSnapshot = vi.fn()
  const mockExpectSoft = vi.fn(() => ({
    toMatchSnapshot: mockToMatchSnapshot,
  }))
  const mockExpectHard = vi.fn(() => ({
    toMatchSnapshot: mockToMatchSnapshot,
  }))
  return { mockToMatchSnapshot, mockExpectSoft, mockExpectHard }
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
import AxeBuilder from '@axe-core/playwright'

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

describe('checkAccessibility', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAnalyze.mockResolvedValue(makeAxeResults())
  })

  it('uses default WCAG tags when none provided', async () => {
    const testInfo = makeTestInfo()
    await checkAccessibility({} as any, testInfo as any)

    expect(mockWithTags).toHaveBeenCalledWith(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
  })

  it('respects custom wcagTags', async () => {
    const testInfo = makeTestInfo()
    await checkAccessibility({} as any, testInfo as any, {
      wcagTags: ['wcag22aa'],
    })

    expect(mockWithTags).toHaveBeenCalledWith(['wcag22aa'])
  })

  it('respects exclude option — adds extra .exclude() calls', async () => {
    const testInfo = makeTestInfo()
    await checkAccessibility({} as any, testInfo as any, {
      exclude: ['.my-selector', '#another'],
    })

    expect(mockExclude).toHaveBeenCalledWith('.my-selector')
    expect(mockExclude).toHaveBeenCalledWith('#another')
  })

  it('skips best-practice scan when bestPracticeMode is off', async () => {
    const testInfo = makeTestInfo()
    await checkAccessibility({} as any, testInfo as any, {
      bestPracticeMode: 'off',
    })

    // withTags should only be called once (for the WCAG scan, not best-practice)
    expect(mockWithTags).toHaveBeenCalledTimes(1)
    expect(mockWithTags).not.toHaveBeenCalledWith(['best-practice'])
    expect(mockWithTags).toHaveBeenCalledWith(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
  })

  it('always uses expect.soft() for best-practice so WCAG scan runs even in hard mode', async () => {
    const testInfo = makeTestInfo()
    await checkAccessibility({} as any, testInfo as any, {
      bestPracticeMode: 'hard',
    })

    // Best-practice always uses expect.soft() so the WCAG scan is never blocked
    expect(mockExpectSoft).toHaveBeenCalled()
    // WCAG uses expect() (hard)
    expect(mockExpectHard).toHaveBeenCalled()
  })

  it('uses expect.soft() when bestPracticeMode is soft (default)', async () => {
    const testInfo = makeTestInfo()
    await checkAccessibility({} as any, testInfo as any)

    // Best-practice scan should use expect.soft()
    expect(mockExpectSoft).toHaveBeenCalled()
  })

  it('does not call .exclude() with Drupal selectors when disableDefaultExclusions is true', async () => {
    const testInfo = makeTestInfo()
    await checkAccessibility({} as any, testInfo as any, {
      disableDefaultExclusions: true,
    })

    expect(mockExclude).not.toHaveBeenCalledWith('.focusable.skip-link')
    expect(mockExclude).not.toHaveBeenCalledWith('[role="article"]')
    expect(mockExclude).not.toHaveBeenCalledWith('[role="region"]')
    expect(mockExclude).not.toHaveBeenCalledWith('.footer__inner-3')
    expect(mockExclude).not.toHaveBeenCalledWith('[data-drupal-media-preview="ready"]')
  })

  it('calls .exclude() with Drupal selectors by default', async () => {
    const testInfo = makeTestInfo()
    await checkAccessibility({} as any, testInfo as any)

    expect(mockExclude).toHaveBeenCalledWith('.focusable.skip-link')
    expect(mockExclude).toHaveBeenCalledWith('[role="article"]')
    expect(mockExclude).toHaveBeenCalledWith('[role="region"]')
    expect(mockExclude).toHaveBeenCalledWith('.footer__inner-3')
    expect(mockExclude).toHaveBeenCalledWith('[data-drupal-media-preview="ready"]')
  })

  it('passes rules to AxeBuilder .options()', async () => {
    const testInfo = makeTestInfo()
    const rules = { 'color-contrast': { enabled: false } }
    await checkAccessibility({} as any, testInfo as any, { rules })

    expect(mockOptions).toHaveBeenCalledWith({ rules })
    // Called twice: once for best-practice, once for WCAG
    expect(mockOptions).toHaveBeenCalledTimes(2)
  })

  it('pushes @a11y annotation and deduplicates on second call', async () => {
    const testInfo = makeTestInfo()

    await checkAccessibility({} as any, testInfo as any)
    const a11yAnnotations = testInfo.annotations.filter((a: any) => a.type === '@a11y')
    expect(a11yAnnotations).toHaveLength(1)

    // Call again — should not duplicate
    await checkAccessibility({} as any, testInfo as any)
    const a11yAnnotationsAfter = testInfo.annotations.filter((a: any) => a.type === '@a11y')
    expect(a11yAnnotationsAfter).toHaveLength(1)
  })

  it('pushes summary annotations after each scan', async () => {
    const bestPracticeResults = makeAxeResults({
      violations: [{ id: 'rule1', nodes: [] }],
      passes: [{ id: 'rule2' }, { id: 'rule3' }],
    })
    const wcagResults = makeAxeResults({
      violations: [],
      passes: [{ id: 'rule4' }],
    })

    mockAnalyze
      .mockResolvedValueOnce(bestPracticeResults)
      .mockResolvedValueOnce(wcagResults)

    const testInfo = makeTestInfo()
    await checkAccessibility({} as any, testInfo as any)

    const accessibilityAnnotations = testInfo.annotations.filter((a: any) => a.type === 'Accessibility')
    expect(accessibilityAnnotations).toHaveLength(2)
    expect(accessibilityAnnotations[0].description).toBe('Best-practice scan: 1 violations (2 rules passed)')
    expect(accessibilityAnnotations[1].description).toBe('WCAG scan: 0 violations (1 rules passed)')
  })

  it('skips best-practice summary annotation when bestPracticeMode is off', async () => {
    const testInfo = makeTestInfo()
    await checkAccessibility({} as any, testInfo as any, {
      bestPracticeMode: 'off',
    })

    const accessibilityAnnotations = testInfo.annotations.filter((a: any) => a.type === 'Accessibility')
    expect(accessibilityAnnotations).toHaveLength(1)
    expect(accessibilityAnnotations[0].description).toContain('WCAG scan')
  })

  it('attaches a violation screenshot when screenshotViolations is true and violations exist', async () => {
    const wcagResults = makeAxeResults({
      violations: [{
        id: 'color-contrast',
        description: 'test',
        impact: 'serious',
        helpUrl: 'https://example.com',
        nodes: [{ target: ['.bad-element'] }],
      }],
    })

    mockAnalyze
      .mockResolvedValueOnce(makeAxeResults()) // best-practice
      .mockResolvedValueOnce(wcagResults)       // WCAG

    const mockPage = {
      // First evaluate: inject styles + return bounding rect (null = no elements found).
      // Second evaluate: remove styles.
      evaluate: vi.fn().mockResolvedValue(null),
      screenshot: vi.fn().mockResolvedValue(Buffer.from('fake-png')),
    }
    const testInfo = makeTestInfo()

    await checkAccessibility(mockPage as any, testInfo as any, {
      screenshotViolations: true,
    })

    // Should have injected highlight styles (combined with bounds) and then removed them.
    expect(mockPage.evaluate).toHaveBeenCalledTimes(2)
    // When no bounding rect is found, falls back to full-page screenshot.
    expect(mockPage.screenshot).toHaveBeenCalledWith({ fullPage: true })
    // Should have attached the screenshot.
    expect(testInfo.attach).toHaveBeenCalledWith('a11y-violation-screenshot', {
      body: Buffer.from('fake-png'),
      contentType: 'image/png',
    })
  })

  it('crops screenshot to violation bounding rect when elements are found', async () => {
    const wcagResults = makeAxeResults({
      violations: [{
        id: 'color-contrast',
        description: 'test',
        impact: 'serious',
        helpUrl: 'https://example.com',
        nodes: [{ target: ['.bad-element'] }],
      }],
    })

    mockAnalyze
      .mockResolvedValueOnce(makeAxeResults()) // best-practice
      .mockResolvedValueOnce(wcagResults)       // WCAG

    const mockPage = {
      // First evaluate: inject styles + return bounding rect of violation elements.
      // Second evaluate: remove styles.
      evaluate: vi.fn()
        .mockResolvedValueOnce({ x: 50, y: 200, width: 400, height: 80 })
        .mockResolvedValue(null),
      screenshot: vi.fn().mockResolvedValue(Buffer.from('fake-png')),
    }
    const testInfo = makeTestInfo()

    await checkAccessibility(mockPage as any, testInfo as any, {
      screenshotViolations: true,
    })

    // Should have taken a cropped screenshot with padding applied.
    expect(mockPage.screenshot).toHaveBeenCalledWith({
      clip: {
        x: expect.any(Number),
        y: expect.any(Number),
        width: expect.any(Number),
        height: expect.any(Number),
      },
    })
    const callArgs = mockPage.screenshot.mock.calls[0][0]
    // x should be clamped to 0 (50 - 100 padding = -50 → 0).
    expect(callArgs.clip.x).toBe(0)
    // y should be 200 - 100 padding = 100.
    expect(callArgs.clip.y).toBe(100)
    // width should be 400 + 200 (2× padding).
    expect(callArgs.clip.width).toBe(600)
    // height should be 80 + 200 (2× padding).
    expect(callArgs.clip.height).toBe(280)
  })

  it('does not take a screenshot when screenshotViolations is true but no violations', async () => {
    const mockPage = {
      evaluate: vi.fn(),
      screenshot: vi.fn(),
    }
    const testInfo = makeTestInfo()

    await checkAccessibility(mockPage as any, testInfo as any, {
      screenshotViolations: true,
    })

    expect(mockPage.screenshot).not.toHaveBeenCalled()
  })

  it('takes a screenshot by default when violations exist', async () => {
    const wcagResults = makeAxeResults({
      violations: [{
        id: 'color-contrast',
        description: 'test',
        impact: 'serious',
        helpUrl: 'https://example.com',
        nodes: [{ target: ['.bad-element'] }],
      }],
    })

    mockAnalyze
      .mockResolvedValueOnce(makeAxeResults()) // best-practice
      .mockResolvedValueOnce(wcagResults)       // WCAG

    const mockPage = {
      evaluate: vi.fn().mockResolvedValue(null),
      screenshot: vi.fn().mockResolvedValue(Buffer.from('fake-png')),
    }
    const testInfo = makeTestInfo()

    await checkAccessibility(mockPage as any, testInfo as any)

    // No bounding rect found → falls back to full-page screenshot.
    expect(mockPage.screenshot).toHaveBeenCalledWith({ fullPage: true })
  })

  it('does not take a screenshot when screenshotViolations is explicitly false', async () => {
    const wcagResults = makeAxeResults({
      violations: [{
        id: 'color-contrast',
        description: 'test',
        impact: 'serious',
        helpUrl: 'https://example.com',
        nodes: [{ target: ['.bad-element'] }],
      }],
    })

    mockAnalyze
      .mockResolvedValueOnce(makeAxeResults()) // best-practice
      .mockResolvedValueOnce(wcagResults)       // WCAG

    const mockPage = {
      evaluate: vi.fn(),
      screenshot: vi.fn(),
    }
    const testInfo = makeTestInfo()

    await checkAccessibility(mockPage as any, testInfo as any, {
      screenshotViolations: false,
    })

    expect(mockPage.screenshot).not.toHaveBeenCalled()
  })
})
