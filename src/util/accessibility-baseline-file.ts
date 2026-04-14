import { promises as fs } from 'fs'
import path from 'path'
import type { TestInfo } from '@playwright/test'
import type { AccessibilityBaselineEntry } from './accessibility-baseline'

export type ScanKind = 'wcag' | 'best-practice'

export interface OnDiskBaselineFile {
  note: string
  violations: AccessibilityBaselineEntry[]
}

const callCounters = new WeakMap<object, Map<ScanKind, number>>()

export function nextCallCount(testInfo: Pick<TestInfo, 'testId'> | object, scan: ScanKind): number {
  const key = testInfo as object
  let counts = callCounters.get(key)
  if (!counts) {
    counts = new Map()
    callCounters.set(key, counts)
  }
  const n = (counts.get(scan) ?? 0) + 1
  counts.set(scan, n)
  return n
}

export function resetCallCounts(testInfo: object): void {
  callCounters.delete(testInfo)
}

function slugifyTitle(testInfo: Pick<TestInfo, 'titlePath' | 'title'>): string {
  const segments = testInfo.titlePath?.slice(1) ?? []
  const raw = segments.length > 0 ? segments.join(' ') : testInfo.title
  return raw.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

function snapshotsDir(testInfo: Pick<TestInfo, 'snapshotPath'>): string {
  const probe = testInfo.snapshotPath('a11y-baseline-probe')
  return path.dirname(probe)
}

export function baselineFilePath(
  testInfo: Pick<TestInfo, 'snapshotPath' | 'titlePath' | 'title'>,
  scan: ScanKind,
  callCount: number,
): string {
  const dir = snapshotsDir(testInfo)
  const slug = slugifyTitle(testInfo)
  const suffix = scan === 'wcag' ? 'a11y-baseline' : 'a11y-baseline-best-practice'
  return path.join(dir, `${slug}-${callCount}.${suffix}.json`)
}

export async function snapshotExists(
  testInfo: Pick<TestInfo, 'snapshotPath' | 'titlePath' | 'title'>,
): Promise<boolean> {
  const dir = snapshotsDir(testInfo)
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
