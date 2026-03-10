---
id: 5
group: "documentation"
dependencies: [2]
status: "completed"
created: "2026-03-10"
skills:
  - documentation
---
# Add Iframe Mock Documentation to README

## Objective
Add a section to the README explaining how to use `YoutubeMock` for visual diff tests and how to create custom mocks implementing the `Mockable` interface.

## Skills Required
- documentation

## Acceptance Criteria
- [ ] README has a new section on iframe mocking within the Visual Comparisons area
- [ ] Shows how to use `YoutubeMock` in visual diff config with `mockClass` property
- [ ] Shows how to create a custom mock implementing `Mockable`
- [ ] Import paths use `@packages/playwright-drupal` (consistent with existing README examples)

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- Place the section after the existing "Replacing the test case with your own" subsection, or as a subsection within "Visual Comparisons (Diffs)"
- Use the same code style and formatting as existing README sections

## Input Dependencies
- Task 2: `YoutubeMock` class and `Mockable` interface must exist

## Output Artifacts
- Modified `README.md`

## Implementation Notes

<details>

### README section to add

Add a new subsection under "Visual Comparisons (Diffs)" called "### Mocking Iframe Content". Place it after the "Replacing the test case with your own" subsection.

Content should include:

1. **Why**: External iframes (YouTube, etc.) cause non-deterministic screenshots in visual diff tests.

2. **Built-in YoutubeMock usage example**:
```typescript
import { defineVisualDiffConfig } from '@packages/playwright-drupal';
import { YoutubeMock } from '@packages/playwright-drupal';

export const config = defineVisualDiffConfig({
  name: "MySite Visual Diffs",
  groups: [
    {
      name: "Landing Pages",
      testCases: [
        {
          name: "About Us",
          path: "/about-us",
          mockClass: YoutubeMock,
        }
      ]
    }
  ],
});
```

3. **Custom mock example**:
```typescript
import { Page } from '@playwright/test';
import { Mockable } from '@packages/playwright-drupal';

export class VimeoMock implements Mockable {
  public async mock(page: Page): Promise<void> {
    await page.route(/player\.vimeo\.com/i, async route => {
      await route.fulfill({
        contentType: 'text/html',
        body: '<html><body><div>Vimeo Mock</div></body></html>',
      });
    });
  }
}
```

Explain that `mockClass` accepts any class implementing `Mockable`, which has a single `mock(page: Page): Promise<void>` method that uses Playwright's `page.route()` to intercept and replace network requests.

</details>
