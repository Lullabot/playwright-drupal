import { defineConfig, PlaywrightTestConfig } from '@playwright/test';
import path from 'path';
import os from 'os';

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
      ? [['line'], ['html']]
      : [['html', { host: '0.0.0.0', port: 9323 }], ['list']],
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
