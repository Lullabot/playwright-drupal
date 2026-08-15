import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { createPathResolver, parsePathPrefix } from './report-paths'

let tmpDir: string

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'report-paths-test-'))
})

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

/** Create a file, and every directory above it, under the temporary directory. */
function touch(relativePath: string): string {
  const filePath = path.join(tmpDir, relativePath)
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, 'png')
  return filePath
}

describe('parsePathPrefix', () => {
  it('splits on the first colon', () => {
    expect(parsePathPrefix('/var/www/html:/home/runner/work/site/site')).toEqual({
      from: '/var/www/html',
      to: '/home/runner/work/site/site',
    })
  })

  it('keeps a colon in the local path, as Windows drives have', () => {
    expect(parsePathPrefix('/var/www/html:C:/checkout')).toEqual({
      from: '/var/www/html',
      to: 'C:/checkout',
    })
  })

  it('rejects a value that is not a pair', () => {
    expect(parsePathPrefix('/var/www/html')).toBeNull()
    expect(parsePathPrefix(':/home/runner')).toBeNull()
    expect(parsePathPrefix('/var/www/html:')).toBeNull()
  })
})

describe('createPathResolver', () => {
  it('leaves a path that already resolves alone', () => {
    const filePath = touch('test/playwright/test-results/diff.png')
    const resolve = createPathResolver({ reportPath: path.join(tmpDir, 'results.json') })

    expect(resolve(filePath)).toEqual({ path: filePath, found: true })
  })

  it('re-roots a container path onto the checkout', () => {
    touch('test/playwright/test-results/home-chromium/home-1-diff.png')
    const resolve = createPathResolver({
      reportPath: path.join(tmpDir, 'test/playwright/test-results/results.json'),
    })

    const resolution = resolve(
      '/var/www/html/test/playwright/test-results/home-chromium/home-1-diff.png',
    )

    expect(resolution.found).toBe(true)
    expect(resolution.path)
      .toBe(path.join(tmpDir, 'test/playwright/test-results/home-chromium/home-1-diff.png'))
    expect(resolution.prefix).toEqual({ from: '/var/www/html', to: tmpDir })
  })

  it('finds the files when the report sits outside the output directory', () => {
    // The arrangement the integration test produces: the report is written
    // beside the Playwright config while the images go to a separate output
    // directory, so the two share nothing but the mount point.
    touch('test/playwright/test-results-visual/fixture-chromium/fixture-diff.png')
    const resolve = createPathResolver({
      reportPath: path.join(tmpDir, 'test/playwright/visual-diff-results.json'),
    })

    const resolution = resolve(
      '/var/www/html/test/playwright/test-results-visual/fixture-chromium/fixture-diff.png',
    )

    expect(resolution.found).toBe(true)
    expect(resolution.path)
      .toBe(path.join(tmpDir, 'test/playwright/test-results-visual/fixture-chromium/fixture-diff.png'))
  })

  it('does not assume a fixed offset between the report and the mount point', () => {
    // This repository's own CI creates the project under a generated directory,
    // so its depth below the workspace differs from the container's.
    touch('tmp/pwtest-abc123/test/playwright/test-results/home-chromium/home-1-diff.png')
    const resolve = createPathResolver({
      reportPath: path.join(tmpDir, 'tmp/pwtest-abc123/test/playwright/test-results/results.json'),
    })

    const resolution = resolve(
      '/var/www/html/test/playwright/test-results/home-chromium/home-1-diff.png',
    )

    expect(resolution.found).toBe(true)
    expect(resolution.prefix).toEqual({
      from: '/var/www/html',
      to: path.join(tmpDir, 'tmp/pwtest-abc123'),
    })
  })

  it('prefers the longest tail, so the most specific match wins', () => {
    // A shallow decoy sharing the last two components must not beat the real
    // file, which shares many more.
    touch('decoy/fixture-chromium/fixture-diff.png')
    touch('test/playwright/test-results/fixture-chromium/fixture-diff.png')

    const resolve = createPathResolver({
      reportPath: path.join(tmpDir, 'test/playwright/test-results/results.json'),
    })

    expect(resolve('/var/www/html/test/playwright/test-results/fixture-chromium/fixture-diff.png').path)
      .toBe(path.join(tmpDir, 'test/playwright/test-results/fixture-chromium/fixture-diff.png'))
  })

  it('will not identify a file by its name alone', () => {
    // One component of tail is a coincidence waiting to happen: some unrelated
    // fixture-diff.png must not be served up as the failure's diff image.
    touch('fixture-diff.png')
    const resolve = createPathResolver({ reportPath: path.join(tmpDir, 'results.json') })

    expect(resolve('/var/www/html/somewhere/else/fixture-diff.png').found).toBe(false)
  })

  it('reports a path it cannot find rather than inventing one', () => {
    const resolve = createPathResolver({
      reportPath: path.join(tmpDir, 'test/playwright/test-results/results.json'),
    })

    const resolution = resolve('/var/www/html/test/playwright/test-results/missing-diff.png')

    expect(resolution).toEqual({
      path: '/var/www/html/test/playwright/test-results/missing-diff.png',
      found: false,
    })
  })

  it('reuses a mapping it has already worked out', () => {
    touch('test-results/one/a-diff.png')
    touch('test-results/two/b-diff.png')

    const looked: string[] = []
    const resolve = createPathResolver({
      reportPath: path.join(tmpDir, 'results.json'),
      exists: filePath => {
        looked.push(filePath)
        return fs.existsSync(filePath)
      },
    })

    resolve('/var/www/html/test-results/one/a-diff.png')
    const afterFirst = looked.length
    looked.length = 0

    expect(resolve('/var/www/html/test-results/two/b-diff.png').found).toBe(true)
    // The learned mapping is tried straight after the original path, rather
    // than searching the tree again.
    expect(looked.length).toBeLessThan(afterFirst)
    expect(looked).toEqual([
      '/var/www/html/test-results/two/b-diff.png',
      path.join(tmpDir, 'test-results/two/b-diff.png'),
    ])
  })

  it('prefers an explicit prefix over anything it would work out', () => {
    touch('elsewhere/test-results/home-1-diff.png')
    touch('test/playwright/test-results/home-1-diff.png')

    const resolve = createPathResolver({
      reportPath: path.join(tmpDir, 'test/playwright/test-results/results.json'),
      prefixes: [{ from: '/var/www/html/test/playwright', to: path.join(tmpDir, 'elsewhere') }],
    })

    expect(resolve('/var/www/html/test/playwright/test-results/home-1-diff.png').path)
      .toBe(path.join(tmpDir, 'elsewhere/test-results/home-1-diff.png'))
  })

  it('ignores a prefix the path is not under', () => {
    touch('test-results/diff.png')
    const resolve = createPathResolver({
      reportPath: path.join(tmpDir, 'results.json'),
      prefixes: [{ from: '/somewhere/else', to: tmpDir }],
    })

    // The explicit prefix does not apply, and one component of tail is too
    // little to search on.
    expect(resolve('/var/www/html/diff.png').found).toBe(false)
  })

  it('does not match a prefix part way through a directory name', () => {
    touch('results/diff.png')
    const resolve = createPathResolver({
      reportPath: path.join(tmpDir, 'results.json'),
      prefixes: [{ from: '/var/www/ht', to: tmpDir }],
    })

    // /var/www/html starts with the string /var/www/ht but is not under it,
    // so the explicit mapping must not fire. The search still finds the file.
    const resolution = resolve('/var/www/html/results/diff.png')
    expect(resolution.path).toBe(path.join(tmpDir, 'results/diff.png'))
    expect(resolution.prefix).toEqual({ from: '/var/www/html', to: tmpDir })
  })

  it('tolerates a trailing slash on the local side', () => {
    touch('test-results/diff.png')
    const resolve = createPathResolver({
      reportPath: path.join(tmpDir, 'results.json'),
      prefixes: [{ from: '/var/www/html', to: `${tmpDir}/` }],
    })

    expect(resolve('/var/www/html/test-results/diff.png').path)
      .toBe(`${tmpDir}/test-results/diff.png`)
  })
})
