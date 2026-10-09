<?php

/**
 * Check the test install without bootstrapping a database or changing exports.
 * Arguments: docroot, existing_config (0/1), config_dir, site_path.
 */
function playwrightSqlitePreflightFail(string $message): void {
  fwrite(STDERR, "Playwright SQLite preflight: $message\n");
  exit(1);
}

if (!extension_loaded('pdo_sqlite') || !extension_loaded('sqlite3')) {
  playwrightSqlitePreflightFail('PHP requires both pdo_sqlite and sqlite3. Enable these extensions in the PHP environment that runs Drupal; installing the sqlite3 command-line binary is not sufficient.');
}

$root = realpath($argv[1] ?? 'web');
if (!$root || !is_file($root . '/autoload.php')) {
  playwrightSqlitePreflightFail('Cannot find Drupal autoload.php. Check the project docroot in composer.json.');
}

$class_loader = require $root . '/autoload.php';
// Older Drupal versions bundled the driver without a separate module.
$requires_module = version_compare(\Drupal::VERSION, '10.0.0', '>=');
if ($requires_module && !is_file($root . '/core/modules/sqlite/sqlite.info.yml')) {
  playwrightSqlitePreflightFail('The Drupal sqlite driver module is missing. Restore it with your Drupal core Composer dependencies.');
}

$directory = '/tmp/sqlite';
if (!is_dir($directory) && !@mkdir($directory, 0777, TRUE) && !is_dir($directory)) {
  playwrightSqlitePreflightFail("Cannot create $directory. Make this database storage directory writable by the PHP/Drush user.");
}
// SQLite needs to create journal/WAL files beside the database, too.
$probe = @tempnam($directory, '.playwright-preflight-');
if (!$probe || dirname($probe) !== $directory) {
  if ($probe) {
    unlink($probe);
  }
  playwrightSqlitePreflightFail("Database storage $directory is not writable. Fix its ownership/permissions for the PHP/Drush user.");
}
unlink($probe);
if (file_exists($directory . '/.ht.sqlite') && !is_writable($directory . '/.ht.sqlite')) {
  playwrightSqlitePreflightFail("The existing $directory/.ht.sqlite database is not writable. Fix its ownership/permissions for the PHP/Drush user.");
}

if (($argv[2] ?? '0') === '1' || ($argv[3] ?? '') !== '') {
  // Resolve explicit paths before switching to Drupal's working directory.
  $config_directory = $argv[3] ?? '';
  if ($config_directory !== '' && $config_directory[0] !== '/') {
    $config_directory = getcwd() . '/' . $config_directory;
  }
  chdir($root);
  \Drupal\Core\DrupalKernel::bootEnvironment();
  $site_path = $argv[4] ?? 'sites/default';
  if (!is_readable($root . '/' . $site_path . '/settings.php')) {
    playwrightSqlitePreflightFail("Cannot read $site_path/settings.php in $root. Pass site_path for your multisite installation.");
  }
  \Drupal\Core\Site\Settings::initialize($root, $site_path, $class_loader);
  $config_directory = $config_directory ?: \Drupal\Core\Site\Settings::get('config_sync_directory');
  if (!$config_directory) {
    playwrightSqlitePreflightFail('Drupal settings do not define config_sync_directory. Configure it or pass config_dir matching the installer.');
  }
  try {
    // FileStorage normally gets its cache configuration during kernel boot.
    // This check deliberately stops before booting a database-backed kernel.
    \Drupal\Component\FileCache\FileCacheFactory::setConfiguration([
      \Drupal\Component\FileCache\FileCacheFactory::DISABLE_CACHE => TRUE,
    ]);
    $storage = new \Drupal\Core\Config\FileStorage($config_directory);
    $extensions = $storage->read('core.extension');
  }
  catch (\Throwable $error) {
    playwrightSqlitePreflightFail("Cannot read $config_directory/core.extension.yml: " . $error->getMessage());
  }
  if (!$extensions || !isset($extensions['module']) || !is_array($extensions['module'])) {
    playwrightSqlitePreflightFail("Missing or invalid $config_directory/core.extension.yml. Check the configuration directory used by your installer.");
  }
  if ($requires_module && !array_key_exists('sqlite', $extensions['module'])) {
    playwrightSqlitePreflightFail("The Drupal sqlite module is missing from $config_directory/core.extension.yml. An existing-config install would uninstall the driver used by the test database. On your normal local site run:\n  ddev drush pm:enable sqlite -y\n  ddev drush config:export -y\nReview and commit the exported change. This does not switch the production database. If you generate test configuration, enable sqlite in that configuration before running this check.");
  }
}

fwrite(STDOUT, "Playwright SQLite prerequisites passed.\n");
