<?php

/**
 * Drupal settings for running Playwright tests with sqlite.
 */

/**
 * Support installing a database to be the base for future test runs.
 */
if (getenv('PLAYWRIGHT_SETUP') !== FALSE) {
  $databases['default']['default'] = [
    'driver' => 'sqlite',
    'database' => '/tmp/sqlite/.ht.sqlite',
    'init_commands' => [
      'synchronous' => "PRAGMA synchronous=OFF",
    ],
  ];
}

/**
 * Support rerouting test requests to a separate database prefix.
 *
 * This builds on what Drupal core includes by default to set up test subsites.
 * However, whereas the install-site.php script will install a site from a
 * profile, we need to install from an existing config directory. So, we don't
 * use that script, but do use the same APIs to manage databases and prefixes.
 */
if (defined('DRUPAL_TEST_IN_CHILD_SITE') && DRUPAL_TEST_IN_CHILD_SITE) {
  // We put all tests in a separate database to not clutter up normal ones.
  $id = drupal_valid_test_ua();
  if ($id !== FALSE) {
    $numeric = str_replace('test', '', $id);
    $databases['default']['default'] = [
      'driver' => 'sqlite',
      'database' => '/tmp/sqlite/' . $numeric . '/.ht.sqlite',
      'init_commands' => [
        'synchronous' => "PRAGMA synchronous=OFF",
      ],
    ];

    // This path with simpletest is what Drupal's kernel expects for test.
    $settings['file_public_path'] = 'sites/simpletest/' . $numeric . '/files';
    $settings['file_private_path'] = 'sites/simpletest/' . $numeric . '/files/private';

    // Allow access to curl for rebuilding the container.
    $settings['rebuild_access'] = TRUE;

    // Split cache prefixes when using non-database caches. This still splits
    // caches for database caching, but has no real effect in that case.
    $settings['cache_prefix']['default'] = $id;
  }

  // Suppress X-Drupal-Assertion headers in test child sites. During cold
  // container compilation, Drupal adds an X-Drupal-Assertion-N HTTP header
  // for every error and deprecation (see _drupal_error_header() in errors.inc).
  // With many contrib modules, this produces headers totaling >64KB,
  // exceeding nginx's fastcgi_buffer_size and causing 502 errors on the
  // first request after rebuild.php.
  //
  // Two code paths in _drupal_error_handler_real() add assertion headers:
  // 1. _drupal_log_error() — controlled by SIMPLETEST_COLLECT_ERRORS
  // 2. Direct E_USER_DEPRECATED handler (line 86) — ignores SIMPLETEST_COLLECT_ERRORS
  //    This path fires when E_USER_DEPRECATED is triggered inside @-suppressed
  //    code, because error_reporting() excludes it, bypassing path #1.
  //
  // We wrap Drupal's error handler to swallow deprecation notices entirely,
  // preventing both paths from adding assertion headers.
  $previousHandler = set_error_handler(function ($errno, $errstr, $errfile, $errline) use (&$previousHandler) {
    if ($errno === E_USER_DEPRECATED || $errno === E_DEPRECATED) {
      return TRUE;
    }
    return $previousHandler ? $previousHandler($errno, $errstr, $errfile, $errline) : FALSE;
  });
}

