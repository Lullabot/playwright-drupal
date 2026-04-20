# Playwright Configuration

The `definePlaywrightDrupalConfig()` function returns a complete Playwright configuration with sensible defaults for Drupal testing. It wraps Playwright's `defineConfig()` and applies the following defaults:

| Setting | Default |
|---|---|
| `use.baseURL` | `process.env.DDEV_PRIMARY_URL` |
| `fullyParallel` | `true` |
| `workers` | `Math.max(2, os.cpus().length - 2)` |
| `reporter` | CI: `[['line'], ['html'], ['json', ...]]`; Local: `[['html', ...], ['list'], ['json', ...]]` |
| `globalSetup` | Auto-resolved path to this package's `global-setup` module |

## Overriding Defaults

Plain-object properties are deep-merged with their defaults at every nesting level. For example, providing `use.ignoreHTTPSErrors` keeps the default `use.baseURL` while adding your setting. Non-object properties (including arrays like `reporter`) replace the default entirely.

If you need full control, you can always use Playwright's `defineConfig()` directly with the `globalSetup` path from this package.

This example imports the default configuration and shows overriding some common settings.

```typescript
import { definePlaywrightDrupalConfig } from '@lullabot/playwright-drupal/config';
import { devices } from '@playwright/test';

export default definePlaywrightDrupalConfig({
  testDir: './tests',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  use: {
    ignoreHTTPSErrors: true,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
```
