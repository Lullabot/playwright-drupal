---
id: 3
group: "static-docs-site"
dependencies: [1]
status: "pending"
created: 2026-04-12
skills:
  - github-actions
---
# GitHub Pages Deployment Workflow

## Objective
Create `.github/workflows/docs.yml` that builds the VitePress site and deploys it to GitHub Pages on every push to `main`.

## Skills Required
- GitHub Actions

## Acceptance Criteria
- [ ] `.github/workflows/docs.yml` exists and is valid YAML
- [ ] The workflow triggers on `push` to `main` and has a `workflow_dispatch` for manual runs
- [ ] Correct `permissions` block: `contents: read`, `pages: write`, `id-token: write`
- [ ] `concurrency` is configured to cancel in-progress deployments (standard Pages pattern)
- [ ] Build step runs `npm ci` then `npm run docs:build`
- [ ] Uses `actions/configure-pages`, `actions/upload-pages-artifact` (with `path: docs/.vitepress/dist`), and `actions/deploy-pages`
- [ ] Uses pinned SHA digests for all third-party actions (consistent with existing workflows in this repo)
- [ ] The workflow passes `act` dry-run or at minimum validates as correct YAML with no obvious errors

## Technical Requirements
- Pin action versions to SHA digests (inspect existing `.github/workflows/` files for the pattern used in this repo)
- `upload-pages-artifact` must point at `docs/.vitepress/dist` not the repo root
- The deploy job must `needs: build` and use `environment: github-pages` with the pages URL output

## Input Dependencies
- Task 01 output: `docs:build` npm script defined in `package.json`

## Output Artifacts
- `.github/workflows/docs.yml`

## Implementation Notes
- Look at existing workflows (e.g. `test.yml`, `codeql.yml`) for the SHA pinning convention used in this repo
- The workflow does NOT need to pass on the PR — it only deploys on `main` and requires GitHub Pages to be manually enabled in repo settings. It just needs to be syntactically valid.
- Do not add `on: pull_request` trigger — this deployment workflow is `main`-only
