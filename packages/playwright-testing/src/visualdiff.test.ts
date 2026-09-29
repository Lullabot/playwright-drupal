import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  defaultTestFunction,
  defineVisualDiffConfig,
  VisualDiff,
  VisualDiffGroup,
  VisualDiffTestCases,
  VisualDiffUrlConfig,
} from './visualdiff'

const {mockTest, mockDescribe, mockSkip} = vi.hoisted(() => {
  const mockTest = vi.fn()
  const mockDescribe = vi.fn((_name: string, callback: () => void) => callback())
  const mockSkip = vi.fn()
  return {mockTest, mockDescribe, mockSkip}
})

vi.mock('@playwright/test', () => ({
  test: Object.assign(mockTest, {describe: mockDescribe, skip: mockSkip}),
}))

// Mock takeAccessibleScreenshot to capture the options passed to it.
const mockTakeAccessibleScreenshot = vi.fn()
const mockForcePseudoState = vi.fn()
vi.mock('./accessible-screenshot', () => ({
  takeAccessibleScreenshot: (...args: any[]) => mockTakeAccessibleScreenshot(...args),
}))
vi.mock('./pseudo-state', () => ({
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
  preset?: Parameters<typeof defaultTestFunction>[3],
) {
  const fn = defaultTestFunction(testCase, group, config, preset)
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

  it('attempts every cleanup in reverse order when one cleanup fails', async () => {
    const events: string[] = []
    const clearConfigState = vi.fn(async () => { events.push('config') })
    const clearGroupState = vi.fn(async () => {
      events.push('group')
      throw new Error('group cleanup failed')
    })
    const clearTestState = vi.fn(async () => { events.push('test') })
    mockForcePseudoState
      .mockResolvedValueOnce(clearConfigState)
      .mockResolvedValueOnce(clearGroupState)
      .mockResolvedValueOnce(clearTestState)

    await expect(runDefaultTestFunction(
      makeTestCase({pseudoStates: [{selector: '.test', pseudoClasses: ['hover']}]}),
      makeGroup({pseudoStates: [{selector: '.group', pseudoClasses: ['focus']}]}),
      makeConfig({pseudoStates: [{selector: '.config', pseudoClasses: ['active']}]}),
    )).rejects.toThrow('group cleanup failed')

    expect(events).toEqual(['test', 'group', 'config'])
  })
})

describe('defaultTestFunction precedence and preset injection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockForcePseudoState.mockImplementation(async () => vi.fn())
  })

  it('combines config and group path prefixes and uses the most specific representative URL', async () => {
    const config = makeConfig({pathPrefix: '/site', representativeUrl: 'https://example.com/config'} as any)
    const group = makeGroup({pathPrefix: '/section', representativeUrl: 'https://example.com/group'})
    const testCase = makeTestCase({path: '/page', representativeUrl: 'https://example.com/case'})

    const {mockPage, mockTestInfo} = await runDefaultTestFunction(testCase, group, config)

    expect(mockPage.goto).toHaveBeenCalledWith('/site/section/page')
    expect(mockTestInfo.annotations).toContainEqual({
      type: 'Representative URL',
      description: 'https://example.com/case',
    })
  })

  it('uses the most specific accessibility baseline and merges it with preset options', async () => {
    const configBaseline = [{rule: 'config', targets: ['#config'], reason: 'Known', willBeFixedIn: 'PROJ-1'}]
    const groupBaseline = [{rule: 'group', targets: ['#group'], reason: 'Known', willBeFixedIn: 'PROJ-2'}]
    const caseBaseline = [{rule: 'case', targets: ['#case'], reason: 'Known', willBeFixedIn: 'PROJ-3'}]
    const preset = {
      screenshotOptions: vi.fn().mockResolvedValue({
        threshold: 0.4,
        accessibility: {wcagExclude: ['.adapter-owned']},
      }),
    }

    await runDefaultTestFunction(
      makeTestCase({a11yBaseline: caseBaseline} as any),
      makeGroup({a11yBaseline: groupBaseline} as any),
      makeConfig({a11yBaseline: configBaseline}),
      preset,
    )

    const options = mockTakeAccessibleScreenshot.mock.calls[0][2]
    expect(options.threshold).toBe(0.4)
    expect(options.accessibility).toEqual({
      wcagExclude: ['.adapter-owned'],
      baseline: caseBaseline,
    })
  })

  it('falls back to group-level representative URL and accessibility baseline', async () => {
    const configBaseline = [{rule: 'config', targets: ['#config'], reason: 'Known', willBeFixedIn: 'PROJ-1'}]
    const groupBaseline = [{rule: 'group', targets: ['#group'], reason: 'Known', willBeFixedIn: 'PROJ-2'}]

    const {mockTestInfo} = await runDefaultTestFunction(
      makeTestCase(),
      makeGroup({
        representativeUrl: 'https://example.com/group',
        a11yBaseline: groupBaseline,
      }),
      makeConfig({
        representativeUrl: 'https://example.com/config',
        a11yBaseline: configBaseline,
      }),
    )

    expect(mockTestInfo.annotations).toContainEqual({
      type: 'Representative URL',
      description: 'https://example.com/group',
    })
    expect(mockTakeAccessibleScreenshot.mock.calls[0][2].accessibility.baseline)
      .toBe(groupBaseline)
  })

  it('installs a case mock before navigation', async () => {
    const mock = vi.fn().mockResolvedValue(undefined)
    class CaseMock { mock = mock }

    const {mockPage} = await runDefaultTestFunction(
      makeTestCase({mockClass: CaseMock}),
      makeGroup(),
    )

    expect(mock).toHaveBeenCalledWith(mockPage)
    expect(mock.mock.invocationCallOrder[0]).toBeLessThan(mockPage.goto.mock.invocationCallOrder[0])
  })

  it('falls back to a group mock when a case does not define one', async () => {
    const mock = vi.fn().mockResolvedValue(undefined)
    class GroupMock { mock = mock }

    const {mockPage} = await runDefaultTestFunction(
      makeTestCase(),
      makeGroup({mockClass: GroupMock}),
    )

    expect(mock).toHaveBeenCalledWith(mockPage)
  })

  it('forwards defineVisualDiffConfig preset options into generated tests', async () => {
    const preset = {screenshotOptions: {threshold: 0.25}}
    const visualTests = defineVisualDiffConfig(makeConfig({
      groups: [makeGroup({testCases: [makeTestCase()]})],
    }), preset)
    visualTests.describe()

    const generatedTest = mockTest.mock.calls[0][1]
    const page = {goto: vi.fn(), locator: vi.fn()}
    const context = {on: vi.fn()}
    const testInfo = {annotations: []}
    await generatedTest({page, context}, testInfo)

    expect(mockTakeAccessibleScreenshot.mock.calls[0][2]).toMatchObject({
      fullPage: true,
      threshold: 0.25,
    })
  })
})

describe('VisualDiffTestCases.describe skip semantics', () => {
  beforeEach(() => vi.clearAllMocks())

  it('registers skipped groups and cases with their reason and tracking reference', () => {
    const config = makeConfig({groups: [
      makeGroup({
        name: 'Skipped group',
        skip: {reason: 'Unavailable', willBeFixedIn: 'PROJ-10'},
      }),
      makeGroup({
        name: 'Active group',
        testCases: [makeTestCase({
          name: 'Skipped case',
          skip: {reason: 'Flaky', willBeFixedIn: 'PROJ-11'},
        })],
      }),
    ]})

    const visualTests = new VisualDiffTestCases(config)
    visualTests.describe()

    expect(mockSkip).toHaveBeenCalledWith(
      'Skipped group: Unavailable <PROJ-10>',
      expect.any(Function),
    )
    expect(mockSkip).toHaveBeenCalledWith(
      'Skipped case: Flaky <PROJ-11>',
      expect.any(Function),
    )
  })

  it('defines a test when a conditional skip callback returns false', () => {
    const config = makeConfig({groups: [makeGroup({
      name: 'Conditional group',
      skip: {reason: 'Conditional', willBeFixedIn: 'PROJ-12', callback: () => false},
      testCases: [makeTestCase()],
    })]})

    const visualTests = new VisualDiffTestCases(config)
    visualTests.describe()

    expect(mockSkip).not.toHaveBeenCalled()
    expect(mockDescribe).toHaveBeenCalledWith('Conditional group', expect.any(Function))
    expect(mockTest).toHaveBeenCalledWith('Test: /test', expect.any(Function))
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
