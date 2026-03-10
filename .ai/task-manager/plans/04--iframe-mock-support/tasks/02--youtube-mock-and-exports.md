---
id: 2
group: "core-implementation"
dependencies: [1]
status: "pending"
created: "2026-03-10"
skills:
  - typescript
---
# Create YoutubeMock Class and Package Exports

## Objective
Create the `YoutubeMock` class that implements `Mockable`, set up barrel exports so it's importable from the package, and remove the generic `Mock` wrapper class per reviewer feedback.

## Skills Required
- typescript

## Acceptance Criteria
- [ ] `src/util/mock/youtube.ts` exists with `YoutubeMock` class implementing `Mockable`
- [ ] Regex uses a regex literal `/www\.youtube\.com/i` (NOT `new RegExp` with string)
- [ ] Route handler returns HTML with "Youtube Video Mock" placeholder
- [ ] `src/util/mock/index.ts` barrel file exports `YoutubeMock`
- [ ] `src/util/index.ts` re-exports from `./mock`
- [ ] No `mock.ts` (generic Mock wrapper) file exists
- [ ] `tsc` compiles without errors

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- Use regex literal `/www\.youtube\.com/i` to fix the GitHub Advanced Security warning about unescaped dots in `new RegExp()` string
- The class should be named `YoutubeMock` (not `Youtube`) for clarity per reviewer feedback
- Import `Mockable` from `../../testcase` and `Page` from `@playwright/test`

## Input Dependencies
- Task 1: `Mockable` interface must exist in `visualdiff.ts`

## Output Artifacts
- `src/util/mock/youtube.ts` — YoutubeMock class
- `src/util/mock/index.ts` — barrel export
- Modified `src/util/index.ts` — re-exports mock module

## Implementation Notes

<details>

### src/util/mock/youtube.ts

```typescript
import {Page} from '@playwright/test';
import {Mockable} from "../../testcase";

export class YoutubeMock implements Mockable {

  public async mock(page: Page): Promise<void> {
    await page.route(/www\.youtube\.com/i, async route => {
      await route.fulfill({
        contentType: 'text/html',
        body: `
<html>
<head>
    <title>Youtube Video Mock</title>
    <style>
        body {
          color: white;
          background-color: darkred;
        }
        div {
          position: absolute;
          top: 50%;
          left: 50%;
          margin: 0;
          transform: translate(-50%, -50%);
          font-size: xxx-large;
          text-align: center;
        }
    </style>
</head>
<body>
    <div>Youtube Video Mock</div>
</body>
</html>
`,
      });
    });
  }

}
```

### src/util/mock/index.ts

```typescript
export { YoutubeMock } from './youtube'
```

### src/util/index.ts

Add `export * from './mock'` to the existing exports.

### Verification

Run `npx tsc --noEmit` to verify compilation succeeds.

</details>
