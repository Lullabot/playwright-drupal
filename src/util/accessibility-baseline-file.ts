import { promises as fs } from 'fs'
import path from 'path'
import type { TestInfo } from '@playwright/test'
import type { AccessibilityBaselineEntry } from './accessibility-baseline'

export type ScanKind = 'wcag' | 'best-practice'

export interface OnDiskBaselineFile {
  note: string
  violations: AccessibilityBaselineEntry[]
}

const scanInvocationCounters = new WeakMap<object, Map<ScanKind, number>>()

/**
 * Increment and return the 1-indexed invocation number for this scan kind
 * within the current test. Every call to `checkAccessibility()` runs up to
 * two scans (WCAG + best-practice); each scan gets its own counter so that
 * a test calling `checkAccessibility()` twice produces distinct baseline
 * file names (`…-1.a11y-baseline.json`, `…-2.a11y-baseline.json`) even when
 * both scans share a single `checkAccessibility()` call.
 *
 * Counter state is keyed by the TestInfo object (held in a WeakMap so it
 * is discarded with the test). Use `resetAccessibilityScanCounts()` to
 * clear state explicitly — for example, between tests in a unit-test
 * suite that reuses a mocked TestInfo.
 */
export function nextAccessibilityScanCount(
  testInfo: Pick<TestInfo, 'testId'> | object,
  scan: ScanKind,
): number {
  const key = testInfo as object
  let counts = scanInvocationCounters.get(key)
  if (!counts) {
    counts = new Map()
    scanInvocationCounters.set(key, counts)
  }
  const n = (counts.get(scan) ?? 0) + 1
  counts.set(scan, n)
  return n
}

export function resetAccessibilityScanCounts(testInfo: object): void {
  scanInvocationCounters.delete(testInfo)
}

/**
 * Slugify a test's fully qualified title the same way we use it as the
 * stem of both on-disk baseline filenames and (for existence checks) the
 * prefix of Playwright's auto-generated snapshot filenames.
 *
 * Implemented as a single-pass character scan to avoid regex-based
 * polynomial backtracking on library-supplied input (CodeQL
 * js/polynomial-redos).
 */
function slugifyTitle(testInfo: Pick<TestInfo, 'titlePath' | 'title'>): string {
  const segments = testInfo.titlePath?.slice(1) ?? []
  const raw = segments.length > 0 ? segments.join(' ') : testInfo.title
  let out = ''
  let lastWasHyphen = true // suppresses leading hyphen
  for (let i = 0; i < raw.length; i++) {
    const code = raw.charCodeAt(i)
    const isLowerAlpha = code >= 97 && code <= 122 // a-z
    const isUpperAlpha = code >= 65 && code <= 90 // A-Z
    const isDigit = code >= 48 && code <= 57 // 0-9
    if (isLowerAlpha || isDigit) {
      out += raw[i]
      lastWasHyphen = false
    } else if (isUpperAlpha) {
      out += String.fromCharCode(code + 32)
      lastWasHyphen = false
    } else if (!lastWasHyphen) {
      out += '-'
      lastWasHyphen = true
    }
  }
  // Trim trailing hyphen.
  if (out.endsWith('-')) out = out.slice(0, -1)
  return out
}

/**
 * Build the on-disk baseline file path for a single scan call.
 *
 * Playwright exposes `testInfo.snapshotPath(...name)` as the public way to
 * resolve a file under the test's snapshots directory (honoring any
 * user-configured `snapshotPathTemplate`). We pass a filename that mixes
 * the slugified test title + call counter + a scan-specific suffix, so two
 * different tests in the same spec file don't collide and each scan has
 * its own file.
 *
 * There is no reusable Playwright API that bakes the test title into an
 * explicit-name snapshot path — that logic is private to `toMatchSnapshot()`
 * for its auto-counter naming — so we build the stem ourselves.
 */
export function baselineFilePath(
  testInfo: Pick<TestInfo, 'snapshotPath' | 'titlePath' | 'title'>,
  scan: ScanKind,
  callCount: number,
): string {
  const slug = slugifyTitle(testInfo)
  const suffix = scan === 'wcag' ? 'a11y-baseline' : 'a11y-baseline-best-practice'
  return testInfo.snapshotPath(`${slug}-${callCount}.${suffix}.json`)
}

/**
 * Return true if a Playwright snapshot file already exists on disk for
 * this test — i.e. the test has been previously committed under snapshot
 * mode. Used to preserve snapshot-mode behaviour for existing tests while
 * defaulting new (snapshotless) tests into on-disk baseline mode.
 */
export async function snapshotExists(
  testInfo: Pick<TestInfo, 'snapshotPath' | 'titlePath' | 'title'>,
): Promise<boolean> {
  const dir = path.dirname(testInfo.snapshotPath('a11y-baseline-probe'))
  let entries: string[]
  try {
    entries = await fs.readdir(dir)
  } catch (err: any) {
    if (err?.code === 'ENOENT') return false
    throw err
  }
  const slug = slugifyTitle(testInfo)
  return entries.some(name => name.startsWith(`${slug}-`) && name.endsWith('.txt'))
}

export async function readBaselineFile(filePath: string): Promise<OnDiskBaselineFile | null> {
  let raw: string
  try {
    raw = await fs.readFile(filePath, 'utf8')
  } catch (err: any) {
    if (err?.code === 'ENOENT') return null
    throw err
  }
  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.violations)) {
      throw new Error('expected an object with a "violations" array')
    }
    return {
      note: typeof parsed.note === 'string' ? parsed.note : '',
      violations: parsed.violations as AccessibilityBaselineEntry[],
    }
  } catch (err) {
    throw new Error(`Malformed baseline file at ${filePath}: ${(err as Error).message}`)
  }
}

export async function writeBaselineFile(filePath: string, data: OnDiskBaselineFile): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  try {
    await fs.writeFile(filePath, JSON.stringify(data, null, 2) + '\n', { flag: 'wx' })
  } catch (err: any) {
    if (err?.code === 'EEXIST') return
    throw err
  }
}

export function buildSeed(violations: AccessibilityBaselineEntry[]): OnDiskBaselineFile {
  if (violations.length === 0) {
    return { note: 'No accessibility violations found', violations: [] }
  }
  return {
    note: 'TODO: fill in reason and willBeFixedIn for each entry before committing.',
    violations,
  }
}
