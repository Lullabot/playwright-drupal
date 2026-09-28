---
id: 5
group: "login-helper"
dependencies: [1]
status: "completed"
created: 2026-03-16
skills:
  - typescript
  - playwright-api
  - bats-testing
  - documentation
---
# Login Helper PR

## Objective
Create a `login(page)` function that authenticates a Drupal user, working with per-test SQLite isolation, supporting both legacy Admin Toolbar and Navigation module. Include integration test and README documentation.

## Skills Required
- TypeScript / Playwright API
- Bats integration testing
- README documentation

## Acceptance Criteria
- [ ] New `src/util/login.ts` exports `login(page)` function
- [ ] Function re-exported through `src/index.ts`
- [ ] Reads credentials from `DRUPAL_USER` / `DRUPAL_PASS` env vars (default: `admin` / `admin`)
- [ ] Calls `execDrushInTestSite()` to set password per-test
- [ ] Navigates to `/user/login` and uses `Promise.race()` to detect toolbar vs login form
- [ ] Handles already-logged-in state gracefully (toolbar visible = return immediately)
- [ ] Uses selectors from Task 1 investigation that work with both Admin Toolbar and Navigation module
- [ ] Integration test: example Playwright test in `test_helper.bash` `write_example_test()` imports and uses `login()`
- [ ] README updated with login helper section: API, env var config, usage example
- [ ] All tests pass locally (`npm run test:unit` and `npm run test:bats`)
- [ ] PR created on branch `feat/login-helper`, all CI status checks pass

## Technical Requirements

### Login Function (`src/util/login.ts`)
```typescript
import { Page } from '@playwright/test';
import { execDrushInTestSite } from '../testcase/test';

export async function login(page: Page) {
  const username = process.env.DRUPAL_USER || 'admin';
  const password = process.env.DRUPAL_PASS || 'admin';

  await execDrushInTestSite(`user:password ${username} ${password}`);
  await page.goto('/user/login');

  // Use selectors determined by Task 1 investigation
  const toolbar = page.locator('<SELECTOR-FROM-TASK-1>');
  const loginForm = page.locator('form#user-login-form');

  const visible = await Promise.race([
    toolbar.waitFor({ state: 'visible' }).then(() => 'toolbar' as const),
    loginForm.waitFor({ state: 'visible' }).then(() => 'form' as const),
  ]);

  if (visible === 'toolbar') return;

  await page.getByLabel('Username').fill(username);
  await page.getByLabel('Password').fill(password);
  await page.click('form#user-login-form input#edit-submit');
  await toolbar.waitFor({ state: 'visible' });
}
```

### Integration Test
Add a test case in `write_example_test()` in `test/test_helper.bash` that:
1. Imports `login` from `@packages/playwright-drupal`
2. Calls `login(page)` within a test
3. Asserts that the page is authenticated (e.g., can access `/admin`)

### README Documentation
Add a section documenting:
- `login(page)` API and behavior
- `DRUPAL_USER` and `DRUPAL_PASS` environment variables
- Usage example within a Playwright test

## Input Dependencies
- **Task 1**: Toolbar selector investigation results — determines the CSS selector used for the toolbar locator

## Output Artifacts
- New `src/util/login.ts`
- Modified `src/index.ts` (add export)
- Modified `test/test_helper.bash` (add login test)
- Updated `README.md`
- GitHub PR with passing CI checks

## Implementation Notes
- Import `execDrushInTestSite` from `../testcase/test` — one-way dependency, no circular import risk
- The `execDrushInTestSite` call is essential: each test gets a fresh SQLite copy where the password may differ
- The `Promise.race()` pattern avoids timeout delays when already authenticated
- Commit message: `feat: add login helper utility`
- After pushing, monitor CI with `gh pr checks <PR-URL> --watch` and fix any failures
