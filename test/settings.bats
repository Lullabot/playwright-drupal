#!/usr/bin/env bats

# settings.bats — Unit tests for settings/settings.playwright.php.
#
# Like mutex.bats, these need neither DDEV nor Docker: the file is included
# from plain PHP with the one Drupal function it calls stubbed out.

setup() {
  SETTINGS_FILE="$(cd "$(dirname "$BATS_TEST_FILENAME")/.." && pwd)/settings/settings.playwright.php"
  export SETTINGS_FILE
}

# Include the settings file as a test child site request for the given test
# ID, then print the requested $settings key as JSON.
child_site_setting() {
  php -r '
    define("DRUPAL_TEST_IN_CHILD_SITE", TRUE);
    function drupal_valid_test_ua() { return getenv("TEST_ID"); }
    $settings = [];
    $databases = [];
    include getenv("SETTINGS_FILE");
    echo json_encode($settings[$argv[1]] ?? NULL);
  ' "$1"
}

@test "child site: memcache keys are prefixed with the test ID" {
  # Parallel workers share one memcached. Without a per-test prefix they read
  # each other's sessions and log each other in and out.
  TEST_ID=test12345 run child_site_setting memcache
  [ "$status" -eq 0 ]
  [ "$output" = '{"key_prefix":"test12345"}' ]
}

@test "child site: cache bins are prefixed with the test ID" {
  TEST_ID=test12345 run child_site_setting cache_prefix
  [ "$status" -eq 0 ]
  [ "$output" = '{"default":"test12345"}' ]
}
