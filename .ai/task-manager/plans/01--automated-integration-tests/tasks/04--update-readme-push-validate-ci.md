---
id: 4
group: "documentation-and-ci"
dependencies: [3]
status: "pending"
created: "2026-02-27"
skills:
  - documentation
  - github-actions
---
# Update README and Push to Validate CI

## Objective
Add a "Development" section to the README explaining how to run the integration tests locally. Then push the `add-tests` branch and monitor GitHub Actions CI workflow runs until they pass, fixing any CI-specific failures.

## Skills Required
- `documentation`: README authoring
- `github-actions`: CI debugging and workflow iteration

## Acceptance Criteria
- [ ] README.md has a new section documenting how to run tests (prerequisites + commands)
- [ ] Branch `add-tests` is pushed to origin
- [ ] GitHub Actions workflow triggers and runs successfully
- [ ] If CI fails, issues are diagnosed from logs, fixed, and re-pushed until green
- [ ] CI workflow shows all bats tests passing

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- `git push` access to the `add-tests` branch on origin
- `gh` CLI for monitoring workflow runs (`gh run list`, `gh run view`)
- Ability to read CI logs and diagnose CI-specific issues (e.g. Docker, DDEV, network)

## Input Dependencies
- All test files from tasks 1-3 verified locally
- GitHub Actions workflow from task 2

## Output Artifacts
- Updated `README.md` with development/testing documentation
- Green CI pipeline on the `add-tests` branch

## Implementation Notes

<details>
<summary>Detailed implementation guidance</summary>

### README section to add

Add a "Development" section near the end of the README (before any existing "Notes" section), something like:

```markdown
## Development

### Running Tests

This project uses [bats-core](https://github.com/bats-core/bats-core) for integration testing. The tests create a fresh DDEV Drupal project, install this library, and run the example Playwright tests to verify everything works end-to-end.

**Prerequisites:**
- [DDEV](https://ddev.readthedocs.io/en/stable/) (v1.25+)
- [Docker](https://docs.docker.com/get-docker/)
- [bats-core](https://bats-core.readthedocs.io/en/stable/installation.html)

**Run the tests:**
```console
bats test/
```

Tests take approximately 10-15 minutes as they set up a complete Drupal environment.
```

### Push and monitor flow

1. Commit the README update
2. `git push origin add-tests`
3. Monitor with `gh run list --branch add-tests`
4. If workflow fails, check logs with `gh run view <run-id> --log-failed`
5. Fix issues, commit, push again
6. Repeat until green

### Common CI-specific issues

- **DDEV action version**: The `ddev/github-action-setup-ddev@v1` should handle Docker setup, but watch for version mismatches.
- **Apt mirror issues**: `apt-get install bats` can fail on slow mirrors. The `apt-get update` beforehand usually resolves this.
- **Timeout**: The 30-minute timeout should be sufficient, but if `ddev install-playwright` is slow, consider increasing.
- **Playwright report artifact**: The upload step uses `if-no-files-found: ignore` so it won't fail if teardown already cleaned up.

</details>
