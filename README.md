# Playwright in Drupal (in DDEV)

[![npm version](https://img.shields.io/npm/v/@lullabot/playwright-drupal)](https://www.npmjs.com/package/@lullabot/playwright-drupal)
[![npm downloads](https://img.shields.io/npm/dm/@lullabot/playwright-drupal)](https://www.npmjs.com/package/@lullabot/playwright-drupal)
[![Test](https://github.com/Lullabot/playwright-drupal/actions/workflows/test.yml/badge.svg)](https://github.com/Lullabot/playwright-drupal/actions/workflows/test.yml)
[![License](https://img.shields.io/npm/l/@lullabot/playwright-drupal)](https://github.com/Lullabot/playwright-drupal/blob/main/LICENSE)

![Demo showing running isolated Drupal tests in parallel](images/demo.webp)

This project, building on [lullabot/ddev-playwright](https://github.com/lullabot/ddev-playwright), enables full support for Playwright testing of Drupal websites.

1. Supports fast parallel tests by installing or importing sites into sqlite databases.
2. Enables Playwright tests to run Drush commands against a test site.
3. Shows browser console errors during the test.
4. Attaches PHP's error log to the Playwright test results.

For full documentation, visit the [playwright-drupal documentation](https://lullabot.github.io/playwright-drupal/latest/).
