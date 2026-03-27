#!/usr/bin/env bats

# integration.bats — Integration tests for @lullabot/playwright-drupal.
# Proves the README example works end-to-end: DDEV project creation,
# playwright-drupal installation, configuration, and test execution.
#
# Each setup step is its own @test so that CI logs show progress as each
# step completes rather than buffering all output until the very end.

setup_file() {
  # Save the repo root before changing directories.
  export REPO_ROOT="$(cd "$(dirname "$BATS_TEST_FILENAME")/.." && pwd)"
}

teardown_file() {
  load test_helper
  cleanup_drupal_project
}

# Load test_helper before each test so all helper functions are available.
setup() {
  load test_helper
}

@test "prerequisites: ddev is installed" {
  command -v ddev
}

@test "prerequisites: docker is installed" {
  command -v docker
}

@test "setup: create Drupal project with DDEV" {
  setup_drupal_project
}

@test "setup: configure Playwright" {
  configure_playwright
}

@test "setup: write example tests" {
  write_example_test
}

@test "playwright: run tests" {
  run_playwright_tests
}

@test "playwright: tests exit with code 0" {
  local exit_code
  exit_code="$(cat "$BATS_FILE_TMPDIR/playwright_exit_code")"
  if [ "$exit_code" -ne 0 ]; then
    echo "Playwright exited with code $exit_code. Output:" >&2
    cat "$BATS_FILE_TMPDIR/playwright_output.txt" >&2
    return 1
  fi
}

@test "playwright: output shows passed tests" {
  if ! grep -q "passed" "$BATS_FILE_TMPDIR/playwright_output.txt"; then
    echo "Expected 'passed' in output. Actual output:" >&2
    cat "$BATS_FILE_TMPDIR/playwright_output.txt" >&2
    return 1
  fi
}

@test "playwright: output shows no failures" {
  if grep -q "failed" "$BATS_FILE_TMPDIR/playwright_output.txt"; then
    echo "Found 'failed' in output:" >&2
    cat "$BATS_FILE_TMPDIR/playwright_output.txt" >&2
    return 1
  fi
}

@test "playwright: importing config from packages/ shows helpful error" {
  PROJECT_DIR="$(cat "$BATS_FILE_TMPDIR/project_dir")"
  cd "$PROJECT_DIR"

  # Save the correct config so we can restore it after this test.
  cp test/playwright/playwright.config.ts "$BATS_FILE_TMPDIR/playwright.config.ts.bak"

  # Write a bad config that imports from @packages/playwright-drupal
  # instead of @lullabot/playwright-drupal/config.
  cat > test/playwright/playwright.config.ts << 'TSEOF'
import { definePlaywrightDrupalConfig } from '@packages/playwright-drupal';

export default definePlaywrightDrupalConfig({
  testDir: './tests',
});
TSEOF

  # Run Playwright — it should fail with our error message.
  set +e
  local output
  output="$(ddev exec -d /var/www/html/test/playwright npx playwright test 2>&1)"
  local exit_code=$?
  set -e

  # Restore the correct config.
  cp "$BATS_FILE_TMPDIR/playwright.config.ts.bak" test/playwright/playwright.config.ts

  if [ "$exit_code" -eq 0 ]; then
    echo "Expected Playwright to fail but it exited with code 0. Output:" >&2
    echo "$output" >&2
    return 1
  fi

  if ! echo "$output" | grep -q "Wrong import path in playwright.config"; then
    echo "Expected 'Wrong import path in playwright.config' error message. Actual output:" >&2
    echo "$output" >&2
    return 1
  fi

  if ! echo "$output" | grep -q "@lullabot/playwright-drupal/config"; then
    echo "Expected correct import suggestion in error. Actual output:" >&2
    echo "$output" >&2
    return 1
  fi
}
