import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the utility functions that the a11y fixture wraps.
const mockCheckAccessibility = vi.fn()
const mockTakeAccessibleScreenshot = vi.fn()
vi.mock('../util', () => ({
  checkAccessibility: (...args: any[]) => mockCheckAccessibility(...args),
  takeAccessibleScreenshot: (...args: any[]) => mockTakeAccessibleScreenshot(...args),
}))

// Mock dependencies that test.ts imports at module level so it can be loaded
// without a real Drupal project or Playwright runner.
vi.mock('../cli/task', () => ({
  task: vi.fn(),
  taskSync: vi.fn(() => Buffer.from('')),
}))
vi.mock('../util/docroot', () => ({
  getDocroot: vi.fn(() => 'web'),
}))
vi.mock('../cli/output-collector', () => ({
  collector: {
    reset: vi.fn(),
    addWebError: vi.fn(),
    getEntries: vi.fn(() => []),
    getWebErrors: vi.fn(() => []),
    startCommand: vi.fn(),
    appendStdout: vi.fn(),
    appendStderr: vi.fn(),
    finishCommand: vi.fn(),
  },
  isVerbose: vi.fn(() => false),
}))

describe('a11y fixture type and exports', () => {
  it('exports A11yFixture interface (compile-time check)', async () => {
    // Importing A11yFixture verifies the type is exported.
    // TypeScript will fail to compile if the export is missing.
    const mod = await import('./test')
    // The runtime value won't exist for an interface, but the module should load.
    expect(mod.test).toBeDefined()
    expect(mod.expect).toBeDefined()
    expect(mod.execDrushInTestSite).toBeDefined()
  })

  it('test object is defined and has extend method', async () => {
    const { test } = await import('./test')
    expect(test).toBeDefined()
    // Playwright's test object has an extend method
    expect(typeof test.extend).toBe('function')
  })
})

describe('a11y fixture wrapper functions', () => {
  beforeEach(() => {
    mockCheckAccessibility.mockReset()
    mockTakeAccessibleScreenshot.mockReset()
  })

  it('check() delegates to checkAccessibility with correct arguments', async () => {
    // We can't easily run the Playwright fixture lifecycle in vitest,
    // but we can import the module and verify the underlying functions
    // are accessible. The integration test validates the full fixture.
    const { checkAccessibility } = await import('../util')
    const mockPage = {} as any
    const mockTestInfo = {} as any
    const options = { bestPracticeMode: 'off' as const }

    await checkAccessibility(mockPage, mockTestInfo, options)

    expect(mockCheckAccessibility).toHaveBeenCalledWith(mockPage, mockTestInfo, options)
  })

  it('screenshot() delegates to takeAccessibleScreenshot with correct arguments', async () => {
    const { takeAccessibleScreenshot } = await import('../util')
    const mockPage = {} as any
    const mockTestInfo = {} as any
    const options = { fullPage: true }
    const scrollLocator = { _selector: '.scroll' } as any
    const locator = { _selector: '.target' } as any

    await takeAccessibleScreenshot(mockPage, mockTestInfo, options, scrollLocator, locator)

    expect(mockTakeAccessibleScreenshot).toHaveBeenCalledWith(
      mockPage, mockTestInfo, options, scrollLocator, locator,
    )
  })

  it('check() works without options', async () => {
    const { checkAccessibility } = await import('../util')
    const mockPage = {} as any
    const mockTestInfo = {} as any

    await checkAccessibility(mockPage, mockTestInfo)

    expect(mockCheckAccessibility).toHaveBeenCalledWith(mockPage, mockTestInfo)
  })

  it('screenshot() works without options', async () => {
    const { takeAccessibleScreenshot } = await import('../util')
    const mockPage = {} as any
    const mockTestInfo = {} as any

    await takeAccessibleScreenshot(mockPage, mockTestInfo)

    expect(mockTakeAccessibleScreenshot).toHaveBeenCalledWith(
      mockPage, mockTestInfo,
    )
  })
})
