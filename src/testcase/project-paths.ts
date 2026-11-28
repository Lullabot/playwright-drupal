import * as fs from "fs";
import * as path from "path";

const PACKAGE_BIN = path.join("bin", "drush-playwright");
const INSTALLED_BIN = path.join(
  "node_modules",
  "@lullabot",
  "playwright-drupal",
  PACKAGE_BIN,
);

/**
 * Find bin/drush-playwright by walking up from this module's directory.
 *
 * The module runs from the package's own lib/ directory or from the
 * packages/playwright-drupal copy that global setup places next to the
 * suite's node_modules, so both layouts are checked at every level.
 *
 * @param startDir - Directory to start from.
 * @returns The absolute path to bin/drush-playwright.
 */
export function resolveDrushPlaywrightBin(startDir: string): string {
  let dir = path.resolve(startDir);
  for (;;) {
    for (const candidate of [PACKAGE_BIN, INSTALLED_BIN]) {
      const bin = path.join(dir, candidate);
      if (fs.existsSync(bin)) {
        return bin;
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      throw new Error(`Could not find ${PACKAGE_BIN} above ${startDir}.`);
    }
    dir = parent;
  }
}

/**
 * Find the DDEV project root, the closest directory above with a .ddev folder.
 *
 * @param startDir - Directory to start from.
 * @returns The absolute path to the project root.
 */
export function findDdevProjectRoot(startDir: string): string {
  let dir = path.resolve(startDir);
  while (!fs.existsSync(path.join(dir, ".ddev"))) {
    const parent = path.dirname(dir);
    if (parent === dir) {
      throw new Error(`Could not find a DDEV project above ${startDir}.`);
    }
    dir = parent;
  }
  return dir;
}

/**
 * Build the command that runs drush-playwright for a test site.
 *
 * Inside the web container the absolute path works as is. From the host,
 * `ddev exec` runs in the project root inside the container, where the
 * host path does not exist, so the path is made relative to the project.
 *
 * @param testId - The Drupal test ID.
 * @param startDir - Directory to start looking for the binary from.
 * @param insideDdev - Whether this runs inside the web container.
 * @returns The command, without the drush arguments.
 */
export function drushPlaywrightCommand(
  testId: number,
  startDir: string,
  insideDdev: boolean,
): string {
  const bin = resolveDrushPlaywrightBin(startDir);
  if (insideDdev) {
    return `${bin} ${testId}`;
  }
  const relative = path.relative(findDdevProjectRoot(bin), bin);
  return `ddev exec ./${relative.split(path.sep).join("/")} ${testId}`;
}
