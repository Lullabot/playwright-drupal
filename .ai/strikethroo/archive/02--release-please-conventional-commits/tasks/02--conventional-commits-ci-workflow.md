---
id: 2
group: "commit-enforcement"
dependencies: []
status: "completed"
created: "2026-03-09"
skills:
  - github-actions
---
# Create Conventional Commits CI Workflow

## Objective
Create a GitHub Actions workflow that validates both PR titles and individual commit messages against the conventional commits spec, blocking non-compliant PRs.

## Skills Required
- `github-actions`: Authoring workflow YAML with parallel jobs and third-party actions

## Acceptance Criteria
- [ ] `.github/workflows/conventional-commits.yml` exists
- [ ] Workflow triggers on `pull_request` events
- [ ] Job `lint-pr-title` validates PR title using `amannn/action-semantic-pull-request`
- [ ] Job `lint-commits` validates all commits using `webiny/action-conventional-commits`
- [ ] Both jobs run in parallel
- [ ] Job IDs match exactly: `lint-pr-title` and `lint-commits` (for branch protection rules)

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- `amannn/action-semantic-pull-request` — validates PR title
- `webiny/action-conventional-commits` — validates individual commits
- `GITHUB_TOKEN` with default permissions (no PAT needed)

## Input Dependencies
None — this task is independent.

## Output Artifacts
- `.github/workflows/conventional-commits.yml`

## Implementation Notes

<details>
<summary>Detailed implementation guidance</summary>

### .github/workflows/conventional-commits.yml

```yaml
name: Conventional Commits

on:
  pull_request:
    types: [opened, edited, synchronize, reopened]

jobs:
  lint-pr-title:
    name: Validate PR Title
    runs-on: ubuntu-latest
    steps:
      - name: Check PR title
        uses: amannn/action-semantic-pull-request@v5
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

  lint-commits:
    name: Validate Commits
    runs-on: ubuntu-latest
    steps:
      - name: Check commit messages
        uses: webiny/action-conventional-commits@v1
```

Key points:
- The `pull_request` trigger includes `edited` to re-check when the PR title changes.
- Job IDs `lint-pr-title` and `lint-commits` are intentionally chosen to match what will be configured in branch protection rules. These exact names will appear as GitHub status checks.
- `amannn/action-semantic-pull-request` validates the PR title (covers squash-merge case where PR title becomes the commit message on `main`).
- `webiny/action-conventional-commits` validates all individual commits in the PR (covers rebase-merge and fast-forward merge cases). It reads commit data via the GitHub API — no additional config files needed.
- Both jobs use `GITHUB_TOKEN` (no PAT required).
- Both jobs run in parallel (no `needs:` dependency between them).
- All standard conventional commit types are allowed (feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert) — no type restriction configuration is needed as these are the defaults.

</details>
