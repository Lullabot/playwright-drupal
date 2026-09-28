---
id: 3
group: "testing"
dependencies: [2]
status: "completed"
created: 2026-04-14
skills:
  - typescript
  - playwright
---
# Cover the new dispatch matrix with meaningful tests

## Objective
Add the minimum set of tests that exercise every branch of the new dispatch — covering existing behaviour (regression-proofing) and the new CI-vs-local, multi-call, and best-practice-parity behaviour described in the plan's Success Criteria and Tests matrix.

## Skills Required
- `typescript`, `playwright` — mix of pure unit tests for the helpers and integration tests exercising `checkAccessibility()` end-to-end.

Your critical mantra for test generation is: "write a few tests, mostly integration".

**Definition of "Meaningful Tests":**
Tests that verify custom business logic, critical paths, and edge cases specific to the application. Focus on testing YOUR code, not the framework or library functionality.

**When TO Write Tests:**
- Custom business logic and algorithms
- Critical user workflows and data transformations
- Edge cases and error conditions for core functionality
- Integration points between different system components
- Complex validation logic or calculations

**When NOT to Write Tests:**
- Third-party library functionality (already tested upstream)
- Framework features (React hooks, Express middleware, etc.)
- Simple CRUD operations without custom logic
- Getter/setter methods or basic property access
- Configuration files or static data
- Obvious functionality that would break immediately if incorrect

## Acceptance Criteria
- [ ] Integration test: an existing test with a committed snapshot file → snapshot mode is used; no JSON baseline file is created or read. (Regression coverage.)
- [ ] Integration test: an explicit `options.baseline` is passed → in-code baseline is used regardless of any on-disk JSON present on disk. (Regression coverage.)
- [ ] Integration test (local, `CI` unset): snapshotless test with violations → JSON file is seeded with `note` containing the `TODO` prompt and `violations` populated with placeholder `reason`/`willBeFixedIn`; test passes; annotation is emitted.
- [ ] Integration test (local, `CI` unset): snapshotless test with zero violations → JSON file is seeded as `{ note: "No accessibility violations found", violations: [] }`; test passes.
- [ ] Integration test (CI simulated, `CI=1`): snapshotless test with violations → JSON file is still written, attached to the test, and the test fails with a clear message naming the seeded path. Zero-violations-on-CI variant also fails (because the baseline was missing) for parity with Playwright's missing-snapshot behaviour.
- [ ] Integration test: second run of a previously clean-seeded test (empty `violations`) that now has a violation → fails as unmatched. (Regression-signal guarantee.)
- [ ] Integration test: a test run with `updateSnapshots` = `missing` (or `all`/`changed`) and no snapshot → snapshot is created, no JSON file is written. A separate assertion with `updateSnapshots = 'none'` on the same initial state → baseline mode, no snapshot written.
- [ ] Integration test: a single test making two `checkAccessibility()` calls produces two distinct baseline files (`…-1.a11y-baseline.json`, `…-2.a11y-baseline.json`) matching Playwright's counter.
- [ ] Integration test: best-practice scan exhibits the same dispatch — zero-violation seeding, non-zero seeding, CI failure, and file separation (`a11y-baseline-best-practice.json` sibling).
- [ ] Unit coverage for the helper module from task 1 (path derivation, write-then-read round trip, EEXIST no-op).
- [ ] All tests run under `ddev exec` per repo convention.

## Technical Requirements
- Extend the existing test harness in `src/util/accessible-screenshot.test.ts`, `src/util/accessibility-baseline.test.ts`, and the integration tests referenced by the `pwtest-*` snapshots (`test/playwright/tests/a11y-check.spec.ts`, `a11y-fixture.spec.ts`). Prefer adding to existing files over creating new ones.
- Use temp working directories for tests that exercise file I/O, so they don't leak artifacts into the repo.
- Simulate CI by setting `process.env.CI = '1'` in a test-scope wrapper (and restoring afterward) rather than relying on the host env.
- Mock `testInfo.config.updateSnapshots` where needed via the same mocking pattern already used in the existing `accessibility-baseline.test.ts`.

## Input Dependencies
- Task 2's completed dispatch in `src/util/accessible-screenshot.ts`.

## Output Artifacts
- Updated test files under `src/util/` and `test/playwright/tests/` covering the matrix above.
- All tests passing locally.

## Implementation Notes

<details>

**Reuse existing mocking patterns.** `src/util/accessibility-baseline.test.ts` already mocks Playwright's `expect` and `testInfo` shapes; follow the same pattern. Where an integration test needs real Playwright, use the repo's existing integration harness (the `test/playwright` directory) and rely on `ddev exec npx playwright test <spec>`.

**Keep tests focused.** Per "a few tests, mostly integration": one well-constructed integration spec per dispatch branch is better than a dozen unit tests for the same logic. Combine scenarios into focused specs (e.g. one file `a11y-dispatch.spec.ts` covers all the integration cases above with small per-test fixtures).

**CI simulation.** The dispatch reads `process.env.CI`. To test both branches:

```ts
const originalCI = process.env.CI
afterEach(() => {
  if (originalCI === undefined) delete process.env.CI
  else process.env.CI = originalCI
})

it('fails on CI when seeding a baseline', async () => {
  process.env.CI = '1'
  // ...
})
```

**Cleanup.** Any baseline files written during tests live under a temp directory; clean up in `afterAll` / `afterEach` to avoid polluting the repo.

**Skip existing passing tests.** The refactor in task 2 must leave existing tests green — do not rewrite them unless their assertions need to move to a new helper. A passing `playwright test` run is the primary regression gate.

Run the full suite with:

```
ddev exec npx playwright test
ddev exec npx vitest run   # or whatever unit-test command the repo uses; inspect package.json
```

</details>
