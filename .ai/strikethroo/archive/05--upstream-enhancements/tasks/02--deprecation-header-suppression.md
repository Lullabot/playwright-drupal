---
id: 2
group: "deprecation-suppression"
dependencies: []
status: "completed"
created: 2026-03-16
skills:
  - php
  - drupal-settings
---
# Deprecation Header Suppression PR

## Objective
Add a custom error handler to `settings/settings.playwright.php` that suppresses deprecation notices in test child sites, preventing nginx 502 errors caused by oversized `X-Drupal-Assertion-N` HTTP headers.

## Skills Required
- PHP error handling (`set_error_handler`)
- Drupal settings.php configuration

## Acceptance Criteria
- [ ] Custom error handler added inside the existing `DRUPAL_TEST_IN_CHILD_SITE` block in `settings/settings.playwright.php`
- [ ] Handler intercepts `E_USER_DEPRECATED` and `E_DEPRECATED`, returning `TRUE` to suppress them
- [ ] Non-deprecation errors are forwarded to the previous handler via `&$previousHandler` capture
- [ ] Inline comments explain the two code paths in `_drupal_error_handler_real()` that add assertion headers
- [ ] All existing tests pass locally (`npm run test:unit` and `npm run test:bats`)
- [ ] PR created on branch `fix/deprecation-headers`, all CI status checks pass

## Technical Requirements
- Modify `settings/settings.playwright.php` only
- Use `set_error_handler()` with a closure that captures `&$previousHandler`
- The handler must be registered inside the `if (defined('DRUPAL_TEST_IN_CHILD_SITE') && DRUPAL_TEST_IN_CHILD_SITE)` block
- Reference implementation from upstream doc:
  ```php
  $previousHandler = set_error_handler(function ($errno, $errstr, $errfile, $errline) use (&$previousHandler) {
    if ($errno === E_USER_DEPRECATED || $errno === E_DEPRECATED) {
      return TRUE;
    }
    return $previousHandler ? $previousHandler($errno, $errstr, $errfile, $errline) : FALSE;
  });
  ```

## Input Dependencies
None — standalone change.

## Output Artifacts
- Modified `settings/settings.playwright.php`
- GitHub PR with passing CI checks

## Implementation Notes
- This is a PHP-only change with no TypeScript involved
- No README update needed — the fix is transparent to users
- The commit message should use conventional commits format: `fix: suppress deprecation headers in test child sites`
- After pushing, monitor CI with `gh pr checks <PR-URL> --watch` and fix any failures
