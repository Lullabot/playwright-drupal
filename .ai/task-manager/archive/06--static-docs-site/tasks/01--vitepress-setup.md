---
id: 1
group: "static-docs-site"
dependencies: []
status: "completed"
created: 2026-04-12
skills:
  - typescript
  - npm
---
# VitePress Installation and Configuration

## Objective
Install VitePress as a devDependency, create `docs/.vitepress/config.ts` with the correct `base` for GitHub Pages, add `docs:dev`, `docs:build`, and `docs:preview` scripts to the root `package.json`, and add the VitePress cache and build output to `.gitignore`.

## Skills Required
- TypeScript (VitePress config file)
- npm (package.json changes, install)

## Acceptance Criteria
- [ ] `vitepress` is added to `devDependencies` in `package.json` and `package-lock.json` is updated
- [ ] `docs:dev`, `docs:build`, `docs:preview` scripts are added to `package.json`
- [ ] `docs/.vitepress/config.ts` exists with `base: '/playwright-drupal/'`, correct `title`, and a sidebar stub with all six section placeholders
- [ ] `docs/.vitepress/cache/` and `docs/.vitepress/dist/` are added to `.gitignore`
- [ ] `npm run docs:build` completes without errors (even with empty/stub docs pages)
- [ ] A `docs/index.md` stub exists so VitePress has an entry point

## Technical Requirements
- VitePress latest stable version
- `base: '/playwright-drupal/'` is required in `config.ts` for GitHub Pages project-page deployment
- The sidebar should define six items (Getting Started, Writing Tests, Visual Comparisons, Configuration, GitHub Actions & Accessibility, Development) — file paths don't need to resolve yet, just the structure
- `docs/index.md` should be a minimal frontmatter-only stub so the build passes

## Input Dependencies
None.

## Output Artifacts
- `package.json` with VitePress devDependency and docs scripts
- `package-lock.json` updated
- `docs/.vitepress/config.ts`
- `docs/index.md` (stub)
- `.gitignore` updated

## Implementation Notes
- VitePress is already excluded from the npm publish `files` array — no change needed there
- The `base` option must include a trailing slash: `'/playwright-drupal/'`
- Do not add a separate `tsconfig.json` inside `docs/.vitepress/` — VitePress handles its own TypeScript compilation internally
- The sidebar stub items can reference placeholder file paths; they'll be filled in during content migration
