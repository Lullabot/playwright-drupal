# Getting Started

## Requirements

- The Drupal site must be using [DDEV](https://ddev.com/) for development environments.
- The Drupal site is meant to be tested after a site install or database import, like how Drupal core tests work.
- The Playwright tests must be using `npm` as their package manager, or creating an npm-like node_modules directory. It's unclear at this moment how we could integrate yarn packages into the separate directory Playwright requires for test libraries. PRs welcome!
- Playwright tests will be written in TypeScript.

## How This Works

- This library includes an extended version of Playwright's `test` function that sets up and tears down isolated Drupal sites. Each test gets its own copy of a base SQLite database, whether that database was created by a fresh site install or converted from an existing MySQL/MariaDB database.
- We use Playwright's concept of "packages" to allow for a npm dependency to export a test function.
- Test requests from the web browser are directed to the right database though `settings.php` additions.
- `drush-playwright` does its own bootstrap to route drush commands to the right site.
- We use [Task](https://taskfile.dev) as a task runner to install Drupal and set up the tests. This allows developers to easily run individual components of the test setup and teardown without having to step through JavaScript, or reuse them in other non-testing scenarios.
- While as of this writing (March 2024) this is new code, a nearly identical version of this has been running on a real-world project for over a year.

## Docroot Auto-Detection

This library automatically detects your Drupal docroot by reading the `extra.drupal-scaffold.locations.web-root` key from your project's `composer.json`. This means it works out of the box with `web/`, `docroot/`, or any custom directory name — no manual configuration is needed. If the key is not present in `composer.json`, it defaults to `web`.
