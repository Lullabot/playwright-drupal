#!/usr/bin/env bats

# integration-docroot.bats — Integration tests for non-default docroot.
# Proves playwright-drupal auto-detects docroot from composer.json
# when the web root is "docroot" instead of the default "web".

setup_file() {
  export REPO_ROOT="$(cd "$(dirname "$BATS_TEST_FILENAME")/.." && pwd)"
}

teardown_file() {
  load test_helper
  cleanup_drupal_project
}

setup() {
  load test_helper
}

@test "prerequisites: ddev is installed" {
  command -v ddev
}

@test "prerequisites: docker is installed" {
  command -v docker
}

@test "setup: create Drupal project with DDEV (docroot)" {
  setup_drupal_project docroot
}

@test "setup: configure Playwright (docroot)" {
  configure_playwright docroot
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
