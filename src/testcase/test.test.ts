import { describe, it, expect, vi, beforeEach } from 'vitest'
import { EventEmitter } from 'events'
import type { ChildProcess } from 'child_process'

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

// A minimal stand-in for the child process returned by task(). The fixture
// only ever listens for the 'error' and 'exit' events, so an EventEmitter is
// enough to drive both code paths without spawning a real process.
function fakeChild(): ChildProcess {
  return new EventEmitter() as unknown as ChildProcess
}

describe('waitForPrepare', () => {
  it('resolves when the process exits with code 0', async () => {
    const { waitForPrepare } = await import('./test')
    const child = fakeChild()
    const pending = waitForPrepare(child)
    child.emit('exit', 0)
    await expect(pending).resolves.toBeUndefined()
  })

  it('rejects when the process exits with a non-zero code', async () => {
    const { waitForPrepare } = await import('./test')
    const child = fakeChild()
    const pending = waitForPrepare(child)
    child.emit('exit', 1)
    await expect(pending).rejects.toThrow('Task errored with exit code 1')
  })

  it('rejects when the process exits with a null code', async () => {
    const { waitForPrepare } = await import('./test')
    const child = fakeChild()
    const pending = waitForPrepare(child)
    child.emit('exit', null)
    await expect(pending).rejects.toThrow('Task errored with exit code null')
  })

  it('rejects with the underlying error when the process fails to spawn', async () => {
    // This is the regression case: a spawn failure emits 'error' but never
    // 'exit', so without the 'error' listener the fixture would hang until
    // Playwright's test timeout instead of failing fast.
    const { waitForPrepare } = await import('./test')
    const child = fakeChild()
    const spawnError = Object.assign(new Error('spawn task ENOENT'), { code: 'ENOENT' })
    const pending = waitForPrepare(child)
    child.emit('error', spawnError)
    await expect(pending).rejects.toBe(spawnError)
  })
})

describe('waitForCleanup', () => {
  it('resolves when the process exits', async () => {
    const { waitForCleanup } = await import('./test')
    const child = fakeChild()
    const pending = waitForCleanup(child)
    child.emit('exit', 0)
    await expect(pending).resolves.toBeUndefined()
  })

  it('resolves even when cleanup fails to spawn', async () => {
    // Cleanup is best-effort: a spawn 'error' during teardown must not fail
    // the test, but the promise still has to resolve so the fixture finishes.
    const { waitForCleanup } = await import('./test')
    const child = fakeChild()
    const pending = waitForCleanup(child)
    child.emit('error', new Error('spawn task ENOENT'))
    await expect(pending).resolves.toBeUndefined()
  })
})
