---
id: 1
group: "baseline-io"
dependencies: []
status: "completed"
created: 2026-04-14
skills:
  - typescript
---
# Create on-disk baseline file I/O helper

## Objective
Introduce a small, standalone helper module that owns the on-disk baseline file format (`{ note, violations }`), its path derivation from Playwright's snapshot path, and the read/write operations needed by the new default dispatch. All subsequent tasks depend on this module.

## Skills Required
- `typescript` — TypeScript source, JSON I/O, Node `fs` APIs, integration with Playwright's `TestInfo`.

## Acceptance Criteria
- [ ] New module exports at minimum: a type for the on-disk baseline file (`{ note: string; violations: AccessibilityBaselineEntry[] }`), a function that resolves the on-disk baseline path for a given `testInfo` + snapshot-name-with-counter + scan kind (`'wcag' | 'best-practice'`), a function that reads+parses the file (returning `null` when absent), and a function that writes it atomically (using `fs.writeFile` with `flag: 'wx'`).
- [ ] Path derivation strips the `-<browser>-<platform>` suffix from the snapshot basename and swaps the extension, producing e.g. `foo.spec.ts-snapshots/test-name-1.a11y-baseline.json` and `foo.spec.ts-snapshots/test-name-1.a11y-baseline-best-practice.json`.
- [ ] Path derivation is deterministic: given the same `testInfo` and same internal snapshot counter, it returns the same path regardless of browser/project.
- [ ] Write helper creates any missing parent directory before writing.
- [ ] Write helper no-ops safely (no throw) when the file already exists (`flag: 'wx'` → `EEXIST` swallowed), since the dispatch gates the call on absence.
- [ ] Reader returns typed `{ note, violations }`; malformed JSON throws with a clear error message naming the path.
- [ ] A small, focused unit test covers the path derivation, the happy-path round-trip (write then read), and the EEXIST no-op.

## Technical Requirements
- Source location: `src/util/accessibility-baseline-file.ts` (new file).
- Reuse the existing `AccessibilityBaselineEntry` type from `src/util/accessibility-baseline.ts`.
- Keep the in-code `defineAccessibilityBaseline()` API unchanged — this module is strictly for on-disk files.
- Consumers: the dispatch in `src/util/accessible-screenshot.ts` (task 2) and its tests (task 3).

## Input Dependencies
None.

## Output Artifacts
- `src/util/accessibility-baseline-file.ts`
- A companion unit test (e.g. `src/util/accessibility-baseline-file.test.ts`) exercising path derivation and I/O.

## Implementation Notes

<details>

**Path derivation approach.** Playwright's `testInfo.snapshotPath(...)` returns a full path like `.../foo.spec.ts-snapshots/test-name-1-chromium-linux.txt`. We want `.../foo.spec.ts-snapshots/test-name-1.a11y-baseline.json`.

Steps for the path helper:
1. Accept `(testInfo: TestInfo, snapshotName: string, kind: 'wcag' | 'best-practice')` where `snapshotName` is whatever name the assert helper passed to `toMatchSnapshot(name)` (if we pass no explicit name, Playwright auto-generates `test-name-1.txt` etc. using an internal counter). For the new flow, we will have the assert helper resolve a specific name using Playwright's internal counter semantics by calling `testInfo.snapshotPath(name)` — in practice the easiest is: ask Playwright for the snapshot path, take its `path.basename`, strip the trailing `-<browser>-<platform>` suffix (the project/platform tuple is available as `testInfo.project.name` and `process.platform`; use those to construct and trim the suffix) and swap the extension.
2. Suffix to swap: `.txt` → `.a11y-baseline.json` (WCAG) or `.a11y-baseline-best-practice.json` (best-practice).
3. Return an absolute path rooted in the same snapshots directory (`path.dirname(snapshotAbsPath)`).

**Why derive from `snapshotPath` rather than constructing from scratch?** Any future change to Playwright's snapshot-directory layout stays transparent.

**Schema types:**

```ts
import type { AccessibilityBaselineEntry } from './accessibility-baseline'

export interface OnDiskBaselineFile {
  note: string
  violations: AccessibilityBaselineEntry[]
}
```

**Writer:**

```ts
import { promises as fs } from 'fs'
import path from 'path'

export async function writeBaselineFile(filePath: string, data: OnDiskBaselineFile): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  try {
    await fs.writeFile(filePath, JSON.stringify(data, null, 2) + '\n', { flag: 'wx' })
  } catch (err: any) {
    if (err?.code === 'EEXIST') return
    throw err
  }
}
```

**Reader:**

```ts
export async function readBaselineFile(filePath: string): Promise<OnDiskBaselineFile | null> {
  let raw: string
  try {
    raw = await fs.readFile(filePath, 'utf8')
  } catch (err: any) {
    if (err?.code === 'ENOENT') return null
    throw err
  }
  try {
    return JSON.parse(raw) as OnDiskBaselineFile
  } catch (err) {
    throw new Error(`Malformed baseline file at ${filePath}: ${(err as Error).message}`)
  }
}
```

**Unit tests:** use a temp directory (`os.tmpdir()` + `fs.mkdtemp`) to exercise the round-trip and the EEXIST case. Path-derivation test can stub a minimal `TestInfo`-shaped object (only the fields needed: `snapshotPath`, `project.name`, possibly `title`).

All commands must be run through `ddev exec` per repo convention (e.g. `ddev exec npx vitest run src/util/accessibility-baseline-file.test.ts`). Follow whatever test runner is already used in the repo (inspect `package.json` scripts if unsure).

</details>
