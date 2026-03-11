---
id: 3
group: "docroot-detection"
dependencies: []
status: "completed"
created: "2026-03-10"
skills:
  - php
---
# Update drush-playwright-internal to detect docroot from composer.json

## Objective
Update `bin/drush-playwright-internal` to read the docroot from `composer.json` instead of hardcoding `web/` in the path to `bootstrap.inc`.

## Skills Required
- PHP: `json_decode`, `file_get_contents`, path manipulation

## Acceptance Criteria
- [ ] The script reads `extra.drupal-scaffold.locations.web-root` from `/var/www/html/composer.json`
- [ ] The trailing slash is stripped from the value
- [ ] Falls back to `web` if the key is missing or `composer.json` can't be read
- [ ] The `include_once` for `bootstrap.inc` uses the detected docroot instead of hardcoded `web`
- [ ] Error message is shown if `bootstrap.inc` is not found at the resolved path

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- PHP `json_decode()` and `file_get_contents()` for reading `composer.json`
- `rtrim()` for stripping trailing slashes

## Input Dependencies
None — this is a standalone implementation task.

## Output Artifacts
- Updated `bin/drush-playwright-internal` with dynamic docroot detection

## Implementation Notes

<details>
<summary>Detailed implementation guidance</summary>

### Current code (line 42)
```php
include_once '/var/www/html/web/core/includes/bootstrap.inc';
```

### Replacement approach
After the existing `require_once '/var/www/html/vendor/autoload.php';` (line 32) and the `$test_id` validation block (lines 34-40), add docroot detection:

```php
// Detect the docroot from composer.json's drupal-scaffold configuration.
$docroot = 'web';
$composer_json_path = '/var/www/html/composer.json';
if (file_exists($composer_json_path)) {
  $composer = json_decode(file_get_contents($composer_json_path), true);
  if (isset($composer['extra']['drupal-scaffold']['locations']['web-root'])) {
    $docroot = rtrim($composer['extra']['drupal-scaffold']['locations']['web-root'], '/');
  }
}

$bootstrap_path = "/var/www/html/$docroot/core/includes/bootstrap.inc";
if (!file_exists($bootstrap_path)) {
  print "bootstrap.inc not found at $bootstrap_path. Check your composer.json drupal-scaffold.locations.web-root setting.";
  exit(1);
}
include_once $bootstrap_path;
```

Then remove the old hardcoded line 42:
```php
include_once '/var/www/html/web/core/includes/bootstrap.inc';
```

### Keep existing structure
Do not change the `require_once '/var/www/html/vendor/autoload.php';` line — `/var/www/html` is the DDEV project mount, not the docroot. Only the `web/` subdirectory part changes.

Similarly, the drush paths at the bottom (`/var/www/html/vendor/bin/drush.php` and `/var/www/html/vendor/bin/drush`) do NOT contain `web/` and should remain unchanged.

</details>
