# CKEditor 5

`Ckeditor5` drives CKEditor 5 fields in any application. It clears existing
content and types through Playwright's keyboard API so edits pass through the
editor's input handling. It supports CKEditor 5 only.

```typescript
import { test } from '@playwright/test';
import { Ckeditor5 } from '@lullabot/playwright-testing';

test('edits the body copy', async ({ page }) => {
  await page.goto('/articles/1/edit');
  const body = new Ckeditor5(page, '#body-editor');
  await body.fill('New body text');
});
```

## Constructor

`new Ckeditor5(page: Page, selector: string, root?: Page | FrameLocator)`

| Parameter | Default | Description |
|---|---|---|
| `page` | Required | Owning page; keyboard events target this page. |
| `selector` | Required | Selector for a wrapper containing `.ck-editor__editable`, such as `#body-editor`. |
| `root` | `page` | Page or frame locator containing the wrapper. |

For an editor inside an iframe, pass its frame locator while keeping the owning
page as the first argument:

```typescript
const body = new Ckeditor5(
  page,
  '#body-editor',
  page.frameLocator('iframe.editor-frame'),
);
await body.fill('New body text');
```

## fill()

`fill(text: string): Promise<void>`

Waits up to 15 seconds for the editable to become visible, clicks to place the
caret, clears existing content with select-all and Backspace, then types the
replacement text. This preserves the helper's existing keyboard-based editing
behavior without calling `locator.fill()` on CKEditor's editable DOM.

`selectAllModifier(platform?: NodeJS.Platform): "Meta" | "Control"` is also
exported. It defaults to `process.platform`, returning `Meta` on macOS and
`Control` elsewhere.

## Drupal compatibility

Drupal tests can continue importing `Ckeditor5` and `selectAllModifier` from
`@lullabot/playwright-drupal`. The Drupal package re-exports the same helpers.
Use the Drupal field wrapper, such as `#edit-body-wrapper`, as the selector.
