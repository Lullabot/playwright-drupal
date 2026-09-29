---
id: 4
group: "generic-extraction"
dependencies: [2, 3]
status: "pending"
created: 2026-09-29
skills:
  - playwright-test-design
  - typescript-api-design
complexity_score: 4
---
# Extract Visual Test Definitions and Mocks

## Objective
Move URL-driven visual test cases, masks, interaction/pseudo states, and framework-neutral mocks into the generic package using the extracted screenshot core.

## Skills Required
Use Playwright test-definition patterns and TypeScript public API design.

## Acceptance Criteria
- [ ] `defineVisualDiffConfig`, visual case/group types, default test execution, mask merging, interaction/pseudo states, skips, and generic mocks are owned and exported by the generic package.
- [ ] The visual flow calls the generic accessible screenshot API and accepts the adapter configuration needed for Drupal defaults without embedding Drupal behavior.
- [ ] Config-, group-, and case-level precedence remains compatible for masks, colors, accessibility baselines, interactions, pseudo states, paths, and representative URLs.
- [ ] Existing visual-definition and mock tests run in the generic workspace and its build exits 0.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
Extract `src/testcase/visualdiff.ts`, `src/util/mock/youtube.ts`, their index exports, and relevant tests. Do not move Drupal database-fixture behavior from `src/testcase/test.ts`. Make preset injection explicit enough for task 6 to wrap `defineVisualDiffConfig` and `defaultTestFunction` while generic direct calls remain neutral.

## Input Dependencies
Tasks 2 and 3 generic stabilization and accessible screenshot APIs.

## Output Artifacts
Generic visual-definition and mock modules, exports, and integration-focused tests.

## Implementation Notes

<details>
<summary>Execution guidance</summary>

1. Extract only visualdiff behavior; keep Drupal test database lifecycle code in the root package.
2. Preserve public types and default behavior that are not Drupal-specific. Use the generic screenshot options/preset seam instead of importing the Drupal package.
3. Preserve merge order: config first, group second, case last; the most specific scalar wins. Continue cleanup of forced pseudo states in reverse order inside `finally`.
4. Move `YoutubeMock` only if its implementation has no Drupal runtime assumption; otherwise isolate the generic portion and leave a Drupal wrapper.
5. Move/adapt tests for skip semantics, merged configuration, state application, cleanup, and mock routing. Avoid testing Playwright framework behavior itself.
</details>

