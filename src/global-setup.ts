import * as fs from "fs";
import path from "path";
import {FullConfig} from "@playwright/test";
import {taskSync} from "./task";

/**
 * Global setup callback for Playwright
 *
 * https://playwright.dev/docs/test-global-setup-teardown#option-2-configure-globalsetup-and-globalteardown
 * @param config
 */
function globalSetup(config: FullConfig): void {
  // We cannot directly reference the files in the node_modules directory,
  // otherwise Playwright's TypeScript processing gets confused.
  copyDirectory('node_modules/playwright-drupal/src', 'packages/playwright-drupal');

  // Make sure we have the initial site database.
  installBaseDrupalSite();
}

/**
 * Copy a directory recursively.
 *
 * @param src
 * @param dest
 */
function copyDirectory(src: string, dest: string) {
  try {

    fs.mkdirSync(dest, {recursive: true});
    let entries = fs.readdirSync(src, { withFileTypes: true });

    for (let entry of entries) {
      let srcPath = path.join(src, entry.name);
      let destPath = path.join(dest, entry.name);

      if (entry.isDirectory()) {
        copyDirectory(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }
  catch (error) {
    console.error('Error occurred:', error);
  }
}

/**
 * Call task to do a site install.
 */
function installBaseDrupalSite(): void {
  if (!fs.existsSync('/tmp/sqlite/.ht.sqlite')) {
    taskSync('playwright:install', {stdio: 'inherit'});
  }
  else {
    console.log("/tmp/sqlite/.ht.sqlite exists. Not installing Drupal. Run task playwright:install to reinstall if needed.")
  }
}

export default globalSetup;
