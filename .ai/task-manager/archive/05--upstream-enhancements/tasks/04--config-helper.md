---
id: 4
group: "config-helper"
dependencies: []
status: "completed"
created: 2026-03-16
skills:
  - typescript
  - vitest
  - bats-testing
  - documentation
---
# Config Helper PR

## Objective
Create a `definePlaywrightDrupalConfig()` function that returns a complete Playwright config with sensible defaults, plus unit tests, integration test updates, and README documentation.

## Skills Required
- TypeScript / Playwright API
- Vitest unit testing
- Bats integration testing (modify existing test helper)
- README documentation

## Acceptance Criteria
- [ ] New `src/config.ts` exports `definePlaywrightDrupalConfig()` function
- [ ] Function re-exported through `src/index.ts`
- [ ] Uses Playwright's `defineConfig()` internally
- [ ] Auto-resolves `globalSetup` path via `path.resolve(__dirname, 'setup', 'global-setup.js')`
- [ ] Defaults: `baseURL` from `DDEV_PRIMARY_URL`, reporter differs by CI, workers = `Math.max(2, os.cpus().length - 2)`, `fullyParallel: true`
- [ ] Shallow merge: user overrides fully replace defaults at top level
- [ ] Vitest unit tests in `src/config.test.ts` cover: defaults, CI reporter branching, merge behavior, globalSetup path resolution, passthrough of unknown properties
- [ ] Integration test updated: `configure_playwright()` in `test/test_helper.bash` uses `definePlaywrightDrupalConfig()` instead of manual `defineConfig()`
- [ ] README updated with usage example and updated `playwright.config.ts` setup instructions
- [ ] All tests pass locally (`npm run test:unit` and `npm run test:bats`)
- [ ] PR created on branch `feat/config-helper`, all CI status checks pass

## Technical Requirements

### Config Function (`src/config.ts`)
```typescript
import { defineConfig } from '@playwright/test';
import path from 'path';
import os from 'os';

export function definePlaywrightDrupalConfig(overrides = {}) {
  const isCI = !!process.env.CI;
  const defaults = {
    baseURL: process.env.DDEV_PRIMARY_URL,
    fullyParallel: true,
    workers: Math.max(2, os.cpus().length - 2),
    reporter: isCI
      ? [['line'], ['html']]
      : [['html', { host: '0.0.0.0', port: 9323 }], ['list']],
    globalSetup: path.resolve(__dirname, 'setup', 'global-setup.js'),
  };
  return defineConfig({ ...defaults, ...overrides });
}
```

### Defaults Table
| Property | CI | Local |
|---|---|---|
| `baseURL` | `process.env.DDEV_PRIMARY_URL` | `process.env.DDEV_PRIMARY_URL` |
| `reporter` | `[['line'], ['html']]` | `[['html', { host: '0.0.0.0', port: 9323 }], ['list']]` |
| `workers` | `Math.max(2, os.cpus().length - 2)` | `Math.max(2, os.cpus().length - 2)` |
| `fullyParallel` | `true` | `true` |
| `globalSetup` | Auto-resolved | Auto-resolved |

### Unit Tests (`src/config.test.ts`)
- Default values applied when no overrides
- CI vs local produces correct reporter
- `baseURL` defaults to `DDEV_PRIMARY_URL` env var
- User overrides replace defaults (shallow merge)
- `globalSetup` resolves to valid path
- Unknown properties pass through

### Integration Test Update
Update `configure_playwright()` in `test/test_helper.bash` to generate a `playwright.config.ts` that imports and uses `definePlaywrightDrupalConfig()` from the package.

## Input Dependencies
None — standalone component.

## Output Artifacts
- New `src/config.ts`
- New `src/config.test.ts`
- Modified `src/index.ts` (add export)
- Modified `test/test_helper.bash`
- Updated `README.md`
- GitHub PR with passing CI checks

## Implementation Notes
- Follow the pattern of existing `defineVisualDiffConfig()` in `src/testcase/visualdiff.ts`
- The `__dirname` in compiled output resolves to `lib/`, so `path.resolve(__dirname, 'setup', 'global-setup.js')` correctly points to `lib/setup/global-setup.js`
- Commit message: `feat: add definePlaywrightDrupalConfig() config helper`
- After pushing, monitor CI with `gh pr checks <PR-URL> --watch` and fix any failures
