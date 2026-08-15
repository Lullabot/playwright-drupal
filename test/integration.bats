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

@test "setup: write a11y fixture test" {
  write_a11y_fixture_test
}

@test "a11y fixture: update snapshots" {
  run_a11y_fixture_update_snapshots
}

@test "a11y fixture: update snapshots exits with code 0" {
  local exit_code
  exit_code="$(cat "$BATS_FILE_TMPDIR/a11y_fixture_update_exit_code")"
  if [ "$exit_code" -ne 0 ]; then
    echo "a11y fixture update snapshots exited with code $exit_code. Output:" >&2
    cat "$BATS_FILE_TMPDIR/a11y_fixture_update_output.txt" >&2
    return 1
  fi
}

@test "a11y fixture: run tests" {
  run_a11y_fixture_tests
}

@test "a11y fixture: tests exit with code 0" {
  local exit_code
  exit_code="$(cat "$BATS_FILE_TMPDIR/a11y_fixture_exit_code")"
  if [ "$exit_code" -ne 0 ]; then
    echo "a11y fixture tests exited with code $exit_code. Output:" >&2
    cat "$BATS_FILE_TMPDIR/a11y_fixture_output.txt" >&2
    return 1
  fi
}

@test "a11y fixture: output shows passed tests" {
  if ! grep -q "passed" "$BATS_FILE_TMPDIR/a11y_fixture_output.txt"; then
    echo "Expected 'passed' in a11y fixture output. Actual output:" >&2
    cat "$BATS_FILE_TMPDIR/a11y_fixture_output.txt" >&2
    return 1
  fi
}

@test "a11y fixture: output shows no failures" {
  if grep -q "failed" "$BATS_FILE_TMPDIR/a11y_fixture_output.txt"; then
    echo "Found 'failed' in a11y fixture output:" >&2
    cat "$BATS_FILE_TMPDIR/a11y_fixture_output.txt" >&2
    return 1
  fi
}

@test "setup: write a11y baseline test" {
  write_a11y_baseline_test
}

@test "a11y baseline: run tests" {
  run_a11y_baseline_tests
}

@test "a11y baseline: tests exit with code 0" {
  local exit_code
  exit_code="$(cat "$BATS_FILE_TMPDIR/a11y_baseline_exit_code")"
  if [ "$exit_code" -ne 0 ]; then
    echo "a11y baseline tests exited with code $exit_code. Output:" >&2
    cat "$BATS_FILE_TMPDIR/a11y_baseline_output.txt" >&2
    return 1
  fi
}

@test "a11y baseline: output shows passed tests" {
  if ! grep -q "passed" "$BATS_FILE_TMPDIR/a11y_baseline_output.txt"; then
    echo "Expected 'passed' in a11y baseline output. Actual output:" >&2
    cat "$BATS_FILE_TMPDIR/a11y_baseline_output.txt" >&2
    return 1
  fi
}

@test "a11y baseline: output shows no failures" {
  if grep -q "failed" "$BATS_FILE_TMPDIR/a11y_baseline_output.txt"; then
    echo "Found 'failed' in a11y baseline output:" >&2
    cat "$BATS_FILE_TMPDIR/a11y_baseline_output.txt" >&2
    return 1
  fi
}

@test "setup: write visual diff test" {
  write_visual_diff_test
}

@test "visual diff: write the baseline screenshot" {
  # The helper leaves the shell in the project directory, so look for the
  # baseline relative to it rather than joining the path a second time.
  run_visual_diff_baseline

  if ! ls test/playwright/tests/visual-diff.spec.ts-snapshots/*.png >/dev/null 2>&1; then
    echo "Expected a baseline screenshot to be written. Output:" >&2
    cat "$BATS_FILE_TMPDIR/visual_baseline_output.txt" >&2
    return 1
  fi
}

@test "visual diff: the comparison fails" {
  run_visual_diff_tests

  local exit_code
  exit_code="$(cat "$BATS_FILE_TMPDIR/visual_diff_exit_code")"
  if [ "$exit_code" -eq 0 ]; then
    echo "Expected the visual comparison to fail, but it passed. Output:" >&2
    cat "$BATS_FILE_TMPDIR/visual_diff_output.txt" >&2
    return 1
  fi
}

@test "visual diff: the report records a container path for the diff image" {
  PROJECT_DIR="$(cat "$BATS_FILE_TMPDIR/project_dir")"
  local report="$PROJECT_DIR/test/playwright/visual-diff-results.json"

  if [ ! -f "$report" ]; then
    echo "Expected a JSON report at $report." >&2
    return 1
  fi

  # This is the boundary the failure summary has to cross: the diff image is
  # the only attachment kind carrying a path, and that path is the container's.
  if ! grep -q '"path": *"/var/www/html/[^"]*-diff\.png"' "$report"; then
    echo "Expected a container-side path for the diff image in the report:" >&2
    grep -o '"path": *"[^"]*"' "$report" >&2 || true
    return 1
  fi
}

@test "visual diff: the failure summary reads the container's diff image" {
  run_visual_diff_failure_summary

  local exit_code
  exit_code="$(cat "$BATS_FILE_TMPDIR/visual_diff_summary_exit_code")"
  if [ "$exit_code" -ne 0 ]; then
    echo "Failure summary exited with code $exit_code. Log:" >&2
    cat "$BATS_FILE_TMPDIR/visual_diff_summary_log.txt" >&2
    return 1
  fi

  # Ran on the host against a report written in the container, so the paths
  # only resolve if they were re-rooted onto the checkout.
  if ! grep -q "Remapped .* attachment path" "$BATS_FILE_TMPDIR/visual_diff_summary_log.txt"; then
    echo "Expected the summary to re-root the container paths. Log:" >&2
    cat "$BATS_FILE_TMPDIR/visual_diff_summary_log.txt" >&2
    return 1
  fi

  if grep -q "could not be read" "$BATS_FILE_TMPDIR/visual_diff_summary_log.txt"; then
    echo "The diff image was not readable from the host. Log:" >&2
    cat "$BATS_FILE_TMPDIR/visual_diff_summary_log.txt" >&2
    return 1
  fi
}

@test "visual diff: the summary says why images were not uploaded" {
  # No upload token here, which must read as an absent token rather than as a
  # missing file — the two used to be the same sentence.
  if ! grep -q "not uploaded (no upload token configured)" "$BATS_FILE_TMPDIR/visual_diff_summary.md"; then
    echo "Expected the summary to name the missing token. Summary:" >&2
    cat "$BATS_FILE_TMPDIR/visual_diff_summary.md" >&2
    return 1
  fi

  if grep -q "could not be read" "$BATS_FILE_TMPDIR/visual_diff_summary.md"; then
    echo "The summary reported an unreadable image. Summary:" >&2
    cat "$BATS_FILE_TMPDIR/visual_diff_summary.md" >&2
    return 1
  fi
}

@test "visual diff: the comment reports the failure" {
  if ! grep -q "visual comparison fixture" "$BATS_FILE_TMPDIR/visual_diff_comment.md"; then
    echo "Expected the failing test in the comment body. Comment:" >&2
    cat "$BATS_FILE_TMPDIR/visual_diff_comment.md" >&2
    return 1
  fi

  if ! grep -qE '<!-- playwright-drupal-failures: [1-9]' "$BATS_FILE_TMPDIR/visual_diff_comment.md"; then
    echo "Expected a non-zero failure marker in the comment body. Comment:" >&2
    cat "$BATS_FILE_TMPDIR/visual_diff_comment.md" >&2
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
