import * as fs from 'fs'
import * as path from 'path'

/**
 * Translate the file paths a Playwright JSON report records into paths the
 * process reading that report can actually open.
 *
 * The two are not always the same file system. Running Playwright inside a
 * container — which is the normal arrangement for this package, where the suite
 * runs in DDEV's web container — records every attachment under the path it had
 * *there*, `/var/www/html/…`. A workflow step reading the report on the runner
 * is on the other side of that boundary, and `/var/www/html` means nothing to
 * it. The report is readable, the attachments are not, and nothing about the
 * failure says why.
 *
 * The bind mount that creates the problem also solves it: the same files are
 * visible from both sides under different prefixes, so the paths need
 * re-rooting rather than fetching. What the two views share is the tail of the
 * path — the part below the mount point — so the mount point is found by
 * hanging progressively longer tails of a recorded path off the directories
 * around the report until one of them names a file that exists.
 *
 * Every mapping is confirmed against the disk before it is used, so a wrong
 * guess resolves to nothing rather than to the wrong image. The report's own
 * `config` is deliberately not consulted: `rootDir` is the *test* directory
 * rather than the project root, and `outputDir` need not contain the report,
 * so neither reliably shares a tail with the path the report was read from.
 */

/**
 * Shortest tail worth trying, in path components.
 *
 * A bare file name is too little to identify a file by — some unrelated
 * `fixture-diff.png` elsewhere in the tree would match. One directory of
 * context makes a coincidence unlikely, and longer tails are tried first
 * regardless, so the most specific match always wins.
 */
const MIN_TAIL_COMPONENTS = 2

export interface PathPrefix {
  /** Absolute path as recorded in the report — typically a container path. */
  from: string
  /** The same directory as seen from here. */
  to: string
}

export interface PathResolution {
  /** The path to read. Unchanged when the recorded one was already fine. */
  path: string
  /** Whether a readable file was found. */
  found: boolean
  /** The mapping that made it readable, when one was needed. */
  prefix?: PathPrefix
}

export interface PathResolverOptions {
  /** Where the JSON report was read from, on this side of the boundary. */
  reportPath: string
  /** Explicit mappings. Tried before anything is worked out. */
  prefixes?: PathPrefix[]
  /** Existence check, injectable for tests. */
  exists?: (filePath: string) => boolean
}

/**
 * Parse a `FROM:TO` pair, as `--path-prefix` takes it.
 *
 * Split on the first colon: `TO` is a local absolute path and may itself
 * contain one on Windows, whereas `FROM` comes from a container and will not.
 */
export function parsePathPrefix(value: string): PathPrefix | null {
  const separator = value.indexOf(':')
  if (separator <= 0) return null

  const from = value.slice(0, separator).trim()
  const to = value.slice(separator + 1).trim()
  if (!from || !to) return null

  return { from, to }
}

/**
 * Build the function that turns a recorded path into a readable one.
 *
 * A path that already resolves is left alone, so this costs one `stat` per
 * attachment when the report and the files are on the same side. A mapping
 * worked out for one attachment is kept and tried first for the rest, so the
 * search runs once per run rather than once per image.
 */
export function createPathResolver(
  options: PathResolverOptions,
): (filePath: string) => PathResolution {
  const exists = options.exists ?? ((filePath: string) => fs.existsSync(filePath))
  const explicit = options.prefixes ?? []
  const searchRoots = ancestors(path.dirname(path.resolve(options.reportPath)))
  const learned: PathPrefix[] = []

  /** Hang tails of the recorded path off each directory around the report. */
  function search(filePath: string): PathResolution | null {
    const target = splitPath(filePath)

    // Longest tail first, so the most specific match wins. Stop one short of
    // the whole path: something has to be left to rewrite.
    for (let length = target.components.length - 1; length >= MIN_TAIL_COMPONENTS; length--) {
      const tail = target.components.slice(target.components.length - length).join('/')

      for (const root of searchRoots) {
        const candidate = `${root.replace(/[\\/]+$/, '')}/${tail}`
        if (!exists(candidate)) continue

        return {
          path: candidate,
          found: true,
          prefix: { from: joinPath(target, target.components.length - length), to: root },
        }
      }
    }

    return null
  }

  return (filePath: string): PathResolution => {
    if (exists(filePath)) return { path: filePath, found: true }

    for (const prefix of [...explicit, ...learned]) {
      const rewritten = applyPrefix(filePath, prefix)
      if (rewritten && exists(rewritten)) return { path: rewritten, found: true, prefix }
    }

    const discovered = search(filePath)
    if (!discovered) return { path: filePath, found: false }

    if (discovered.prefix) learned.push(discovered.prefix)
    return discovered
  }
}

/** Swap one prefix for another, or null when the path is not under it. */
function applyPrefix(filePath: string, prefix: PathPrefix): string | null {
  const from = splitPath(prefix.from)
  const target = splitPath(filePath)

  if (target.components.length < from.components.length) return null
  for (let index = 0; index < from.components.length; index++) {
    if (target.components[index] !== from.components[index]) return null
  }

  const rest = target.components.slice(from.components.length)
  const to = prefix.to.replace(/[\\/]+$/, '')
  return rest.length === 0 ? to : `${to}/${rest.join('/')}`
}

interface SplitPath {
  /** `/`, `C:/`, or empty for a relative path. */
  root: string
  components: string[]
}

/**
 * Split a path into a root and its components, accepting either separator.
 *
 * The two sides of the boundary need not agree on the separator, and the
 * recorded paths come from a report rather than from this platform.
 */
function splitPath(value: string): SplitPath {
  const match = /^([A-Za-z]:[\\/]|[\\/])?/.exec(value)
  const prefix = match?.[1] ?? ''
  return {
    root: prefix.replace(/\\/g, '/'),
    components: value.slice(prefix.length).split(/[\\/]+/).filter(Boolean),
  }
}

/** Rebuild a path from its first `count` components. */
function joinPath(split: SplitPath, count: number): string {
  return split.root + split.components.slice(0, count).join('/')
}

/** A directory and every directory above it. */
function ancestors(directory: string): string[] {
  const out: string[] = []
  let current = directory

  for (;;) {
    out.push(current)
    const parent = path.dirname(current)
    if (parent === current) return out
    current = parent
  }
}
