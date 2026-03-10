---
id: 3
group: "testing"
dependencies: [2]
status: "completed"
created: "2026-03-10"
skills:
  - typescript
  - unit-testing
---
# Set Up Vitest and Write YoutubeMock Unit Test

## Objective
Add Vitest as a dev dependency, configure it, write a unit test for `YoutubeMock`, and update npm scripts to support both unit and integration tests.

## Skills Required
- typescript, unit-testing

## Acceptance Criteria
- [ ] `vitest` is installed as a devDependency
- [ ] `vitest.config.ts` exists at project root with correct configuration
- [ ] `src/util/mock/youtube.test.ts` tests YoutubeMock behavior
- [ ] `npm run test:unit` runs vitest and passes
- [ ] `npm run test:bats` runs `bats test/`
- [ ] `npm test` runs `npm run test:unit && npm run test:bats`
- [ ] Tests verify: route is called with YouTube regex, fulfill is called with correct HTML, regex matches YouTube URLs and rejects non-YouTube URLs

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- Use `vi.fn()` to mock Playwright `Page` and `Route` objects
- Test the regex pattern matching separately from the route handler

## Input Dependencies
- Task 2: `YoutubeMock` class must exist

## Output Artifacts
- `vitest.config.ts`
- `src/util/mock/youtube.test.ts`
- Modified `package.json` (scripts and devDependencies)

## Implementation Notes

<details>

### Meaningful Test Strategy Guidelines

Write a few tests, mostly integration. Focus on testing YOUR code, not the framework.

**When TO Write Tests:**
- Custom business logic and algorithms
- Critical user workflows and data transformations
- Edge cases and error conditions for core functionality

**When NOT to Write Tests:**
- Third-party library functionality
- Framework features
- Simple CRUD operations without custom logic

### Install vitest

```bash
npm install --save-dev vitest
```

### vitest.config.ts

```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
  },
})
```

### package.json script changes

Replace `"test": "bats test/"` with:
```json
"test": "npm run test:unit && npm run test:bats",
"test:unit": "vitest run",
"test:bats": "bats test/"
```

### src/util/mock/youtube.test.ts

```typescript
import { describe, it, expect, vi } from 'vitest'
import { YoutubeMock } from './youtube'

describe('YoutubeMock', () => {
  it('registers a route handler for youtube.com', async () => {
    const mockPage = {
      route: vi.fn(),
    }

    const mock = new YoutubeMock()
    await mock.mock(mockPage as any)

    expect(mockPage.route).toHaveBeenCalledOnce()
    const [pattern] = mockPage.route.mock.calls[0]
    expect(pattern).toBeInstanceOf(RegExp)
    expect(pattern.test('https://www.youtube.com/embed/abc123')).toBe(true)
    expect(pattern.test('https://www.notyoutube.com')).toBe(false)
  })

  it('fulfills with HTML mock content', async () => {
    const mockFulfill = vi.fn()
    const mockPage = {
      route: vi.fn(),
    }

    const mock = new YoutubeMock()
    await mock.mock(mockPage as any)

    // Call the route handler
    const handler = mockPage.route.mock.calls[0][1]
    await handler({ fulfill: mockFulfill })

    expect(mockFulfill).toHaveBeenCalledOnce()
    const fulfillArg = mockFulfill.mock.calls[0][0]
    expect(fulfillArg.contentType).toBe('text/html')
    expect(fulfillArg.body).toContain('Youtube Video Mock')
  })
})
```

### Verification

Run `npm run test:unit` to verify tests pass.

</details>
