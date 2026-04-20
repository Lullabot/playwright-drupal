# Debugging Tests

## Verbose CLI Output

By default, output from CLI commands (like drush or task) and browser web errors is captured and attached to each test result as text files. This keeps the terminal clean when running tests in parallel, since output from different workers would otherwise be interleaved.

To print CLI output inline instead, set in your DDEV shell:

```bash
export PLAYWRIGHT_DRUPAL_VERBOSE=1
```

This is useful when debugging a single test or running with `--workers=1`, where interleaved output is not a concern. The attached output files are available in the HTML test report regardless of this setting.

## Running Tests Without Isolation

There are times you may want to run Playwright without isolating test runs. Perhaps you're manually scaffolding test content by hand, before writing code to create it. Or perhaps you would like to be absolutely sure that a test passes or fails when running against mariadb.

To do this, set in your DDEV shell:

```bash
export PLAYWRIGHT_NO_TEST_ISOLATION=1
```

Consider running Playwright with `--workers=1` and with a single browser, since any changes to the database will persist.
