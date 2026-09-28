import { describe, it, expect, vi, beforeEach } from 'vitest'
import { defaultTestFunction, VisualDiff, VisualDiffGroup, VisualDiffUrlConfig } from './visualdiff'

// Mock takeAccessibleScreenshot to capture the options passed to it.
const mockTakeAccessibleScreenshot = vi.fn()
const mockForcePseudoState = vi.fn()
vi.mock('../util', () => ({
  takeAccessibleScreenshot: (...args: any[]) => mockTakeAccessibleScreenshot(...args),
  forcePseudoState: (...args: any[]) => mockForcePseudoState(...args),
}))

function makeTestCase(overrides?: Partial<VisualDiff>): VisualDiff {
  return {
    name: 'Test',
    path: '/test',
    ...overrides,
  }
}

function makeGroup(overrides?: Partial<VisualDiffGroup>): VisualDiffGroup {
  return {
    name: 'Group',
    testCases: [],
    ...overrides,
  }
}

function makeConfig(overrides?: Partial<VisualDiffUrlConfig>): VisualDiffUrlConfig {
  return {
    name: 'Config',
    groups: [],
    ...overrides,
  }
}

/**
 * Execute the function returned by defaultTestFunction with mock page/context/testInfo.
 */
async function runDefaultTestFunction(
  testCase: VisualDiff,
  group: VisualDiffGroup,
  config?: VisualDiffUrlConfig,
) {
  const fn = defaultTestFunction(testCase, group, config)
  const mockLocator = vi.fn((selector: string) => ({ _selector: selector }))
  const mockPage = {
    goto: vi.fn(),
    locator: mockLocator,
  }
  const mockContext = {
    on: vi.fn(),
  }
  const mockTestInfo = {
    annotations: [],
  }
  await fn({ page: mockPage, context: mockContext }, mockTestInfo)
  return { mockPage, mockTestInfo }
}

describe('defaultTestFunction mask merging', () => {
  beforeEach(() => {
    mockTakeAccessibleScreenshot.mockReset()
    mockForcePseudoState.mockReset()
  })

  it('merges masks from all three levels', async () => {
    const config = makeConfig({ mask: ['.config-mask'] })
    const group = makeGroup({ mask: ['.group-mask'] })
    const testCase = makeTestCase({ mask: ['.test-mask'] })

    await runDefaultTestFunction(testCase, group, config)

    const options = mockTakeAccessibleScreenshot.mock.calls[0][2]
    expect(options.mask).toHaveLength(3)
    expect(options.mask[0]).toEqual({ _selector: '.config-mask' })
    expect(options.mask[1]).toEqual({ _selector: '.group-mask' })
    expect(options.mask[2]).toEqual({ _selector: '.test-mask' })
  })

  it('works with masks from a single level', async () => {
    const group = makeGroup({ mask: ['.only-group'] })
    const testCase = makeTestCase()

    await runDefaultTestFunction(testCase, group)

    const options = mockTakeAccessibleScreenshot.mock.calls[0][2]
    expect(options.mask).toHaveLength(1)
    expect(options.mask[0]).toEqual({ _selector: '.only-group' })
  })

  it('handles empty/undefined masks at some levels', async () => {
    const config = makeConfig({ mask: ['.config-a', '.config-b'] })
    const group = makeGroup() // no mask
    const testCase = makeTestCase({ mask: ['.test-only'] })

    await runDefaultTestFunction(testCase, group, config)

    const options = mockTakeAccessibleScreenshot.mock.calls[0][2]
    expect(options.mask).toHaveLength(3)
    expect(options.mask[0]).toEqual({ _selector: '.config-a' })
    expect(options.mask[1]).toEqual({ _selector: '.config-b' })
    expect(options.mask[2]).toEqual({ _selector: '.test-only' })
  })

  it('does not include mask property when no masks are defined', async () => {
    const testCase = makeTestCase()
    const group = makeGroup()

    await runDefaultTestFunction(testCase, group)

    const options = mockTakeAccessibleScreenshot.mock.calls[0][2]
    expect(options.mask).toBeUndefined()
    expect(options.fullPage).toBe(true)
  })

  it('resolves maskColor with most-specific-wins: testCase > group > config', async () => {
    const config = makeConfig({ maskColor: '#111' })
    const group = makeGroup({ maskColor: '#222' })
    const testCase = makeTestCase({ maskColor: '#333' })

    await runDefaultTestFunction(testCase, group, config)

    const options = mockTakeAccessibleScreenshot.mock.calls[0][2]
    expect(options.maskColor).toBe('#333')
  })

  it('falls back maskColor to group when testCase is undefined', async () => {
    const config = makeConfig({ maskColor: '#111' })
    const group = makeGroup({ maskColor: '#222' })
    const testCase = makeTestCase()

    await runDefaultTestFunction(testCase, group, config)

    const options = mockTakeAccessibleScreenshot.mock.calls[0][2]
    expect(options.maskColor).toBe('#222')
  })

  it('falls back maskColor to config when testCase and group are undefined', async () => {
    const config = makeConfig({ maskColor: '#111' })
    const group = makeGroup()
    const testCase = makeTestCase()

    await runDefaultTestFunction(testCase, group, config)

    const options = mockTakeAccessibleScreenshot.mock.calls[0][2]
    expect(options.maskColor).toBe('#111')
  })

  it('does not include maskColor when none are defined', async () => {
    const testCase = makeTestCase()
    const group = makeGroup()

    await runDefaultTestFunction(testCase, group)

    const options = mockTakeAccessibleScreenshot.mock.calls[0][2]
    expect(options.maskColor).toBeUndefined()
  })
})

describe('defaultTestFunction pseudo-state handling', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockForcePseudoState.mockImplementation(async () => vi.fn())
  })

  it('merges pseudo-states from all three levels and keeps them through the scan', async () => {
    const clearConfigState = vi.fn()
    const clearGroupState = vi.fn()
    const clearTestState = vi.fn()
    mockForcePseudoState
      .mockResolvedValueOnce(clearConfigState)
      .mockResolvedValueOnce(clearGroupState)
      .mockResolvedValueOnce(clearTestState)
    const config = makeConfig({
      pseudoStates: [{selector: '.nav', pseudoClasses: ['hover']}],
    })
    const group = makeGroup({
      pseudoStates: [{selector: '.menu', pseudoClasses: ['focus-within']}],
    })
    const testCase = makeTestCase({
      pseudoStates: [{selector: '.link', pseudoClasses: ['focus-visible']}],
    })

    const {mockPage} = await runDefaultTestFunction(testCase, group, config)

    expect(mockForcePseudoState.mock.calls).toEqual([
      [mockPage, '.nav', ['hover']],
      [mockPage, '.menu', ['focus-within']],
      [mockPage, '.link', ['focus-visible']],
    ])
    expect(mockTakeAccessibleScreenshot).toHaveBeenCalledOnce()
    expect(clearTestState.mock.invocationCallOrder[0])
      .toBeGreaterThan(mockTakeAccessibleScreenshot.mock.invocationCallOrder[0])
    expect(clearTestState.mock.invocationCallOrder[0])
      .toBeLessThan(clearGroupState.mock.invocationCallOrder[0])
    expect(clearGroupState.mock.invocationCallOrder[0])
      .toBeLessThan(clearConfigState.mock.invocationCallOrder[0])
  })

  it('clears forced states when the screenshot or accessibility scan fails', async () => {
    const clearState = vi.fn()
    mockForcePseudoState.mockResolvedValueOnce(clearState)
    mockTakeAccessibleScreenshot.mockRejectedValueOnce(new Error('scan failed'))
    const testCase = makeTestCase({
      pseudoStates: [{selector: 'button', pseudoClasses: ['focus']}],
    })

    await expect(runDefaultTestFunction(testCase, makeGroup())).rejects.toThrow('scan failed')

    expect(clearState).toHaveBeenCalledOnce()
  })
})

describe('defaultTestFunction interaction-state handling', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('merges cross-browser interaction states from all three levels', async () => {
    const config = makeConfig({
      interactionStates: [{selector: '.nav', states: ['hover']}],
    })
    const group = makeGroup({
      interactionStates: [{selector: '.menu-item', states: ['focus']}],
    })
    const testCase = makeTestCase({
      interactionStates: [{selector: '.trigger', states: ['hover', 'focus']}],
    })

    const {mockPage} = await runDefaultTestFunction(testCase, group, config)

    expect(mockTakeAccessibleScreenshot.mock.calls[0][2].interactionStates).toEqual([
      {locator: {_selector: '.nav'}, states: ['hover']},
      {locator: {_selector: '.menu-item'}, states: ['focus']},
      {locator: {_selector: '.trigger'}, states: ['hover', 'focus']},
    ])
    expect(mockPage.locator).toHaveBeenCalledWith('.nav')
    expect(mockPage.locator).toHaveBeenCalledWith('.menu-item')
    expect(mockPage.locator).toHaveBeenCalledWith('.trigger')
  })

  it('omits interactionStates when none are configured', async () => {
    await runDefaultTestFunction(makeTestCase(), makeGroup())

    expect(mockTakeAccessibleScreenshot.mock.calls[0][2].interactionStates).toBeUndefined()
  })
})
