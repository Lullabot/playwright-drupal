---
id: 5
group: "generic-extraction"
dependencies: [1]
status: "pending"
created: 2026-09-29
skills:
  - github-actions-reporting
  - node-cli-packaging
complexity_score: 4
---
# Extract the GitHub Reporting Entry Point

## Objective
Move accessibility/failure summaries, screenshot attachments, report path remapping, and generic reporter commands under `@lullabot/playwright-testing/github`.

## Skills Required
Use GitHub Actions report formatting and Node package/CLI entry-point design.

## Acceptance Criteria
- [ ] `@lullabot/playwright-testing/github` exports accessibility summaries, failure summaries, attachment discovery, and report-path remapping.
- [ ] Generic report markers, diagnostics, package names, and executable names are framework-neutral.
- [ ] Generic executable targets are included in `npm pack --dry-run --workspace=@lullabot/playwright-testing` and their help paths execute after build.
- [ ] Existing report, attachment, and path-remapping tests run from the generic workspace and the workspace build exits 0.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
Extract `src/github/*` and the reporting command behavior from `bin/github-a11y-summary` and `bin/github-failure-summary`. Aggregate library exports through one `./github` package export. Do not create a separate npm package. Preserve machine-readable behavior while neutralizing Drupal-branded marker prefixes and help text; task 6 owns legacy compatibility markers, subpaths, and command names where required.

## Input Dependencies
Task 1's generic workspace and current GitHub source/tests/bins.

## Output Artifacts
Generic GitHub source, tests, secondary entry point, and package-owned reporting executables.

## Implementation Notes

<details>
<summary>Execution guidance</summary>

1. Copy the report modules and tests to `packages/playwright-testing/src/github`, then add a barrel exporting their supported library API.
2. Rename Drupal marker constants and user-facing messages to `playwright-testing` terminology. Where compatibility requires old marker parsing, design a small namespace/configuration seam rather than putting Drupal strings in generic defaults.
3. Add executable shims inside the generic package that require its compiled modules using paths valid in the packed artifact. Include executable files in `files` and `bin`.
4. Retain attachment classification, expected/actual/diff handling, annotations, summary modes, escaping, project/test metadata, and container/host path mapping.
5. Run focused tests plus a dry-run pack listing. Leave existing root exports/bins untouched until task 6.
</details>

