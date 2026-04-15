import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { promises as fs } from 'fs'
import os from 'os'
import path from 'path'
import {
  baselineFilePath,
  buildSeed,
  nextAccessibilityScanCount,
  readBaselineFile,
  resetAccessibilityScanCounts,
  snapshotExists,
  writeBaselineFile,
} from './accessibility-baseline-file'

function makeTestInfo(opts: { dir: string; title?: string; titlePath?: string[] }) {
  const title = opts.title ?? 'standalone accessibility check works'
  const titlePath = opts.titlePath ?? ['file.spec.ts', title]
  return {
    testId: `${title}-${Math.random()}`,
    title,
    titlePath,
    snapshotPath: (...segs: string[]) => path.join(opts.dir, ...segs),
  }
}

describe('accessibility-baseline-file', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'a11y-baseline-'))
  })

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true })
  })

  describe('baselineFilePath', () => {
    it('builds a deterministic projectless path with counter and scan-kind suffix', () => {
      const ti = makeTestInfo({ dir: tmpDir })
      const wcag = baselineFilePath(ti, 'wcag', 1)
      const bp = baselineFilePath(ti, 'best-practice', 1)
      expect(wcag).toBe(path.join(tmpDir, 'standalone-accessibility-check-works-1.a11y-baseline.json'))
      expect(bp).toBe(path.join(tmpDir, 'standalone-accessibility-check-works-1.a11y-baseline-best-practice.json'))
    })

    it('uses an incremented counter for multi-call tests', () => {
      const ti = makeTestInfo({ dir: tmpDir })
      const path2 = baselineFilePath(ti, 'wcag', 2)
      expect(path2).toContain('-2.a11y-baseline.json')
    })
  })

  describe('nextAccessibilityScanCount', () => {
    it('returns sequential numbers per (testInfo, scan)', () => {
      const ti = {} as any
      try {
        expect(nextAccessibilityScanCount(ti, 'wcag')).toBe(1)
        expect(nextAccessibilityScanCount(ti, 'wcag')).toBe(2)
        expect(nextAccessibilityScanCount(ti, 'best-practice')).toBe(1)
        expect(nextAccessibilityScanCount(ti, 'wcag')).toBe(3)
      } finally {
        resetAccessibilityScanCounts(ti)
      }
    })
  })

  describe('snapshotExists', () => {
    it('returns false when the snapshots dir is missing', async () => {
      const ti = makeTestInfo({ dir: path.join(tmpDir, 'does-not-exist') })
      expect(await snapshotExists(ti)).toBe(false)
    })

    it('returns false when no snapshot file matches the test slug', async () => {
      await fs.writeFile(path.join(tmpDir, 'other-test-1-chromium-linux.txt'), 'data')
      const ti = makeTestInfo({ dir: tmpDir })
      expect(await snapshotExists(ti)).toBe(false)
    })

    it('returns true when a snapshot file matching the test slug exists', async () => {
      await fs.writeFile(
        path.join(tmpDir, 'standalone-accessibility-check-works-1-chromium-linux.txt'),
        'data',
      )
      const ti = makeTestInfo({ dir: tmpDir })
      expect(await snapshotExists(ti)).toBe(true)
    })
  })

  describe('readBaselineFile / writeBaselineFile', () => {
    it('round-trips object schema with note and violations', async () => {
      const file = path.join(tmpDir, 'rt.a11y-baseline.json')
      await writeBaselineFile(file, {
        note: 'No accessibility violations found',
        violations: [],
      })
      const back = await readBaselineFile(file)
      expect(back).toEqual({ note: 'No accessibility violations found', violations: [] })
    })

    it('returns null when file is missing', async () => {
      const file = path.join(tmpDir, 'missing.json')
      expect(await readBaselineFile(file)).toBeNull()
    })

    it('does not throw on EEXIST (idempotent first-write)', async () => {
      const file = path.join(tmpDir, 'idem.json')
      await writeBaselineFile(file, { note: 'first', violations: [] })
      await writeBaselineFile(file, { note: 'second', violations: [] })
      const back = await readBaselineFile(file)
      expect(back?.note).toBe('first')
    })

    it('throws a clear error on malformed JSON', async () => {
      const file = path.join(tmpDir, 'bad.json')
      await fs.writeFile(file, '{not json')
      await expect(readBaselineFile(file)).rejects.toThrow(/Malformed baseline file/)
    })

    it('creates parent directories on write', async () => {
      const file = path.join(tmpDir, 'nested', 'sub', 'baseline.json')
      await writeBaselineFile(file, { note: 'x', violations: [] })
      expect((await readBaselineFile(file))?.note).toBe('x')
    })
  })

  describe('buildSeed', () => {
    it('produces a clean-state payload for zero violations', () => {
      expect(buildSeed([])).toEqual({
        note: 'No accessibility violations found',
        violations: [],
      })
    })

    it('produces a TODO-prompted payload for non-zero violations', () => {
      const v = [{ rule: 'color-contrast', targets: ['#x'], reason: 'TODO', willBeFixedIn: 'TODO' }]
      const seed = buildSeed(v)
      expect(seed.note).toMatch(/TODO/)
      expect(seed.violations).toEqual(v)
    })
  })
})
