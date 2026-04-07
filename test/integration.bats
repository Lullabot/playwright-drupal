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

@test "setup: write a11y check test" {
  write_a11y_check_test
}

@test "a11y: update snapshots" {
  run_a11y_update_snapshots
}

@test "a11y: update snapshots exits with code 0" {
  local exit_code
  exit_code="$(cat "$BATS_FILE_TMPDIR/a11y_update_exit_code")"
  if [ "$exit_code" -ne 0 ]; then
    echo "a11y update snapshots exited with code $exit_code. Output:" >&2
    cat "$BATS_FILE_TMPDIR/a11y_update_output.txt" >&2
    return 1
  fi
}

@test "a11y: run tests" {
  run_a11y_tests
}

@test "a11y: tests exit with code 0" {
  local exit_code
  exit_code="$(cat "$BATS_FILE_TMPDIR/a11y_exit_code")"
  if [ "$exit_code" -ne 0 ]; then
    echo "a11y tests exited with code $exit_code. Output:" >&2
    cat "$BATS_FILE_TMPDIR/a11y_output.txt" >&2
    return 1
  fi
}

@test "a11y: output shows passed tests" {
  if ! grep -q "passed" "$BATS_FILE_TMPDIR/a11y_output.txt"; then
    echo "Expected 'passed' in a11y output. Actual output:" >&2
    cat "$BATS_FILE_TMPDIR/a11y_output.txt" >&2
    return 1
  fi
}

@test "a11y: output shows no failures" {
  if grep -q "failed" "$BATS_FILE_TMPDIR/a11y_output.txt"; then
    echo "Found 'failed' in a11y output:" >&2
    cat "$BATS_FILE_TMPDIR/a11y_output.txt" >&2
    return 1
  fi
}

@test "setup: write recipe test" {
  write_recipe_test
}

@test "recipe: run playwright test" {
  run_recipe_playwright_test
}

@test "recipe: tests exit with code 0" {
  local exit_code
  exit_code="$(cat "$BATS_FILE_TMPDIR/recipe_playwright_exit_code")"
  if [ "$exit_code" -ne 0 ]; then
    echo "Recipe Playwright exited with code $exit_code. Output:" >&2
    cat "$BATS_FILE_TMPDIR/recipe_playwright_output.txt" >&2
    return 1
  fi
}

@test "recipe: output shows passed tests" {
  if ! grep -q "passed" "$BATS_FILE_TMPDIR/recipe_playwright_output.txt"; then
    echo "Expected 'passed' in recipe output. Actual output:" >&2
    cat "$BATS_FILE_TMPDIR/recipe_playwright_output.txt" >&2
    return 1
  fi
}

@test "recipe: output shows no failures" {
  if grep -q "failed" "$BATS_FILE_TMPDIR/recipe_playwright_output.txt"; then
    echo "Found 'failed' in recipe output:" >&2
    cat "$BATS_FILE_TMPDIR/recipe_playwright_output.txt" >&2
    return 1
  fi
}

@test "verbose: default run does not print drush output inline" {
  # In the default (non-verbose) run, drush command output should be captured
  # as attachments, not printed to the console. The "login helper works" test
  # calls execDrushInTestSite('user:login ...') which returns a one-time login
  # URL. If output were printed inline, the URL would appear in the output.
  if grep -q "user/reset" "$BATS_FILE_TMPDIR/playwright_output.txt"; then
    echo "Found drush login URL in non-verbose output — output should be captured, not printed:" >&2
    grep "user/reset" "$BATS_FILE_TMPDIR/playwright_output.txt" >&2
    return 1
  fi
}

@test "verbose: default run creates CLI output attachments" {
  PROJECT_DIR="$(cat "$BATS_FILE_TMPDIR/project_dir")"
  cd "$PROJECT_DIR"

  # Re-run a single test with the JSON reporter to inspect attachments.
  # In non-verbose mode, the collector attaches stdout/stderr as text files.
  set +e
  local json_output
  json_output="$(ddev exec -d /var/www/html/test/playwright \
    npx playwright test --grep 'login helper works$' --repeat-each 1 --reporter=json 2>&1)"
  set -e

  # The JSON report should contain attachment entries with "-stdout.txt" names.
  if ! echo "$json_output" | grep -q 'stdout\.txt'; then
    echo "Expected stdout.txt attachment in JSON report but not found. Output:" >&2
    echo "$json_output" | head -100 >&2
    return 1
  fi
}

@test "verbose: PLAYWRIGHT_DRUPAL_VERBOSE=1 prints drush output inline" {
  PROJECT_DIR="$(cat "$BATS_FILE_TMPDIR/project_dir")"
  cd "$PROJECT_DIR"

  # Re-run only the fast "login helper works" test with verbose mode enabled.
  # This test calls execDrushInTestSite('user:login ...') which produces a
  # one-time login URL that should appear in the console output.
  set +e
  local output
  output="$(ddev exec -d /var/www/html/test/playwright \
    bash -c 'PLAYWRIGHT_DRUPAL_VERBOSE=1 npx playwright test --grep "login helper works$" --repeat-each 1' 2>&1)"
  local exit_code=$?
  set -e

  echo "$output" >&3

  if [ "$exit_code" -ne 0 ]; then
    echo "Verbose test run failed with exit code $exit_code. Output:" >&2
    echo "$output" >&2
    return 1
  fi

  # In verbose mode, the drush user:login URL should be printed inline.
  if ! echo "$output" | grep -q "user/reset"; then
    echo "Expected drush login URL (user/reset) in verbose output but not found. Output:" >&2
    echo "$output" >&2
    return 1
  fi
}

@test "playwright: @packages/ alias import shows helpful error" {
  assert_wrong_import_error '@packages/playwright-drupal' 'alias import'
}

@test "playwright: relative ./packages/ import shows helpful error" {
  assert_wrong_import_error './packages/playwright-drupal' 'relative import'
}
