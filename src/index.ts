import {test as base_test, expect, TestFixture, WebError} from '@playwright/test';
import * as child_process from "child_process";

/**
 * Run task either inside of the web container or from the host.
 *
 * @param command
 */
function taskSync(command) {
    let ddev = process.env.DDEV_HOSTNAME ? 'task' : 'ddev task';
    return child_process.execSync(`${ddev} ${command}`, {
        cwd: process.env.DDEV_HOSTNAME ? '/var/www/html' : null,
    });
}

/**
 * Run a task asynchronously. Console output is streamed.
 *
 * @param command
 */
function task(command) {
    let ddev = process.env.DDEV_HOSTNAME ? 'task' : 'ddev task';
    let options = {
        cwd: process.env.DDEV_HOSTNAME ? '/var/www/html' : null,
    };

    let childProcess = child_process.exec(`${ddev} ${command}`, options);
    childProcess.stdout.on('data', (data) => {
        console.log(data.toString());
    });
    childProcess.stderr.on('data', (data) => {
        console.log(data.toString());
    });

    return childProcess;
}

/**
 * Keep a reference to the test ID so we can use it to attach the error log.
 */
let drupal_id: number;

/**
 * Set a simpletest cookie for routing the tests to a separate database.
 */
const test = base_test.extend<TestFixture<any, any>>( {
    async context( { context, request }, use ) {
        if (process.env.PLAYWRIGHT_NO_TEST_ISOLATION) {
            await use( context );
            return;
        }

        let id = Math.round(Math.random() * 1000000);
        drupal_id = id;
        let install = task('test:playwright:prepare test_id=' + id);
        install.on('exit', async (code) => {
            if (code > 0) {
                throw new Error("Task errored with exit code " + code);
            }
        })
        install.on('exit', async (code) => {
            let ua = taskSync('-o group test:playwright:ua test_id=' + id).toString();

            // let c: PlaywrightTestConfig= require('playwright.config.ts');
            await context.addCookies( [{
                name: 'SIMPLETEST_USER_AGENT',
                value: ua,
                path: '/',
                // domain: c.use.baseURL,
                domain: 'http://drupal/',
            }]);

            // Mirror browser errors to the Playwright console log.
            context.on('weberror', (webError: WebError) => console.log(webError.error()));

            // Clean up tests after they are complete.
            // This must be done when closing the context, and not in test.afterEach(),
            // as afterEach() still has a reference to a page object and active browser.
            context.on("close", (browserContext) => {
                task('test:playwright:cleanup test_id=' + id);
            })
            await use( context );
        });
    },
});

test.afterEach(async ({ page }, testInfo) => {
    let logPath = '../../web/sites/simpletest/' + drupal_id + '/error.log';
    testInfo.attach('error.log', {path: logPath});
});

export { test, expect };
