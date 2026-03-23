import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import os from 'os'

// Mock @playwright/test so defineConfig just returns whatever is passed in.
vi.mock('@playwright/test', () => ({
  defineConfig: (config: any) => config,
}))

describe('definePlaywrightDrupalConfig', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    // Reset module cache so each test gets fresh env reads.
    vi.resetModules()
    // Clear CI and DDEV_PRIMARY_URL before each test.
    delete process.env.CI
    delete process.env.DDEV_PRIMARY_URL
  })

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  async function loadConfig(overrides = {}) {
    const { definePlaywrightDrupalConfig } = await import('./config')
    return definePlaywrightDrupalConfig(overrides)
  }

  it('applies default values when no overrides provided', async () => {
    const config = await loadConfig()
    expect(config).toHaveProperty('fullyParallel', true)
    expect(config).toHaveProperty('workers')
    expect(config).toHaveProperty('reporter')
    expect(config).toHaveProperty('globalSetup')
    expect(config).toHaveProperty('use')
  })

  it('sets CI reporter when process.env.CI is set', async () => {
    process.env.CI = 'true'
    const config = await loadConfig()
    expect(config.reporter).toEqual([['line'], ['html']])
  })

  it('sets local reporter when CI is not set', async () => {
    delete process.env.CI
    const config = await loadConfig()
    expect(config.reporter).toEqual([['html', { host: '0.0.0.0', port: 9323 }], ['list']])
  })

  it('defaults use.baseURL to process.env.DDEV_PRIMARY_URL', async () => {
    process.env.DDEV_PRIMARY_URL = 'https://my-site.ddev.site'
    const config = await loadConfig()
    expect(config.use?.baseURL).toBe('https://my-site.ddev.site')
  })

  it('leaves use.baseURL undefined when DDEV_PRIMARY_URL is not set', async () => {
    delete process.env.DDEV_PRIMARY_URL
    const config = await loadConfig()
    expect(config.use?.baseURL).toBeUndefined()
  })

  it('allows user overrides to fully replace defaults (shallow merge)', async () => {
    const config = await loadConfig({ reporter: 'dot' })
    expect(config.reporter).toBe('dot')
  })

  it('resolves globalSetup to a path ending in setup/global-setup.js', async () => {
    const config = await loadConfig()
    expect(config.globalSetup).toMatch(/setup[/\\]global-setup\.js$/)
  })

  it('passes through unknown properties', async () => {
    const config = await loadConfig({ retries: 3 })
    expect(config).toHaveProperty('retries', 3)
  })

  it('sets workers to at least 2', async () => {
    const config = await loadConfig()
    const expected = Math.max(2, os.cpus().length - 2)
    expect(config.workers).toBe(expected)
    expect(config.workers).toBeGreaterThanOrEqual(2)
  })

  it('allows overriding workers', async () => {
    const config = await loadConfig({ workers: 1 })
    expect(config.workers).toBe(1)
  })

  it('allows overriding globalSetup', async () => {
    const config = await loadConfig({ globalSetup: './my-setup.ts' })
    expect(config.globalSetup).toBe('./my-setup.ts')
  })

  it('sets fullyParallel to true by default', async () => {
    const config = await loadConfig()
    expect(config.fullyParallel).toBe(true)
  })

  it('allows overriding fullyParallel', async () => {
    const config = await loadConfig({ fullyParallel: false })
    expect(config.fullyParallel).toBe(false)
  })

  it('deep-merges user use overrides with default use', async () => {
    process.env.DDEV_PRIMARY_URL = 'https://my-site.ddev.site'
    const config = await loadConfig({ use: { ignoreHTTPSErrors: true } })
    // Default baseURL should be preserved.
    expect(config.use?.baseURL).toBe('https://my-site.ddev.site')
    // User override should be present.
    expect(config.use?.ignoreHTTPSErrors).toBe(true)
  })

  it('allows overriding use.baseURL', async () => {
    process.env.DDEV_PRIMARY_URL = 'https://my-site.ddev.site'
    const config = await loadConfig({ use: { baseURL: 'https://custom.site' } })
    expect(config.use?.baseURL).toBe('https://custom.site')
  })

  it('deep-merges any plain-object overrides with defaults', async () => {
    process.env.DDEV_PRIMARY_URL = 'https://my-site.ddev.site'
    const config = await loadConfig({ expect: { timeout: 10000 } })
    // use defaults should still be present.
    expect(config.use?.baseURL).toBe('https://my-site.ddev.site')
    // expect override should be present.
    expect(config.expect?.timeout).toBe(10000)
  })
})
