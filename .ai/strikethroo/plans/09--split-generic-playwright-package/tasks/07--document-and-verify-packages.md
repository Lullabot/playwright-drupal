---
id: 7
group: "release-readiness"
dependencies: [6]
status: "completed"
created: 2026-09-29
skills:
  - technical-documentation
  - package-integration-testing
complexity_score: 5
---
# Document and Verify Both Publishable Packages

## Objective
Make generic documentation canonical, refocus Drupal documentation, and prove both packed packages from consumer-style installations.

## Skills Required
Use technical documentation architecture and npm package integration testing.

## Acceptance Criteria
- [ ] The generic workspace includes canonical accessibility, screenshot/visual, and GitHub reporting documentation with neutral imports and examples.
- [ ] Root README, contributor/release guidance, MkDocs navigation, and Drupal guides describe the monorepo, Drupal preset, compatibility imports, Drupal-only additions, and links to the generic reference without contradictory duplication.
- [ ] Dry-run packs for both packages include every declared export, executable, declaration, README, and required runtime source while excluding unrelated workspace files.
- [ ] Temporary consumer probes install packed artifacts and import generic root/`./github` APIs plus Drupal root and legacy GitHub subpaths; legacy executable help paths run.
- [ ] A generic-source audit finds no unintended Drupal selectors, state keys, package URLs, or project names.
- [ ] The full build, unit/Bats tests, and strict documentation build exit 0.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
Place canonical generic guides inside `packages/playwright-testing`. Keep Drupal database-fixture and DDEV instructions in root docs. Update `mkdocs.yml` so repository documentation can reach relevant generic material without copying it. Use `npm pack --dry-run` and temporary-directory consumer installs; never publish packages as part of this task.

## Input Dependencies
Task 6's complete package boundary and compatibility layer.

## Output Artifacts
Updated generic and Drupal documentation, validated pack manifests, consumer-probe evidence, generic-coupling audit results, and full-suite results.

## Implementation Notes

<details>
<summary>Execution guidance</summary>

1. Move or rewrite canonical material from accessibility, screenshots-in-CI, visual comparisons, and relevant debugging sections into workspace docs. Use `@lullabot/playwright-testing` and `@lullabot/playwright-testing/github` examples.
2. Shorten root guides to Drupal installation/preset behavior, Drupal database fixtures, compatibility examples, and links to the canonical files. Keep the main MkDocs site coherent and strict-buildable.
3. Update READMEs and contributor/release docs for workspace-specific commands and independent releases. No `AGENTS.md` edit is needed.
4. Build both packages, capture `npm pack --dry-run --json` results, and assert every manifest export/bin target is present. Then create a temporary directory, pack actual tarballs, install them without mutating the repository, and run CommonJS or ESM import probes appropriate to the published output.
5. Search the generic workspace for `Drupal`, `playwright-drupal`, Drupal toolbar selectors, `__playwrightDrupal`, and `desktop safari`. Documentation comparing migration paths may mention the Drupal package, but generic runtime defaults may not.
6. Run `npm test`, the aggregate build command, and `npm run docs:build`. Fix package boundary or documentation errors within scope.
7. Testing philosophy: write a few tests, mostly integration. Test custom behavior, critical workflows, data transformations, core edge/error cases, integration points, and complex validation. Do not test third-party framework behavior, trivial getters/setters, static configuration, or obvious forwarding. Combine related scenarios and favor packed-consumer and critical-path coverage.
</details>

## Noteworthy Events
- [2026-09-29] Added canonical framework-neutral accessibility, screenshot/visual-comparison, and GitHub reporting guides inside `packages/playwright-testing`; refocused the Drupal guides on the adapter preset, compatibility imports and executables, DDEV, and database fixtures; and linked the package-owned guides from MkDocs without duplicating them.
- [2026-09-29] Updated the release workflow so root and `packages/playwright-testing` Release Please outputs independently gate publication from the correct package directory. The workflow YAML parsed successfully and its path-prefixed generic release output matches Release Please's documented monorepo contract.
- [2026-09-29] Verified dry-run packs (158 Drupal files and 82 generic files) contain every manifest entry point, executable, matching declaration, README, and required source without cross-workspace or repository-only paths. Actual tarballs installed into an empty temporary consumer and imported the generic root/`./github`, Drupal root, and all legacy GitHub subpaths; both generic and both legacy reporting executable help paths ran successfully.
- [2026-09-29] Reviewed the generic neutrality audit. Runtime and executable sources contain no Drupal selectors, state keys, package names, URLs, or project defaults. Remaining matches are intentional repository/migration documentation, required repository metadata, and a regression test proving an old project name has no generic effect.
- [2026-09-29] Final verification passed: aggregate TypeScript builds, strict MkDocs build, 208 Drupal unit tests, 243 generic tests, all 89 Bats integration checks, whitespace/diff validation, and release-workflow YAML assertions. Documentation-only changes did not warrant additional unit tests; packed-consumer and full integration checks supplied the task's required behavioral coverage.
