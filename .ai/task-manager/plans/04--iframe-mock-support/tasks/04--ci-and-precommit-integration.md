---
id: 4
group: "ci-cd"
dependencies: [3]
status: "completed"
created: "2026-03-10"
skills:
  - github-actions
  - bash
---
# Add Unit Tests to CI and Pre-commit Hook

## Objective
Add a separate CI job for `npm run test:unit` in the GitHub Actions workflow, and update the pre-commit hook to always run unit tests and use `test:bats` for the conditional integration test block.

## Skills Required
- github-actions, bash

## Acceptance Criteria
- [ ] `.github/workflows/test.yml` has a new `unit-test` job that runs `npm run test:unit`
- [ ] The unit test job only needs Node.js (no DDEV, no bats, no browsers)
- [ ] `.husky/pre-commit` runs `npm run test:unit` unconditionally before the existing conditional block
- [ ] The conditional bats invocation uses `npm run test:bats` instead of `npm test`
- [ ] Both files have correct syntax

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- The unit test CI job should use `actions/checkout` and `actions/setup-node` with `node-version-file: 'package.json'` or similar
- The unit test job runs in parallel with the existing integration test job

## Input Dependencies
- Task 3: `npm run test:unit` script must exist

## Output Artifacts
- Modified `.github/workflows/test.yml`
- Modified `.husky/pre-commit`

## Implementation Notes

<details>

### .github/workflows/test.yml

Add a new job before or after the existing `test` job:

```yaml
  unit-test:
    runs-on: ubuntu-24.04
    steps:
      - name: Checkout
        uses: actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd # v6

      - name: Setup Node.js
        uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v6
        with:
          node-version-file: '.nvmrc'

      - name: Install dependencies
        run: npm ci

      - name: Run unit tests
        run: npm run test:unit
```

Check if `.nvmrc` exists. If not, use a fixed node version or `package.json` engines field. Look at the existing workflow for patterns.

Also update the existing integration test job's `Run integration tests` step from `bats test/` to `npm run test:bats` for consistency.

### .husky/pre-commit

The new hook should:
1. Always run `npm run test:unit` (unconditional, since it's fast)
2. Keep the existing conditional bats block but change `npm test` to `npm run test:bats`

```bash
# Always run fast unit tests
npm run test:unit

# Run integration tests only under AI agents when testable paths change
TESTABLE_PATHS="package.json|settings/|src/|tasks/|test/|tsconfig.json"
if [ -n "$CLAUDE_CODE" ] || [ -n "$GITHUB_COPILOT" ] || [ -n "$CODESPACES" ]; then
  if git diff --cached --name-only | grep -qE "^($TESTABLE_PATHS)"; then
    npm run test:bats
  fi
fi
```

</details>
