---
id: 6
group: "drupal-integration"
dependencies: [3, 4, 5]
status: "completed"
created: 2026-09-29
skills:
  - api-compatibility
  - drupal-playwright
complexity_score: 5
---
# Wire the Drupal Preset and Compatibility Adapter

## Objective
Make the root Drupal package consume the generic workspace while preserving existing public imports, commands, and Drupal-specific behavior.

## Skills Required
Use TypeScript API compatibility techniques and the repository's Drupal/Playwright integration conventions.

## Acceptance Criteria
- [x] The root package declares a runtime dependency on `@lullabot/playwright-testing` and no longer owns duplicate implementations of extracted behavior.
- [x] Existing root exports for generic APIs, GitHub subpath exports, and Drupal-branded executable names continue to resolve with compatible types and behavior.
- [x] A Drupal preset or thin wrappers add existing accessibility exclusions, toolbar-settling behavior, selector normalization where applicable, and legacy browser/project behavior without changing generic defaults.
- [x] Drupal-only Drush, database, login, form/AJAX, entity, managed-file, Gin, module, media-library, status-report, DDEV, and isolation helpers remain in the root package.
- [x] Compatibility tests, root TypeScript build, root unit tests, and Bats tests exit 0.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
Preserve imports from `@lullabot/playwright-drupal`, `/config`, `/github/a11y-summary`, `/github/failure-summary`, and `/github/attachments`. Preserve `playwright-drupal-a11y-summary` and `playwright-drupal-failure-summary`. Use wrappers, re-export modules, and preset configuration; do not copy the generic implementation back into root source. Keep `fallback.ts` Drupal-owned for `--HASHSUFFIX` selector normalization.

## Input Dependencies
Tasks 3, 4, and 5 public generic APIs and configuration seams.

## Output Artifacts
Root dependency/exports updates, Drupal preset and wrappers, compatibility command shims, removal of duplicate extracted code, and compatibility tests.

## Implementation Notes

<details>
<summary>Execution guidance</summary>

1. Add the generic workspace dependency at its real package version and update the lockfile.
2. Create a Drupal preset containing axe exclusions, optional toolbar selectors/delay, and any legacy screenshot/project adjustment. Do not move `fallback.ts`; expose selector normalization separately if it was already public.
3. Replace extracted root modules with wrapper/re-export modules so internal root imports and public declaration paths remain stable. Functions with neutral behavior can re-export directly; functions with Drupal defaults must wrap and merge caller options without overwriting explicit choices.
4. Make the root visualdiff wrapper pass the Drupal preset through generic visual helpers. Keep `src/testcase/test.ts` and Drupal database lifecycle code local.
5. Re-export generic GitHub APIs through all legacy subpaths. Keep legacy bins as shims and configure legacy marker/message behavior when compatibility tests show it is observable.
6. Remove duplicate implementations and duplicate tests only after replacement coverage exists. Add import-level and behavior-level compatibility tests, then run root and generic suites.
</details>

## Noteworthy Events
- [2026-09-29] Added narrow generic GitHub adapter seams for command names and failure/flake marker prefixes so the generic defaults remain neutral while legacy Drupal commands preserve their observable output.
- [2026-09-29] Updated the Bats consumer fixture to pack and install both workspace tarballs; the focused 14-test Drupal/docroot integration suite and 17 mutex shell tests passed, alongside 243 generic tests, 206 root unit/compatibility tests, both package builds, legacy subpath probes, command help checks, and package-content verification.
- [2026-09-29] A full-suite validation exposed that the new GitHub wrappers no longer auto-invoked when their compiled modules were executed directly. Restored `require.main` handling for both a11y and failure summaries, added child-process regressions, and passed all 11 filtered integration visual-summary checks including path remapping, summary output, and comment generation.
- [2026-09-29] Parent verification ran all 89 Bats cases and found three failures in `test/integration.bats`: direct execution of the legacy `lib/github/failure-summary.js` subpath exited 0 without invoking its CLI, so no remapping log, step summary, or comment was produced. Remediation is to preserve direct-module auto-invocation in the Drupal wrapper, add regression coverage, and rerun the affected integration file before completing this task.
