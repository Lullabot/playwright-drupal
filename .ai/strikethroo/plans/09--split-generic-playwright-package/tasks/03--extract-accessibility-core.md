---
id: 3
group: "generic-extraction"
dependencies: [2]
status: "completed"
created: 2026-09-29
skills:
  - accessibility-testing
  - playwright-integration
complexity_score: 5
---
# Extract the Accessibility Core and Baselines

## Objective
Move axe scans, waiver baselines, baseline files, violation screenshots, annotations, and stable accessible screenshots into the generic package without Drupal assumptions.

## Skills Required
Use axe accessibility result processing and Playwright test/attachment integration.

## Acceptance Criteria
- [ ] The generic package owns `checkAccessibility`, `takeAccessibleScreenshot`, baseline definitions/files, known/new/stale classification, waiver validation, seeding, annotations, and highlighted screenshots.
- [ ] Every waiver still requires a reason and tracking link, stale waivers are detected, local baseline seeding remains permissive, and missing CI baselines remain strict.
- [ ] Default scans and messages are framework-neutral; Drupal exclusions and Drupal URLs are not applied unless passed by an adapter.
- [ ] Screenshot preparation composes Task 2 primitives and restores video or interaction state after success or failure.
- [ ] Accessibility and baseline tests pass through `npm test --workspace=@lullabot/playwright-testing -- --run`, and the workspace build exits 0.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
Extract `accessible-screenshot.ts`, `accessibility-baseline.ts`, `accessibility-baseline-file.ts`, and their tests. Continue using `@axe-core/playwright`, `axe-core`, and Playwright annotations/attachments/assertions. Replace `disableDefaultExclusions` as a generic concern with neutral explicit exclusions or preset configuration while leaving task 6 a path to preserve the legacy option.

## Input Dependencies
Task 2's neutral stabilization API.

## Output Artifacts
Generic accessibility modules, exported public types/functions, and focused baseline and screenshot-orchestration tests.

## Implementation Notes

<details>
<summary>Execution guidance</summary>

1. Move the three accessibility modules and meaningful tests into the generic workspace, updating imports to Task 2 modules.
2. Preserve normalization by axe rule and target, required waiver metadata, duplicate handling, baseline filenames/counting, local seed creation, explicit Playwright snapshot-update behavior, and CI failure messages.
3. Remove built-in Drupal selectors and replace Drupal-branded action hints with generic package/entry-point guidance. Generic exclusions must default to an empty set.
4. Replace project-name-specific screenshot behavior with Playwright/browser capability data or an explicit neutral option.
5. Keep violation screenshots highlighted, attached, and cleaned up without permanently altering the page. Ensure stable screenshots wait for fonts/images/frames/videos, clear incidental hover/focus, apply declared interaction states, capture, scan, and restore.
6. Update tests to assert neutral defaults and explicit configured exclusions. Do not duplicate Task 2's low-level utility tests.
</details>
