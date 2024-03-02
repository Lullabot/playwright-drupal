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
}

