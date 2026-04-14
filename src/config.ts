import { defineConfig, PlaywrightTestConfig } from '@playwright/test';
import path from 'path';
import os from 'os';

// Detect when this module is loaded from the packages/ source copy in a config
// file. The barrel (index.ts) re-exports config before testcase, so this check
// fires before testcase/test.ts tries to call test.afterEach() — which would
// otherwise produce a confusing Playwright error.
if (__dirname.includes(path.sep + 'packages' + path.sep + 'playwright-drupal')) {
  const stack = new Error().stack || '';
  if (/playwright\.config\.[tj]s/.test(stack)) {
    throw new Error(
      [
        'Wrong import path in playwright.config.ts.',
        '',
        'You are importing from the packages/ directory, which is a runtime',
        'copy intended only for test files.',
        '',
        'In your playwright.config.ts, change:',
        '  import { definePlaywrightDrupalConfig } from \'@packages/playwright-drupal\';',
        'to:',
        '  import { definePlaywrightDrupalConfig } from \'@lullabot/playwright-drupal/config\';',
      ].join('\n')
    );
  }
}

/**
 * Define a Playwright configuration with sensible defaults for Drupal testing.
 *
 * Provides:
 * - `use.baseURL` from the `DDEV_PRIMARY_URL` environment variable
 * - `fullyParallel: true`
 * - `workers` based on CPU count (`Math.max(2, cpus - 2)`)
 * - CI-aware `reporter` (line + html on CI; html + list locally)
 * - `globalSetup` pointing to this package's global-setup module
 *
 * @param overrides - Optional Playwright config overrides. Plain-object
 *   properties are deep-merged with the corresponding defaults at every
 *   level, so providing `use.baseURL` replaces the default while keeping
 *   other `use` defaults. Non-object properties (including arrays like
 *   `reporter`) replace the default entirely.
 */
export function definePlaywrightDrupalConfig(overrides: PlaywrightTestConfig = {}): PlaywrightTestConfig {
  const isCI = !!process.env.CI;

  const defaults: PlaywrightTestConfig = {
    fullyParallel: true,
    workers: Math.max(2, os.cpus().length - 2),
    reporter: isCI
      ? [['line'], ['html'], ['json', { outputFile: 'test-results/results.json' }]]
      : [['html', { host: '0.0.0.0', port: 9323 }], ['list'], ['json', { outputFile: 'test-results/results.json' }]],
    globalSetup: path.resolve(__dirname, 'setup', 'global-setup.js'),
    use: {
      baseURL: process.env.DDEV_PRIMARY_URL,
    },
  };

  return defineConfig(deepMerge(defaults, overrides));
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function deepMerge(target: Record<string, any>, source: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = { ...target, ...source };
  for (const key of Object.keys(target)) {
    if (isPlainObject(target[key]) && isPlainObject(source[key])) {
      result[key] = deepMerge(target[key], source[key]);
    }
  }
  return result;
}
