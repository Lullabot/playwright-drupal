import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { OutputCollector, isVerbose, sanitizeLabel } from './output-collector'

describe('OutputCollector', () => {
  let oc: OutputCollector

  beforeEach(() => {
    oc = new OutputCollector()
  })

  it('collects a complete command lifecycle', () => {
    oc.startCommand('drush status')
    oc.appendStdout('line 1\n')
    oc.appendStdout('line 2\n')
    oc.appendStderr('warning\n')
    oc.finishCommand()

    const entries = oc.getEntries()
    expect(entries).toHaveLength(1)
    expect(entries[0].label).toBe('drush-status')
    expect(entries[0].stdout).toBe('line 1\nline 2\n')
    expect(entries[0].stderr).toBe('warning\n')
  })

  it('collects multiple commands in order', () => {
    oc.startCommand('cmd-one')
    oc.appendStdout('first')
    oc.finishCommand()

    oc.startCommand('cmd-two')
    oc.appendStdout('second')
    oc.finishCommand()

    const entries = oc.getEntries()
    expect(entries).toHaveLength(2)
    expect(entries[0].label).toBe('cmd-one')
    expect(entries[1].label).toBe('cmd-two')
  })

  it('ignores append calls when no command is started', () => {
    oc.appendStdout('orphan stdout')
    oc.appendStderr('orphan stderr')
    expect(oc.getEntries()).toHaveLength(0)
  })

  it('finishCommand is a no-op when no command is active', () => {
    oc.finishCommand()
    expect(oc.getEntries()).toHaveLength(0)
  })

  it('tracks web errors separately from command output', () => {
    oc.addWebError('Uncaught TypeError')
    oc.addWebError('404 Not Found')
    expect(oc.getWebErrors()).toEqual(['Uncaught TypeError', '404 Not Found'])
  })

  it('returns defensive copies from getEntries and getWebErrors', () => {
    oc.startCommand('cmd')
    oc.appendStdout('data')
    oc.finishCommand()
    oc.addWebError('err')

    const entries = oc.getEntries()
    const webErrors = oc.getWebErrors()

    entries.push({ label: 'injected', stdout: '', stderr: '' })
    webErrors.push('injected')

    expect(oc.getEntries()).toHaveLength(1)
    expect(oc.getWebErrors()).toHaveLength(1)
  })

  it('reset clears all state including in-progress command', () => {
    oc.startCommand('in-progress')
    oc.appendStdout('partial')
    oc.addWebError('some error')

    oc.reset()

    expect(oc.getEntries()).toHaveLength(0)
    expect(oc.getWebErrors()).toHaveLength(0)

    // After reset, appending should be a no-op (current was cleared)
    oc.appendStdout('should be ignored')
    expect(oc.getEntries()).toHaveLength(0)
  })
})

describe('sanitizeLabel', () => {
  it('replaces non-alphanumeric characters with hyphens', () => {
    expect(sanitizeLabel('drush site:install')).toBe('drush-site-install')
  })

  it('collapses consecutive hyphens', () => {
    expect(sanitizeLabel('foo  bar---baz')).toBe('foo-bar-baz')
  })

  it('strips leading and trailing hyphens', () => {
    expect(sanitizeLabel('--hello--')).toBe('hello')
  })

  it('lowercases the result', () => {
    expect(sanitizeLabel('Drush-STATUS')).toBe('drush-status')
  })

  it('truncates to 80 characters', () => {
    const long = 'a'.repeat(100)
    expect(sanitizeLabel(long)).toHaveLength(80)
  })

  it('handles empty string', () => {
    expect(sanitizeLabel('')).toBe('')
  })

  it('preserves underscores', () => {
    expect(sanitizeLabel('test_id=123')).toBe('test_id-123')
  })
})

describe('isVerbose', () => {
  const originalEnv = { ...process.env }

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  it('returns true when PLAYWRIGHT_DRUPAL_VERBOSE is "1"', () => {
    process.env.PLAYWRIGHT_DRUPAL_VERBOSE = '1'
    expect(isVerbose()).toBe(true)
  })

  it('returns true when PLAYWRIGHT_DRUPAL_VERBOSE is "true"', () => {
    process.env.PLAYWRIGHT_DRUPAL_VERBOSE = 'true'
    expect(isVerbose()).toBe(true)
  })

  it('returns false when PLAYWRIGHT_DRUPAL_VERBOSE is unset', () => {
    delete process.env.PLAYWRIGHT_DRUPAL_VERBOSE
    expect(isVerbose()).toBe(false)
  })

  it('returns false for other values', () => {
    process.env.PLAYWRIGHT_DRUPAL_VERBOSE = 'yes'
    expect(isVerbose()).toBe(false)
  })
})
