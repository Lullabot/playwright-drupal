#!/usr/bin/env bats

# integration.bats — Integration tests for @lullabot/playwright-drupal.
# Proves the README example works end-to-end: DDEV project creation,
# playwright-drupal installation, configuration, and test execution.

setup_file() {
  load test_helper

  # Save the repo root before changing directories.
  export REPO_ROOT="$(cd "$(dirname "$BATS_TEST_FILENAME")/.." && pwd)"

  # Run the full setup sequence from the README.
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
  [ "$(cat "$BATS_FILE_TMPDIR/playwright_exit_code")" -eq 0 ]
}

@test "playwright output shows passed tests" {
  grep -q "passed" "$BATS_FILE_TMPDIR/playwright_output.txt"
}

@test "playwright output shows no failures" {
  ! grep -q "failed" "$BATS_FILE_TMPDIR/playwright_output.txt"
}
