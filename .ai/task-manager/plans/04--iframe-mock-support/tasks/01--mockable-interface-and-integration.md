---
id: 1
group: "core-implementation"
dependencies: []
status: "completed"
created: "2026-03-10"
skills:
  - typescript
---
# Add Mockable Interface and Integration to visualdiff.ts

## Objective
Add the `Mockable` and `MockableConstructor` interfaces to `visualdiff.ts`, add the `mockClass` property to `BaseVisualDiff`, and wire mock execution into `defaultTestFunction`. Also remove the `packageManager` field from `package.json` and add `exclude` to `tsconfig.json`.

## Skills Required
- typescript

## Acceptance Criteria
- [ ] `Mockable` interface with `mock(page: Page): Promise<void>` is exported from `visualdiff.ts`
- [ ] `MockableConstructor` interface with `new (): Mockable` is exported from `visualdiff.ts`
- [ ] `Page` is imported from `@playwright/test`
- [ ] `BaseVisualDiff` has optional `mockClass?: MockableConstructor` property (NOT `MockableConstructor | void`)
- [ ] `defaultTestFunction` calls `mock.mock(page)` before `page.goto()` when `mockClass` is defined
- [ ] `packageManager` field is removed from `package.json` (if present after rebase)
- [ ] `tsconfig.json` has `"exclude": ["**/*.test.ts"]`
- [ ] `tsc` compiles without errors

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- Import `Page` from `@playwright/test` alongside existing imports
- The `mockClass` type should be `MockableConstructor` (optional via `?`), not `MockableConstructor | void`
- Mock execution must happen before the `context.on('weberror', ...)` line in `defaultTestFunction`

## Input Dependencies
None - this is a foundational task.

## Output Artifacts
- Modified `src/testcase/visualdiff.ts` with interfaces and mock integration
- Modified `tsconfig.json` with exclude
- Modified `package.json` (if packageManager present)

## Implementation Notes

<details>

### visualdiff.ts changes

1. Change line 1 from `import {test, WebError} from '@playwright/test';` to `import {Page, test, WebError} from '@playwright/test';`

2. Add interfaces after the `VisualDiffGroup` type (before the `VisualDiff` type):
```typescript
export interface MockableConstructor {
  new (): Mockable;
}
export interface Mockable {
  mock(page: Page): Promise<void>
}
```

3. Add `mockClass?: MockableConstructor` to `BaseVisualDiff` type (after the `skip` property).

4. In `defaultTestFunction`, add mock execution at the beginning of the async function body (before the `context.on('weberror', ...)` line):
```typescript
if (testCase.mockClass != undefined) {
  const mock = new testCase.mockClass;
  await mock.mock(page);
}
```

### tsconfig.json changes

Add `"exclude": ["**/*.test.ts"]` to the top-level config object.

### package.json changes

If `packageManager` field exists, remove it entirely.

### Verification

Run `npx tsc --noEmit` to verify compilation succeeds.

</details>
