---
id: 5
group: "delivery"
dependencies: [3, 4]
status: "pending"
created: 2026-04-14
skills:
  - github-actions
  - bash
---
# Push branch, open draft PR, and confirm CI passes

## Objective
Ship the work: commit the implementation and docs, push the feature branch, open a **draft** pull request against `main` with a clear description and test plan, and make sure every required CI check passes green. Leave the PR in draft — per the plan, that's the terminal state.

## Skills Required
- `bash`, `github-actions` — git operations, `gh` CLI, monitoring CI.

## Acceptance Criteria
- [ ] All implementation, test, and documentation changes are committed in focused commits on the existing feature branch `feature/8--a11y-default-baseline-for-new-tests`.
- [ ] Branch is pushed to `origin` with upstream tracking set.
- [ ] A **draft** PR is opened against `main` using `gh pr create --draft`, with a title under ~70 chars and a body containing: summary (3–5 bullets), migration note (existing snapshots unchanged, new tests seed baselines, `--update-snapshots` opts into snapshot mode, CI seeds-and-fails), and a short test plan checklist.
- [ ] The PR description links to or quotes the plan's Success Criteria so reviewers can cross-check.
- [ ] All required CI status checks on the PR are green. If any check fails, diagnose and fix (do not mark ready-for-review, do not bypass checks) until all are green.
- [ ] The PR remains in **draft** status when this task is marked complete — do NOT mark it ready-for-review.
- [ ] The stashed `package-lock.json` change from before the feature branch was created is NOT incorporated into this PR (it was unrelated); leave it stashed for the user to handle separately.

## Technical Requirements
- Use `gh` for PR creation and CI inspection (`gh pr checks`).
- Do not use `--no-verify` on commits; if a pre-commit hook fails, fix the underlying issue.
- Do not force-push unless explicitly required to resolve a branch-protection rule, and never to `main`.

## Input Dependencies
- Task 3 (tests pass locally) and task 4 (docs landed) both complete.

## Output Artifacts
- A commit history on `feature/8--a11y-default-baseline-for-new-tests`.
- A draft PR on GitHub against `main`.
- Confirmation (logged in the execution summary) that all required CI checks are green.

## Implementation Notes

<details>

**Commit strategy.** Prefer a small number of logical commits rather than one giant one:

1. `feat(a11y): add on-disk baseline file helper` (task 1 output)
2. `feat(a11y): default new tests to baseline mode with CI fail-on-seed` (task 2 output)
3. `test(a11y): cover new dispatch matrix` (task 3 output)
4. `docs(a11y): describe new baseline default` (task 4 output)

All commits signed off by the Claude co-author line per repo convention.

**Draft PR creation.**

```bash
gh pr create \
  --draft \
  --base main \
  --head feature/8--a11y-default-baseline-for-new-tests \
  --title "feat(a11y): default new tests to baseline mode, preserve snapshot mode for existing tests" \
  --body "$(cat <<'EOF'
## Summary
- New a11y tests default to baseline mode (on-disk JSON file); existing tests with snapshots are unchanged.
- `{ note, violations }` schema. Per-call counter, one file per test across browsers.
- CI writes the seeded file and fails the test — matches Playwright's missing-snapshot behavior.
- Best-practice scan gets the same dispatch with its own baseline file.

## Migration
- Existing snapshots: nothing to do.
- New test needs snapshot mode? Run once with `--update-snapshots`.
- New test with a11y violations: run locally, a baseline JSON is seeded with `TODO` placeholders; fill them in and commit.

## Test plan
- [ ] Existing snapshot-mode tests still green.
- [ ] Snapshotless test with violations seeds JSON locally and passes; fails on CI with clear message.
- [ ] Snapshotless test with zero violations seeds an empty baseline locally.
- [ ] Explicit `options.baseline` still takes precedence.
- [ ] Multi-call test produces per-counter files.
- [ ] Best-practice scan uses its own baseline file.
EOF
)"
```

**CI monitoring.**

```bash
gh pr checks --watch
```

If a check fails, read the failing job logs, identify the root cause (lint? type error? snapshot drift? test failure?), fix on a new commit, push, and re-run the watch. Do not bypass.

**Do not merge.** The terminal state for this task is a green, draft PR. Leave it as-is.

**Stashed package-lock.** Before the feature branch was cut, `package-lock.json` was stashed (not on this branch). Do not restore or include it in this PR; it is out of scope for plan 8.

</details>
