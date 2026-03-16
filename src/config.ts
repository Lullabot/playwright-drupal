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
 * @param overrides - Optional Playwright config overrides. Properties are
 *   shallow-merged with defaults, so providing `reporter` replaces the entire
 *   default reporter array. The `use` object is also shallow-merged, so
 *   providing `use.baseURL` replaces the default while keeping other `use`
 *   defaults.
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

  // Shallow-merge `use` separately so user overrides extend rather than
  // fully replace the default `use` object.
  const { use: overrideUse, ...restOverrides } = overrides;
  const mergedUse = { ...defaults.use, ...overrideUse };

  return defineConfig({ ...defaults, ...restOverrides, use: mergedUse });
}
