---
id: 3
group: "validation"
dependencies: [1, 2]
status: "pending"
created: "2026-02-27"
skills:
  - bash
  - e2e-testing
---
# Run Tests Locally and Fix Until Passing

## Objective
Execute `bats test/` locally, diagnose any failures, fix the test files, and iterate until all bats tests pass. This is the critical validation step — the plan explicitly requires all tests to pass locally before considering the work complete.

## Skills Required
- `bash`: Debugging shell scripts and bats tests
- `e2e-testing`: Understanding Playwright test output and DDEV behavior

## Acceptance Criteria
- [ ] `bats test/` exits with code 0
- [ ] All individual `@test` assertions pass
- [ ] Playwright output shows "2 passed" (has title + proves parallel tests work)
- [ ] No leftover DDEV projects or temp directories after test run
- [ ] Any fixes made during iteration are reflected in the test files from tasks 1 and 2

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- Local DDEV + Docker environment (already available)
- bats-core installed locally
- Full test run takes ~10-15 minutes (DDEV setup + Drupal install + Playwright)

## Input Dependencies
- `test/test_helper.bash` from task 1
- `test/integration.bats` from task 1
- `.github/workflows/test.yml` from task 2 (to verify it references paths correctly)

## Output Artifacts
- Verified, passing test suite
- Any bug fixes applied to files from tasks 1 and 2

## Implementation Notes

<details>
<summary>Detailed implementation guidance</summary>

### Running the tests

```bash
bats test/
```

### Common issues to watch for

1. **DDEV startup failures**: Check `ddev describe` and `ddev logs` for container issues.
2. **`ddev composer create-project` failures**: May need `--yes` flag or the download might time out. Check if DDEV needs `ddev start` before composer.
3. **npm pack path issues**: Ensure the tarball path is correct relative to the DDEV bind mount at `/var/www/html/`.
4. **Playwright browser installation**: `ddev install-playwright` rebuilds the web image. This is slow (~5 min). Be patient.
5. **settings.php permissions**: `web/sites/default/settings.php` may be read-only. Use `chmod` before appending.
6. **SQLite directory**: The Playwright task creates databases in `/tmp/sqlite/`. This should work inside DDEV containers.
7. **SIMPLETEST_USER_AGENT cookie**: The test isolation depends on this cookie being set correctly. If tests fail with "The test site is not working", check that settings.playwright.php is being included correctly.

### Debugging tips

- Run bats with `--tap` for TAP output: `bats --tap test/`
- Check `$BATS_FILE_TMPDIR/playwright_output.txt` for full Playwright output
- Check `$BATS_FILE_TMPDIR/playwright_exit_code` for the exit code
- Use `ddev list` to verify no stale projects are left behind
- If a test hangs, check `ddev describe` in the project directory

### Iteration approach

1. Run `bats test/`
2. If setup_file fails, look at the error output — it will show which command failed
3. Fix the relevant helper function in test_helper.bash
4. Re-run `bats test/`
5. Repeat until all tests pass

</details>
