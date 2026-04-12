---
id: 5
group: "static-docs-site"
dependencies: [2, 3, 4]
status: "pending"
created: 2026-04-12
skills:
  - git
  - github-actions
---
# Open Draft PR and Verify CI

## Objective
Push the feature branch, open a draft pull request against `main`, and confirm all existing CI jobs pass.

## Skills Required
- Git
- GitHub Actions (reading CI results)

## Acceptance Criteria
- [ ] All changes are committed to the feature branch with conventional commit messages
- [ ] Feature branch is pushed to `origin`
- [ ] A draft PR is opened against `main` using `gh pr create --draft` with a clear title and description summarising the changes
- [ ] The **Conventional Commits** CI job passes on the PR
- [ ] The **CodeQL** CI job passes on the PR
- [ ] The **Test** CI job passes on the PR (unit tests + bats, though bats may be skipped in CI)
- [ ] PR URL is reported back

## Technical Requirements
- Use `gh pr create --draft` to open the PR
- PR title must follow conventional commits format (e.g. `feat: add VitePress documentation site`)
- PR description should summarise: VitePress setup, content migration, GitHub Pages workflow, Tugboat config
- Monitor CI with `gh pr checks` or `gh run list` until all jobs complete
- The `docs.yml` GitHub Pages deployment workflow does NOT need to pass — it only deploys on `main` and requires manual GitHub Pages setup; it is excluded from the CI bar

## Input Dependencies
- Task 02 output: all docs pages committed
- Task 03 output: `.github/workflows/docs.yml` committed
- Task 04 output: `.tugboat/config.yml` committed

## Output Artifacts
- Draft PR URL

## Implementation Notes
- If any of the three required CI jobs fail, investigate and fix before marking this task complete
- Conventional Commits checks the PR's commit messages — ensure all commits on the branch use the `feat:`, `chore:`, `docs:` etc. prefixes
- The bats integration tests (which spin up a full DDEV environment) are likely skipped in CI; the unit tests (`npm run test:unit`) should still pass
