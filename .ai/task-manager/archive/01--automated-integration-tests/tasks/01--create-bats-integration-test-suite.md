---
id: 1
group: "integration-tests"
dependencies: []
status: "pending"
created: "2026-02-27"
skills:
  - bash
  - e2e-testing
---
# Create bats Integration Test Suite

## Objective
Create the bats-core integration test files (`test/test_helper.bash` and `test/integration.bats`) and update `package.json` test script. These files implement the full README workflow: creating a DDEV Drupal project, installing playwright-drupal, configuring everything, running the example Playwright tests, and asserting on results.

## Skills Required
- `bash`: Shell scripting and bats-core test authoring
- `e2e-testing`: End-to-end integration test design

## Acceptance Criteria
- [ ] `test/test_helper.bash` exists with helper functions for DDEV project setup, configuration, and teardown
- [ ] `test/integration.bats` exists with `setup_file`, `teardown_file`, and individual `@test` assertions
- [ ] `package.json` test script updated from error stub to `bats test/`
- [ ] The bats test follows the README step-by-step (ddev config, composer create-project, install-playwright, npm pack, configure, run tests)
- [ ] Playwright output is captured to a file for individual assertions
- [ ] DDEV project uses randomized name suffix (e.g. `pwtest-a3f2`)
- [ ] `teardown_file` always cleans up (ddev delete -Oy + rm temp dir)

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- bats-core framework (no bats-assert/bats-support libraries needed — basic assertions are sufficient)
- `npm pack` to create tarball from local checkout, installed inside DDEV container
- Chromium-only Playwright config with `workers: process.env.CI ? 1 : undefined`
- Playwright retries: 2 in CI for stability

## Input Dependencies
- README.md for the step-by-step setup guide
- `package.json` for the test script update
- Copilot branch `copilot/add-github-workflow-for-testing` as reference (but build independently)

## Output Artifacts
- `test/test_helper.bash` — helper functions
- `test/integration.bats` — bats test file
- Updated `package.json` with `"test": "bats test/"`

## Implementation Notes

<details>
<summary>Detailed implementation guidance</summary>

### test/test_helper.bash

This file should contain:

1. **`setup_drupal_project()`** function that:
   - Creates a temp directory (use `mktemp -d`)
   - Generates a random project name like `pwtest-$(head -c 4 /dev/urandom | xxd -p | head -c 4)`
   - Runs the README steps in sequence:
     - `ddev config --project-type=drupal11 --docroot=web --project-name=$PROJECT_NAME`
     - `ddev start`
     - `ddev composer create-project drupal/recommended-project` (NOT `ddev composer create` which is deprecated)
     - `ddev composer require drush/drush`
     - `ddev add-on get Lullabot/ddev-playwright`
     - `ddev restart`
     - `mkdir -p test/playwright`
     - `ddev exec -- npx create-playwright@latest --lang=TypeScript --quiet test/playwright --no-browsers`
     - `ddev install-playwright`
   - Stores the project dir and name in BATS_FILE_TMPDIR or global variables for other functions to use

2. **`install_playwright_drupal()`** function that:
   - Runs `npm pack` from the original repo checkout directory (the checkout path should be saved before cd'ing into the temp dir)
   - Copies the `.tgz` tarball to the Drupal project root
   - Installs inside DDEV: `ddev exec -d /var/www/html/test/playwright npm install "/var/www/html/$TARBALL_NAME"`

3. **`configure_playwright()`** function that:
   - Writes `test/playwright/tsconfig.json` per the README
   - Writes `test/playwright/playwright.config.ts` with:
     - `globalSetup: require.resolve('./node_modules/@lullabot/playwright-drupal/lib/setup/global-setup')`
     - `baseURL: process.env.DDEV_PRIMARY_URL`
     - `ignoreHTTPSErrors: true`
     - Single chromium project only
     - `workers: process.env.CI ? 1 : undefined`
     - `retries: process.env.CI ? 2 : 0`
   - Adds settings.playwright.php include to `web/sites/default/settings.php`
   - Creates `Taskfile.yml` in the project root
   - Adds `/packages/playwright-drupal` to `test/playwright/.gitignore`

4. **`write_example_test()`** function that:
   - Removes default Playwright example tests (`rm -f test/playwright/tests/example.spec.ts; rm -rf test/playwright/tests-examples`)
   - Writes the `test/playwright/tests/example.drupal.spec.ts` from the README (the exact test content from the README's "Create and Run an Example Drupal Test" section)

5. **`run_playwright_tests()`** function that:
   - Runs `ddev exec -d /var/www/html/test/playwright npx playwright test` and captures stdout+stderr to a file (e.g. `$BATS_FILE_TMPDIR/playwright_output.txt`)
   - Saves the exit code to a file (e.g. `$BATS_FILE_TMPDIR/playwright_exit_code`)

6. **`cleanup_drupal_project()`** function that:
   - cd's into the project dir
   - Runs `ddev delete -Oy` (delete project without confirmation)
   - cd's back
   - Removes the temp directory

### test/integration.bats

```bash
#!/usr/bin/env bats

setup_file() {
  load test_helper

  # Save the repo root for npm pack later
  export REPO_ROOT="$(cd "$(dirname "$BATS_TEST_FILENAME")/.." && pwd)"

  # Run the full setup
  setup_drupal_project
  install_playwright_drupal
  configure_playwright
  write_example_test
  run_playwright_tests
}

teardown_file() {
  load test_helper
  cleanup_drupal_project
}

@test "prerequisites: ddev is installed" {
  command -v ddev
}

@test "prerequisites: docker is installed" {
  command -v docker
}

@test "playwright tests exit with code 0" {
  # Read the captured exit code
  [ "$(cat "$BATS_FILE_TMPDIR/playwright_exit_code")" -eq 0 ]
}

@test "playwright output shows 2 passed tests" {
  grep -q "2 passed" "$BATS_FILE_TMPDIR/playwright_output.txt"
}

@test "playwright output shows no failures" {
  ! grep -q "failed" "$BATS_FILE_TMPDIR/playwright_output.txt"
}
```

### package.json change

Change `"test": "echo \"Error: no test specified\" && exit 1"` to `"test": "bats test/"`.

### Key technical notes

- **Host vs container boundary**: `npm pack` runs on the host. The tarball is copied into the Drupal project directory which is bind-mounted at `/var/www/html/` inside DDEV. So `ddev exec npm install /var/www/html/tarball.tgz` works.
- **`ddev composer create-project`**: Use this, NOT `ddev composer create` (deprecated in v1.25+).
- **BATS_FILE_TMPDIR**: bats provides this automatically for `setup_file`/`teardown_file` scope. Use it to share state between setup and tests.
- **Error handling in setup_file**: If any step fails, bats will report the setup failure. Individual @test blocks will show as "not run" which is correct behavior.

</details>
