---
id: 2
group: "dispatch"
dependencies: [1]
status: "completed"
created: 2026-04-14
skills:
  - typescript
---
# Implement three-way dispatch in checkAccessibility (WCAG + best-practice) with CI vs local behaviour

## Objective
Replace the current `baseline ? baseline-mode : snapshot-mode` branch inside `checkAccessibility()` with the three-way dispatch described in the plan, applied to both the WCAG scan and the best-practice scan. Each branch wires up the on-disk baseline JSON (via the helper from task 1), honours `testInfo.config.updateSnapshots`, emits the correct annotations, and implements the CI-fails-after-seed behaviour.

## Skills Required
- `typescript` — edits to `src/util/accessible-screenshot.ts`, Playwright `TestInfo` APIs, annotation/attachment plumbing.

## Acceptance Criteria
- [ ] In `checkAccessibility()`, mode selection for the WCAG scan follows: (a) explicit `options.baseline` → in-code baseline mode (unchanged); else (b) if snapshot file exists on disk → snapshot mode (unchanged); else (c) if `testInfo.config.updateSnapshots` is `'all'`, `'changed'`, or `'missing'` → snapshot mode (Playwright writes the snapshot); else (d) baseline mode driven by the on-disk baseline JSON.
- [ ] When in on-disk baseline mode and the JSON file exists, its `violations` array is parsed and passed to `assertBaseline()` (existing helper). The `note` field is ignored by the matcher.
- [ ] When in on-disk baseline mode and the JSON file is missing, the file is seeded: `{ note: "No accessibility violations found", violations: [] }` for zero violations, or `{ note: "TODO: fill in reason and willBeFixedIn for each entry before committing.", violations: [...] }` with placeholder `reason: 'TODO'` / `willBeFixedIn: 'TODO'` for N>0 violations. The seeded file is attached to the report via `testInfo.attach()`.
- [ ] **CI behaviour**: when `process.env.CI` is set and the dispatch takes the seeding branch, the file is still written and attached, but the test FAILS with a clear message naming the seeded path and instructing the author to download/commit it. Mirrors Playwright's default missing-snapshot behaviour.
- [ ] **Local behaviour**: when `!process.env.CI` and the dispatch takes the seeding branch, `assertBaseline()` is called with the freshly seeded entries so the first run passes. A `testInfo.annotations` entry notes the seed (including a `TODO`-reminder when placeholders were written).
- [ ] The best-practice scan receives the same dispatch. It uses its own on-disk baseline file (`.a11y-baseline-best-practice.json`) and preserves the existing soft/hard behaviour driven by `bestPracticeMode`. Extract the best-practice assertion into a helper function so both scans can share the dispatch cleanly.
- [ ] Multi-call support: a single test invoking `checkAccessibility()` twice yields two distinct baseline files keyed by Playwright's snapshot counter (`-1`, `-2`). No behavioural change vs. the existing snapshot counter.
- [ ] Existing behaviour unchanged for: (a) tests with a committed snapshot file, (b) tests that pass an explicit `options.baseline`, (c) all output attachments/annotations that exist today in both modes.
- [ ] `src/testcase/test.ts`'s `a11y` fixture (`a11y.check`) continues to work without modification — all changes are encapsulated inside `checkAccessibility()`.

## Technical Requirements
- Target file: `src/util/accessible-screenshot.ts`.
- Reuse `src/util/accessibility-baseline-file.ts` (task 1) for all on-disk I/O.
- Reuse existing helpers: `assertBaseline`, `assertSnapshot`, `extractNormalizedViolations`, `violationFingerprints`, `runWcagScan`, `runBestPracticeScan`.
- Read `testInfo.config.updateSnapshots` to gate branch (c). Valid values: `'all' | 'changed' | 'missing' | 'none'`. Only `'none'` routes to baseline mode.
- Use `process.env.CI` for the CI branch. Do not introduce any new config flags.

## Input Dependencies
- Task 1's `accessibility-baseline-file.ts` module and its exports.

## Output Artifacts
- Modified `src/util/accessible-screenshot.ts` with the new dispatch.
- Any small refactor needed to extract the best-practice assertion into a shared helper.

## Implementation Notes

<details>

**Where the dispatch lives.** Today `src/util/accessible-screenshot.ts:163-169` has:

```ts
if (baseline) {
  return assertBaseline(testInfo, wcagScanResults, baseline)
}
return assertSnapshot(testInfo, wcagScanResults)
```

Replace with a single new function `dispatchAssertion({ testInfo, results, explicitBaseline, scanKind })` used by both scans. Pseudocode:

```ts
async function dispatchAssertion({ testInfo, results, explicitBaseline, scanKind }): Promise<void> {
  if (explicitBaseline) {
    return assertBaseline(testInfo, results, explicitBaseline) // scan-specific assert
  }

  const snapshotExists = await snapshotFileExists(testInfo, scanKind)
  if (snapshotExists) {
    return assertSnapshot(testInfo, results, scanKind) // scan-specific assert
  }

  const update = testInfo.config.updateSnapshots
  if (update === 'all' || update === 'changed' || update === 'missing') {
    return assertSnapshot(testInfo, results, scanKind)
  }

  // Baseline mode via on-disk JSON.
  const baselinePath = resolveBaselinePath(testInfo, scanKind)
  const existing = await readBaselineFile(baselinePath)
  if (existing) {
    return assertBaseline(testInfo, results, existing.violations)
  }

  // Seed.
  const seed = buildSeed(results)
  await writeBaselineFile(baselinePath, seed)
  await testInfo.attach(`a11y-${scanKind}-baseline-seed`, {
    path: baselinePath,
    contentType: 'application/json',
  })

  if (process.env.CI) {
    expect(null, `A11y baseline file was missing. Seeded to ${baselinePath} — download from CI artifacts or run locally and commit the file.`).toBe('baseline file present')
    return
  }

  testInfo.annotations.push({
    type: 'Accessibility',
    description: seed.violations.length === 0
      ? `A11y baseline seeded at ${baselinePath} (no violations).`
      : `A11y baseline seeded at ${baselinePath} with ${seed.violations.length} entries — fill in reason/willBeFixedIn before committing.`,
  })
  return assertBaseline(testInfo, results, seed.violations)
}
```

**Snapshot existence check.** Use `testInfo.snapshotPath(...)` with the same arguments the existing `assertSnapshot` gives to `toMatchSnapshot()` (in practice `toMatchSnapshot()` auto-picks the name using an internal counter; you'll need to either pass an explicit name to `toMatchSnapshot()` and to `testInfo.snapshotPath(name)`, or use `testInfo.snapshotPath()` without args and rely on the counter tracked via `testInfo.snapshotSuffix`/internal state). Cleanest approach: pass an explicit name argument (e.g. `toMatchSnapshot('a11y-wcag')` and a different name for best-practice) so both the snapshot and the baseline filename derivation are deterministic and independent of the global counter. This also resolves scan coexistence — WCAG and best-practice no longer clash on the shared counter.

If changing the snapshot name breaks existing snapshots (because today they were written without an explicit name and live at `...-1-<browser>-<platform>.txt` etc.), handle that with a fallback: if explicit-name snapshot path doesn't exist on disk but the legacy numbered path does, treat that as "snapshot exists" and continue using the numbered variant. Document the migration in the task 4 README updates.

*(Alternative, simpler path: keep the auto-counter behaviour and derive the baseline file path by taking `testInfo.snapshotPath()` with no args and stripping the trailing `-<browser>-<platform>` and extension. This is what task 1's helper is set up to do.)*

**Best-practice extraction.** Currently `runBestPracticeScan()` internally calls `expect.soft(violationFingerprints(results)).toMatchSnapshot()`. Refactor so that:
- `runBestPracticeScan` returns the results and annotations as data;
- A new `assertBestPracticeSnapshot(testInfo, results)` wraps the soft/hard `toMatchSnapshot` call (preserving `bestPracticeMode` semantics);
- `dispatchAssertion` with `scanKind === 'best-practice'` routes to that helper when in snapshot mode, and to `assertBaseline` (soft or hard) when in baseline mode. Use `expect.soft` vs `expect` in baseline mode based on `bestPracticeMode`.

**CI failure message.** The message needs to guide the developer. Sample:

> `A11y baseline file was missing for <test title>. Seeded to <relative path>. Download the attached file from CI artifacts (or re-run locally) and commit it before merging.`

Use `expect(null, message).toBe('baseline file present')` or equivalent assertion that always fails — do not throw raw `Error` so Playwright captures the message cleanly.

**Do not break existing tests.** Run `ddev exec npx playwright test` (or the repo's equivalent) locally once the edit is in place to confirm existing integration tests still pass. Snapshot files in the repo for existing tests must continue to drive snapshot mode; the baseline branch must not be taken for them.

**Keep the attachment surface consistent.** The existing `a11y-baseline-suggestions` attachment (in snapshot mode) stays unchanged. A new `a11y-wcag-baseline-seed` (and `a11y-best-practice-baseline-seed`) attachment is added only in the seeding branch.

</details>
