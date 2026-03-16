import { describe, it, expect, vi, beforeEach } from 'vitest'
import { defaultTestFunction, VisualDiff, VisualDiffGroup, VisualDiffUrlConfig } from './visualdiff'

// Mock takeAccessibleScreenshot to capture the options passed to it.
const mockTakeAccessibleScreenshot = vi.fn()
vi.mock('../util', () => ({
  takeAccessibleScreenshot: (...args: any[]) => mockTakeAccessibleScreenshot(...args),
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
