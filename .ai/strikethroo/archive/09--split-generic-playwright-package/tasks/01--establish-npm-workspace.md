---
id: 1
group: "workspace-foundation"
dependencies: []
status: "completed"
created: 2026-09-29
skills:
  - npm-workspaces
  - typescript-packaging
complexity_score: 4
---
# Establish the npm Workspace and Generic Package Shell

## Objective
Create the monorepo foundation and a separately buildable `@lullabot/playwright-testing` workspace without relocating or breaking the root Drupal package.

## Skills Required
Use npm workspace configuration and TypeScript package/export design.

## Acceptance Criteria
- [ ] The root manifest declares `packages/*` workspaces and coordinated build/test scripts while retaining the root `@lullabot/playwright-drupal` package.
- [ ] `packages/playwright-testing` has a publishable manifest, TypeScript and Vitest configuration, source entry points for `.` and `./github`, and an explicit files list.
- [ ] Dependency declarations are owned by the package that imports them and the lockfile represents both workspaces.
- [ ] Release Please configuration and `.release-please-manifest.json` recognize both independently versioned packages.
- [ ] `npm install`, `npm run build --workspace=@lullabot/playwright-testing`, and `npm test --workspace=@lullabot/playwright-testing` exit 0 for the package shell.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
Use npm workspaces, NodeNext TypeScript output, declaration generation, and the existing Vitest toolchain. The generic manifest must export the package root and `./github`; do not create a third package. Keep root package publication intact.

## Input Dependencies
The current root `package.json`, lockfile, TypeScript/Vitest configs, release configuration, and Plan 9 architecture.

## Output Artifacts
A generic workspace shell and root/release configuration that later extraction tasks can populate.

## Implementation Notes

<details>
<summary>Execution guidance</summary>

1. Add `workspaces: ["packages/*"]` to the root package and workspace-aware aggregate scripts that do not recursively invoke themselves. Preserve the root package's existing direct scripts and public metadata.
2. Create `packages/playwright-testing/package.json` with the recommended package name, an initial independent version, Apache-2.0 licensing, repository metadata, `main`, `types`, `files`, and `exports` for `.` and `./github`. Add generic reporting bin names only if their source stubs can resolve after build.
3. Add workspace-local `tsconfig.json`, `vitest.config.ts`, `src/index.ts`, and `src/github/index.ts`. Keep the shell minimal; behavior belongs to later tasks.
4. Declare Playwright, axe, Node types, and build/test tools where they are actually used. npm may hoist them, but manifests must remain correct when packed independently.
5. Update release-please package mappings and the release manifest for the new workspace without changing the root package's current version.
6. Regenerate `package-lock.json` with npm and run the acceptance commands. Do not move Drupal source, docs, DDEV files, or repository automation into the workspace.
</details>

## Noteworthy Events
- 2026-09-29: The task-specific acceptance commands passed. An additional optional `npm run test:all` check was stopped during the long DDEV-backed Bats setup after all 333 root Vitest tests had passed; its temporary DDEV project was cleaned up, and the interruption does not affect the required workspace-shell verification.
