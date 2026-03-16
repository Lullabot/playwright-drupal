#!/usr/bin/env bats

# integration-mysql-to-sqlite.bats — Integration tests for the mysql-to-sqlite
# conversion workflow. Proves that a MySQL-based Drupal install can be
# converted to SQLite and used for Playwright test isolation.

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

@test "mysql-to-sqlite: install Drupal to MySQL" {
  PROJECT_DIR="$(cat "$BATS_FILE_TMPDIR/project_dir")"
  cd "$PROJECT_DIR"

  echo "--- ddev drush site:install demo_umami (MySQL)" >&3
  ddev drush site:install --yes --site-name Playwright demo_umami >&3 2>&3
}

@test "mysql-to-sqlite: convert database" {
  PROJECT_DIR="$(cat "$BATS_FILE_TMPDIR/project_dir")"
  cd "$PROJECT_DIR"

  echo "--- ddev task playwright:mysql-to-sqlite" >&3
  ddev task playwright:mysql-to-sqlite >&3 2>&3
}

@test "mysql-to-sqlite: SQLite file exists" {
  PROJECT_DIR="$(cat "$BATS_FILE_TMPDIR/project_dir")"
  cd "$PROJECT_DIR"

  ddev exec test -f /tmp/sqlite/.ht.sqlite
}

@test "mysql-to-sqlite: SQLite file is valid" {
  PROJECT_DIR="$(cat "$BATS_FILE_TMPDIR/project_dir")"
  cd "$PROJECT_DIR"

  # Verify the file is a valid SQLite database by querying its tables.
  local table_count
  table_count="$(ddev exec sqlite3 /tmp/sqlite/.ht.sqlite "SELECT count(*) FROM sqlite_master WHERE type='table';")"
  echo "SQLite table count: $table_count" >&3
  [ "$table_count" -gt 0 ]
}

@test "playwright: run tests against converted database" {
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
