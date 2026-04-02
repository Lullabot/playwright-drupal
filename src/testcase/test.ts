import {expect, test as base_test, TestFixture, WebError} from '@playwright/test';
import {task, taskSync} from "../cli/task";
import {getDocroot} from "../util/docroot";
import {collector, isVerbose} from "../cli/output-collector";
import * as fs from "fs";
import * as util from "util";
import child_process from "child_process";

/**
 * Keep a reference to the test ID, so we can use it to attach the error log.
 */
let drupal_test_id: number;
const docroot = getDocroot('../../composer.json');

/**
 * Set a simpletest cookie for routing the tests to a separate database.
 */
const test = base_test.extend<TestFixture<any, any>>( {
  async context( { context, request }, use, testInfo ) {
    // Test against a single database in the default (typically mariadb) site.
    if (process.env.PLAYWRIGHT_NO_TEST_ISOLATION) {
      await use( context );
      return;
    }

    collector.reset();

    // We don't implement a lock like how Drupal core does. We may want to
    // if we ever get reports of failures.
    // See \Drupal\Core\Test\TestDatabase::getTestLock().
    let id = Math.round(Math.random() * 1000000);
    drupal_test_id = id;

    // Copy the base database to a new one.
    let install = task('playwright:prepare test_id=' + id);

    // Wait for the installation to complete.
    await new Promise<void>((resolve, reject) => {
      install.on('exit', async (code) => {
        if (code === null || code > 0) {
          reject(new Error("Task errored with exit code " + code));
          return;
        }
        resolve();
      });
    });

    // After installation, set the right cookie in the browser so tests are
    // routed correctly.
    let ua = taskSync('-o group playwright:ua test_id=' + id).toString();

    if (typeof process.env.DDEV_HOSTNAME !== 'undefined') {
      await context.addCookies( [{
        name: 'SIMPLETEST_USER_AGENT',
        value: ua,
        path: '/',
        domain: process.env.DDEV_HOSTNAME.split(',')[0],
      }]);
    }

    // Mirror browser errors to the Playwright console log or collector.
    context.on('weberror', (webError: WebError) => {
      const message = webError.error().toString();
      if (isVerbose()) {
        console.log(message);
      } else {
        collector.addWebError(message);
      }
    });

    await use( context );

    // Clean up after the test is complete. This runs after afterEach() and
    // the browser context is no longer in use.
    await context.close();

    let cleanup = task('playwright:cleanup test_id=' + id);
    await new Promise<void>((resolve) => {
      cleanup.on('exit', () => resolve());
    });

    // Attach the PHP error log to the test results.
    let logPath = '../../' + docroot + '/sites/simpletest/' + drupal_test_id + '/error.log';
    if (fs.existsSync(logPath)) {
      await testInfo.attach('error.log', {path: logPath});
    }

    // Attach collected CLI output and web errors to the test results.
    if (!isVerbose()) {
      for (const entry of collector.getEntries()) {
        if (entry.stdout.trim()) {
          await testInfo.attach(`${entry.label}-stdout.txt`, {
            body: entry.stdout,
            contentType: 'text/plain',
          });
        }
        if (entry.stderr.trim()) {
          await testInfo.attach(`${entry.label}-stderr.txt`, {
            body: entry.stderr,
            contentType: 'text/plain',
          });
        }
      }
      const webErrors = collector.getWebErrors();
      if (webErrors.length > 0) {
        await testInfo.attach('web-errors.txt', {
          body: webErrors.join('\n\n'),
          contentType: 'text/plain',
        });
      }
    }
  },
});

/**
 * Run a Drush command in a test site.
 *
 * @param command
 *   The drush command and flags to use, such as
 *   `pm:uninstall environment_indicator -y`.
 */
async function execDrushInTestSite(command: string) {
  const drush = process.env.DDEV_HOSTNAME ? `./test/playwright/node_modules/@lullabot/playwright-drupal/bin/drush-playwright ${drupal_test_id}` : `ddev exec ./test/playwright/node_modules/@lullabot/playwright-drupal/bin/drush-playwright ${drupal_test_id}`;

  const exec = util.promisify(child_process.exec);
  const p = exec(`${drush} ${command}`, {
    // @ts-ignore
    cwd: process.env.DDEV_HOSTNAME ? '/var/www/html' : null,
  });
  p.then((res) => {
    if (isVerbose()) {
      console.log(res.stdout);
      console.error(res.stderr);
    } else {
      const label = `drush-test-${command}`;
      collector.startCommand(label);
      collector.appendStdout(res.stdout);
      collector.appendStderr(res.stderr);
      collector.finishCommand();
    }
  }, (reason) => {
    if (isVerbose()) {
      console.error(reason);
    } else {
      const label = `drush-test-${command}`;
      collector.startCommand(label);
      collector.appendStderr(reason.stderr || reason.toString());
      collector.finishCommand();
    }
  });
  p.catch((error) => {
    if (isVerbose()) {
      console.error(error.stderr);
    }
  });

  return p;
}

export { test, expect, execDrushInTestSite};
