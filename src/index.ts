import {expect, test as base_test, TestFixture, WebError} from '@playwright/test';
import {task, taskSync} from "./task";
import * as fs from "fs";
import * as util from "util";
import child_process from "child_process";

/**
 * Keep a reference to the test ID, so we can use it to attach the error log.
 */
let drupal_test_id: number;

/**
 * Set a simpletest cookie for routing the tests to a separate database.
 */
const test = base_test.extend<TestFixture<any, any>>( {
    async context( { context, request }, use ) {
      // Test against a single database in the base site.
      if (process.env.PLAYWRIGHT_NO_TEST_ISOLATION) {
        await use( context );
        return;
      }

      // We don't implement a lock like how Drupal core does. We may want to
      // if we ever get reports of failures.
      // See \Drupal\Core\Test\TestDatabase::getTestLock().
      let id = Math.round(Math.random() * 1000000);
      drupal_test_id = id;

      // Copy the base database to a new one.
      let install = task('playwright:prepare test_id=' + id);
      install.on('exit', async (code) => {
        if (code === null || code > 0) {
          throw new Error("Task errored with exit code " + code);
        }
      })

      // After installation, set the right cookie in the browser so tests are
      // routed correctly.
      install.on('exit', async (code) => {
        let ua = taskSync('-o group playwright:ua test_id=' + id).toString();

        await context.addCookies( [{
          name: 'SIMPLETEST_USER_AGENT',
          value: ua,
          path: '/',
          domain: process.env.DDEV_HOSTNAME
        }]);

        // Mirror browser errors to the Playwright console log.
        context.on('weberror', (webError: WebError) => console.log(webError.error()));

        // Clean up tests after they are complete.
        // This must be done when closing the context, and not in test.afterEach(),
        // as afterEach() still has a reference to a page object and active browser.
        context.on("close", (browserContext) => {
          task('playwright:cleanup test_id=' + id);
        })
        await use( context );
      });
    },
});

/**
 * Attach the PHP error log to the test results.
 */
test.afterEach(async ({ page }, testInfo) => {
    let logPath = '../../web/sites/simpletest/' + drupal_test_id + '/error.log';
    if (fs.existsSync(logPath)) {
      await testInfo.attach('error.log', {path: logPath});
    }
});

export { test, expect };
