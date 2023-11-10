<?php

/**
 * Support installing a database to be the base for future test runs.
 */
if (getenv('PLAYWRIGHT_SETUP') !== FALSE) {
  $databases['default']['default'] = [
    'driver' => 'sqlite',
    'database' => '/tmp/sqlite/.ht.sqlite',
  ];
}

