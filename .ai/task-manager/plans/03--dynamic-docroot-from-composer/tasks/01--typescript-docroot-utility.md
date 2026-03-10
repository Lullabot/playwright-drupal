---
id: 1
group: "docroot-detection"
dependencies: []
status: "pending"
created: "2026-03-10"
skills:
  - typescript
---
# Create TypeScript docroot utility and update hardcoded references

## Objective
Create a utility function that reads the Drupal docroot from `composer.json` and use it to replace hardcoded `web/` references in the TypeScript source files.

## Skills Required
- TypeScript: reading/parsing JSON files, path manipulation

## Acceptance Criteria
- [ ] New utility function exists that reads `extra.drupal-scaffold.locations.web-root` from `composer.json`
- [ ] The function strips trailing slashes from the value (e.g., `web/` becomes `web`)
- [ ] The function falls back to `web` if the key is missing or `composer.json` is not found
- [ ] `src/testcase/test.ts` line 74 uses the utility instead of hardcoded `../../web/`
- [ ] The project compiles with `tsc` without errors

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- Node.js `fs` and `path` modules for file reading
- JSON parsing of `composer.json`

## Input Dependencies
None — this is a standalone implementation task.

## Output Artifacts
- New utility file (e.g., `src/util/docroot.ts`) exporting a `getDocroot()` function
- Updated `src/testcase/test.ts` using the utility
- Compiled output in `lib/` via `tsc`

## Implementation Notes

<details>
<summary>Detailed implementation guidance</summary>

### Utility function location
Create `src/util/docroot.ts` and export from `src/util/index.ts`.

### Function behavior
The function `getDocroot()` should:

1. Playwright tests run from `test/playwright/` as their cwd. The Drupal project's `composer.json` is at `../../composer.json` relative to that cwd. However, the utility should be more robust — it should accept an optional base path parameter or use a strategy that works from multiple contexts.

2. **Recommended approach**: Since this code runs inside the DDEV container where cwd is `/var/www/html` (set by `src/cli/exec.ts`), or from `test/playwright/` on the host, the function should look for `composer.json` relative to the project root. The simplest approach: accept a path to composer.json or find it by walking up from cwd.

3. Read and parse the JSON:
   ```typescript
   const composerJson = JSON.parse(fs.readFileSync(composerJsonPath, 'utf-8'));
   const webRoot = composerJson?.extra?.['drupal-scaffold']?.locations?.['web-root'];
   ```

4. Normalize: strip trailing `/` from the value. E.g., `web/` → `web`, `docroot/` → `docroot`.

5. Fall back to `web` if the key is missing, the file doesn't exist, or parsing fails.

### Update `src/testcase/test.ts`
Line 74 currently reads:
```typescript
let logPath = '../../web/sites/simpletest/' + drupal_test_id + '/error.log';
```

Change to use the utility. Since this code runs with cwd `test/playwright/`, the composer.json is at `../../composer.json`:
```typescript
import { getDocroot } from '../util/docroot';
// ...
let logPath = '../../' + getDocroot('../../composer.json') + '/sites/simpletest/' + drupal_test_id + '/error.log';
```

Or use `path.join` for cleanliness.

### Export
Make sure `getDocroot` is exported from `src/util/index.ts` so it's available from the package.

### Build verification
Run `npx tsc` to verify the project compiles.

</details>
