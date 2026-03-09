---
id: 2
group: "ci-cd"
dependencies: []
status: "pending"
created: "2026-02-27"
skills:
  - github-actions
---
# Create GitHub Actions CI Workflow

## Objective
Create `.github/workflows/test.yml` that runs the bats integration tests on push to main and on pull requests. The workflow should use the official DDEV GitHub Action and produce Playwright report artifacts for debugging.

## Skills Required
- `github-actions`: GitHub Actions workflow authoring

## Acceptance Criteria
- [ ] `.github/workflows/test.yml` exists and is valid YAML
- [ ] Workflow triggers on push to `main` and on pull requests
- [ ] Installs bats-core via `apt-get`
- [ ] Installs DDEV using `ddev/github-action-setup-ddev@v1` with `autostart: false`
- [ ] Runs `bats test/` as the test command
- [ ] Has a 30-minute job timeout
- [ ] Uploads Playwright report as artifact (always, for debugging)
- [ ] Runs on `ubuntu-latest`

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- `ddev/github-action-setup-ddev@v1` action (with `autostart: false` since bats manages DDEV lifecycle)
- `apt-get install -y bats` for bats-core installation
- `actions/upload-artifact@v4` for Playwright report upload
- The Playwright report path will be inside the temp directory created by bats; use a glob pattern or known path

## Input Dependencies
- None (independent of task 1, created in parallel)

## Output Artifacts
- `.github/workflows/test.yml`

## Implementation Notes

<details>
<summary>Detailed implementation guidance</summary>

### .github/workflows/test.yml

The workflow should look approximately like this:

```yaml
name: Test

on:
  push:
    branches: [main]
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Install bats
        run: sudo apt-get update && sudo apt-get install -y bats

      - name: Install DDEV
        uses: ddev/github-action-setup-ddev@v1
        with:
          autostart: false

      - name: Run integration tests
        run: bats test/

      - name: Upload Playwright report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: /tmp/pwtest-*/test/playwright/playwright-report/
          retention-days: 7
          if-no-files-found: ignore
```

### Key notes

- **`autostart: false`**: Critical — bats creates its own DDEV project in a temp dir, so we don't want the GitHub Action to try starting a project in the checkout directory.
- **Playwright report path**: The bats test creates a temp directory like `/tmp/pwtest-XXXX/`. The Playwright report will be inside that directory. Use a glob pattern to find it. Note: `teardown_file` may delete this before artifact upload. Consider whether teardown should be conditional or if the report should be copied out first. The simplest approach: if `teardown_file` runs, the report is gone. The `if: always()` + `if-no-files-found: ignore` handles this gracefully — the report is available on failure (when teardown may not run) and absent on success (which is fine).
- **`ddev/github-action-setup-ddev@v1`**: This handles Docker setup and DDEV installation on the GitHub Actions runner. It pins to v1 for stability.
- **Renovate compatibility**: The existing `renovate.json` has `helpers:pinGitHubActionDigests` which will automatically pin action versions to SHA digests on PR. This is expected behavior.

</details>
