---
id: 3
group: "commit-enforcement"
dependencies: []
status: "completed"
created: "2026-03-09"
skills:
  - typescript
  - bash
---
# Set Up Local Commit Message Enforcement with commitlint and husky

## Objective
Install and configure commitlint and husky so that non-conventional commit messages are rejected locally before they reach CI.

## Skills Required
- `typescript`: Modifying `package.json` scripts and dev dependencies for a Node/TypeScript project
- `bash`: Creating the husky git hook script

## Acceptance Criteria
- [ ] `@commitlint/cli` and `@commitlint/config-conventional` are added as dev dependencies
- [ ] `husky` is added as a dev dependency
- [ ] `package.json` has a `"prepare": "husky"` script
- [ ] `commitlint.config.js` exists at repo root extending `@commitlint/config-conventional`
- [ ] `.husky/commit-msg` hook exists and runs commitlint
- [ ] Running `npm install` installs the git hook automatically

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- `@commitlint/cli` and `@commitlint/config-conventional` (latest versions)
- `husky` v9+ (auto-detects CI and skips hook installation when `CI` env var is set)

## Input Dependencies
None — this task is independent.

## Output Artifacts
- `commitlint.config.js`
- `.husky/commit-msg`
- Updated `package.json` (new dev dependencies + `prepare` script)

## Implementation Notes

<details>
<summary>Detailed implementation guidance</summary>

### Step 1: Install dependencies

```bash
npm install --save-dev @commitlint/cli @commitlint/config-conventional husky
```

### Step 2: Add prepare script to package.json

Add to `"scripts"`:

```json
"prepare": "husky"
```

The existing scripts section has `"build"` and `"test"`. Add `"prepare"` alongside them. The `prepare` script runs automatically after `npm install`, which installs the husky git hooks.

### Step 3: Create commitlint.config.js

Create at repository root:

```js
export default { extends: ['@commitlint/config-conventional'] };
```

Note: The project's `package.json` has `"type": "module"` is NOT set, so use CommonJS format instead:

```js
module.exports = { extends: ['@commitlint/config-conventional'] };
```

Check the package.json for `"type": "module"` to determine which format to use. If no `"type"` field is present, default to CommonJS.

This extends the conventional config which enforces all standard types (feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert). No additional type restrictions are needed — this matches what `webiny/action-conventional-commits` validates in CI.

### Step 4: Initialize husky and create the commit-msg hook

```bash
npx husky init
```

Then create `.husky/commit-msg`:

```bash
npx commitlint --edit "$1"
```

The `husky init` command creates the `.husky/` directory. The `commit-msg` file does NOT need a shebang line with husky v9 — husky handles execution directly.

### Important notes

- husky v9 auto-detects CI environments (checks `CI` env var) and skips hook installation. No special CI configuration needed.
- The `commitlint.config.js` is only used locally by husky. The CI workflow uses `webiny/action-conventional-commits` which does not read this file.
- After all files are created, run `npm install` to verify the `prepare` script works and the git hook is installed.

</details>
