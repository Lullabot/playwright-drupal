import * as fs from 'fs';

/**
 * Get the Drupal docroot directory name from composer.json.
 *
 * Reads `extra.drupal-scaffold.locations.web-root` from the specified
 * composer.json file. Falls back to `web` if the key is missing, the file
 * doesn't exist, or parsing fails.
 *
 * @param composerJsonPath - Path to the composer.json file. Defaults to
 *   `../../composer.json` (relative to `test/playwright/` cwd).
 * @returns The docroot directory name without a trailing slash (e.g. `web` or `docroot`).
 */
export function getDocroot(composerJsonPath: string = '../../composer.json'): string {
  const defaultDocroot = 'web';

  try {
    const composerJson = JSON.parse(fs.readFileSync(composerJsonPath, 'utf-8'));
    const webRoot: unknown = composerJson?.extra?.['drupal-scaffold']?.locations?.['web-root'];

    if (typeof webRoot !== 'string' || webRoot.length === 0) {
      return defaultDocroot;
    }

    // Strip trailing slash(es).
    return webRoot.replace(/\/+$/, '') || defaultDocroot;
  } catch {
    return defaultDocroot;
  }
}
