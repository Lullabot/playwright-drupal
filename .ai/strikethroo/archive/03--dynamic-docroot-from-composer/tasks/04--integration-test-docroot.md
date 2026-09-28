---
id: 4
group: "testing"
dependencies: [1, 2, 3]
status: "completed"
created: "2026-03-10"
skills:
  - bash
  - e2e-testing
---
# Parameterize test helper and add docroot integration test

## Objective
Parameterize `test/test_helper.bash` to accept a docroot argument, then create `test/integration-docroot.bats` to prove playwright-drupal works end-to-end with `docroot` as the web root. Also update CI timeout.

## Skills Required
- Bash scripting (BATS test framework, shell functions with parameters)
- E2E testing patterns (DDEV project setup, Playwright execution)

## Acceptance Criteria
- [ ] `setup_drupal_project` accepts an optional docroot parameter (defaults to `web`)
- [ ] `configure_playwright` accepts an optional docroot parameter (defaults to `web`)
- [ ] `test/integration.bats` continues to work unchanged (uses default `web`)
- [ ] `test/integration-docroot.bats` exists and sets up a project with `docroot` as the web root
- [ ] The docroot test modifies `composer.json` to set `web-root: "docroot/"` and renames the directory
- [ ] CI workflow timeout is increased from 30 to 45 minutes

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- BATS (Bash Automated Testing System)
- DDEV CLI commands
- `jq` or `sed` for modifying `composer.json` (or `node -e`)
- GitHub Actions workflow YAML

## Input Dependencies
- Tasks 1-3 must be complete (the TypeScript utility, Taskfile variable, and PHP script changes) so the integration test can validate them end-to-end.

## Output Artifacts
- Updated `test/test_helper.bash` with parameterized functions
- New `test/integration-docroot.bats`
- Updated `.github/workflows/test.yml` with increased timeout

## Implementation Notes

<details>
<summary>Detailed implementation guidance</summary>

### Parameterize `test/test_helper.bash`

#### `setup_drupal_project`
Add a parameter for docroot. The function currently hardcodes `--docroot=web` on line 28:
```bash
ddev config --project-type=drupal11 --docroot=web --project-name="$PROJECT_NAME" >&3 2>&3
```

Change to accept a parameter:
```bash
setup_drupal_project() {
  local docroot="${1:-web}"
  # ... existing code ...
  ddev config --project-type=drupal11 --docroot="$docroot" --project-name="$PROJECT_NAME" >&3 2>&3
```

If the docroot is NOT `web`, add steps after `ddev composer create-project` to:
1. Modify `composer.json` using `node -e` (available inside DDEV):
   ```bash
   if [[ "$docroot" != "web" ]]; then
     echo "--- Changing docroot from web to $docroot" >&3
     # Use node to rewrite composer.json since jq may not be on the host
     ddev exec node -e "
       const fs = require('fs');
       let c = JSON.parse(fs.readFileSync('composer.json', 'utf8'));
       // Update drupal-scaffold web-root
       c.extra['drupal-scaffold'].locations['web-root'] = '${docroot}/';
       // Update installer-paths: replace 'web/' prefix with new docroot
       const newPaths = {};
       for (const [key, val] of Object.entries(c.extra['installer-paths'])) {
         newPaths[key.replace(/^web\//, '${docroot}/')] = val;
       }
       c.extra['installer-paths'] = newPaths;
       fs.writeFileSync('composer.json', JSON.stringify(c, null, 4) + '\n');
     " >&3 2>&3
     # Rename the directory
     ddev exec mv web "$docroot" >&3 2>&3
     # Restart DDEV to pick up the new docroot
     echo "--- ddev restart (docroot change)" >&3
     ddev restart >&3 2>&3
   fi
   ```
2. This block goes right after `ddev composer require drush/drush` and before the ddev-playwright add-on install.

#### `configure_playwright`
Line 173 hardcodes `web/sites/default/settings.php`:
```bash
chmod 644 web/sites/default/settings.php
echo "include '...';" >> web/sites/default/settings.php
```

Change to accept a parameter:
```bash
configure_playwright() {
  local docroot="${1:-web}"
  # ... existing code ...
  chmod 644 "$docroot/sites/default/settings.php"
  echo "include '../test/playwright/node_modules/@lullabot/playwright-drupal/settings/settings.playwright.php';" >> "$docroot/sites/default/settings.php"
```

### Create `test/integration-docroot.bats`
Model it after `test/integration.bats` but pass `docroot` to the helper functions:

```bash
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
```

### Update CI workflow
In `.github/workflows/test.yml`, change `timeout-minutes: 30` to `timeout-minutes: 45`.

### Note on `write_example_test` and `run_playwright_tests`
These functions do NOT reference the docroot directly — they write to `test/playwright/` and run `npx playwright test`. They should work without any changes.

</details>
