import { Page } from "@playwright/test";

/**
 * Expand every collapsed `<details>` element on the page so nested controls
 * become interactable. Call after navigation and before filling nested fields.
 */
export async function openAllDetails(page: Page): Promise<void> {
  await page.evaluate(() => {
    document.querySelectorAll("details:not([open])").forEach((d) => {
      (d as HTMLDetailsElement).open = true;
    });
  });
}
