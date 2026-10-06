import { test, expect } from "../../src/testcase/test";

const loginURL = `data:text/html,${encodeURIComponent(`<!doctype html>
  <label>Username <input autofocus></label>
  <label>Password <input type="password"></label>`)}`;

// The config disables Drupal database isolation. These tests exercise the
// production fixture and ensure that its early return still installs the helper.
test("shared fixture enables suppression only in WebKit", async ({
  page,
  browserName,
  webkitAutofocusWorkaround,
}) => {
  expect(webkitAutofocusWorkaround).toBe(true);
  await page.goto(loginURL);
  const username = page.getByLabel("Username");
  await expect(username).toBeVisible();
  await expect(username).toHaveAttribute("autofocus", "");
  if (browserName === "webkit") {
    await expect(username).not.toBeFocused();
  } else {
    await expect(username).toBeFocused();
  }
  expect(await username.getAttribute("style")).toBeNull();
  await username.fill("alice");
  await page.getByLabel("Password").fill("secret");
  await expect(username).toHaveValue("alice");
  await expect(page.getByLabel("Password")).toHaveValue("secret");
});

test.describe("Drupal fixture opt-out", () => {
  test.use({ webkitAutofocusWorkaround: false });

  test("preserves native autofocus", async ({ page }) => {
    await page.goto(loginURL);
    await expect(page.getByLabel("Username")).toBeFocused();
    expect(await page.getByLabel("Username").getAttribute("style")).toBeNull();
  });
});
