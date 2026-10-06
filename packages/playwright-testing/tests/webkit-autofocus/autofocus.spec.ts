import http from "node:http";
import { test, expect } from "./fixtures";
import type { Page } from "@playwright/test";

// The form and native stress loop follow deviantintegral/playwright-autofocus-repro
// at 5f58e2553daff2788a11bcc46d3371180dfb62f6. The controlled route is deliberately
// separate: application JavaScript stealing focus must continue to do so.
const form = `<label>Username <input id="username" autocomplete="username" autofocus></label>
<label>Password <input id="password" type="password" autocomplete="current-password"></label>`;
const html = `<!doctype html><html lang="en"><meta charset="utf-8">
<title>Autofocus login repro</title>
<script>
  window.focusEvents = [];
  addEventListener('load', () => window.focusEvents.push('load'));
  addEventListener('focusin', event => window.focusEvents.push(event.target.id), true);
</script>${form}
<script>
  if (location.pathname === '/controlled') {
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    passwordInput.addEventListener('focus', () => queueMicrotask(() => usernameInput.focus()), { once: true });
  }
</script></html>`;

let server: http.Server;
let baseURL: string;
let releaseStylesheet: (() => void) | undefined;
test.beforeAll(async () => {
  server = http.createServer((request, response) => {
    if (request.url === "/blocked.css") {
      releaseStylesheet = () => {
        response.writeHead(200, { "content-type": "text/css" });
        response.end("input { color: black }");
      };
      return;
    }
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    if (request.url === "/blocked") {
      // Candidate is queued before the parser blocks on a stylesheet + script.
      response.end(
        `<!doctype html>${form}<link rel="stylesheet" href="/blocked.css"><script>window.unblocked = true;</script>`,
      );
    } else if (request.url === "/empty-blocked") {
      response.end(
        `<!doctype html><body></body><link rel="stylesheet" href="/blocked.css"><script>window.unblocked = true;</script>`,
      );
    } else if (request.url === "/empty") {
      response.end("<!doctype html><title>Dynamic form</title><body></body>");
    } else if (request.url === "/frame-blocked") {
      response.end(
        `<!doctype html><iframe src="/native"></iframe><link rel="stylesheet" href="/blocked.css"><script>window.unblocked = true;</script>`,
      );
    } else {
      response.end(html);
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseURL = `http://127.0.0.1:${(server.address() as import("node:net").AddressInfo).port}`;
});
test.afterAll(async () => {
  releaseStylesheet?.();
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
});
test.afterEach(() => {
  // Release even on assertion failure, before WebKit's context teardown.
  releaseStylesheet?.();
  releaseStylesheet = undefined;
});

async function fillForm(page: Page): Promise<void> {
  await page.getByLabel("Username").fill("alice");
  await page.getByLabel("Password").fill("secret");
  await expect(page.getByLabel("Username")).toHaveValue("alice");
  await expect(page.getByLabel("Password")).toHaveValue("secret");
}

test("native autofocus with repeated navigations", async ({ page }) => {
  const repeats = Number(process.env.REPEATS || 300);
  test.setTimeout(Math.max(120_000, repeats * 500));
  let autofocusAfterLoad = 0;
  let unfocusedAtGoto = 0;
  for (let attempt = 1; attempt <= repeats; attempt++) {
    await page.goto(`${baseURL}/native`);
    const { active, events } = await page.evaluate(() => ({
      active: document.activeElement?.id,
      events: (window as unknown as { focusEvents: string[] }).focusEvents,
    }));
    if (events.indexOf("username") > events.indexOf("load"))
      autofocusAfterLoad++;
    if (active !== "username") unfocusedAtGoto++;
    await page.getByLabel("Username").fill("alice");
    await page.getByLabel("Password").fill("secret");
    const state = await page.evaluate(() => ({
      username: (document.querySelector("#username") as HTMLInputElement).value,
      password: (document.querySelector("#password") as HTMLInputElement).value,
      active: document.activeElement?.id,
      events: (window as unknown as { focusEvents: string[] }).focusEvents,
    }));
    if (state.username !== "alice" || state.password !== "secret") {
      throw new Error(
        `Wrong-field fill on attempt ${attempt}: ${JSON.stringify({ beforeFill: { active, events }, afterFill: state })}`,
      );
    }
  }
  console.log(
    `Completed ${repeats} navigations; autofocus after load: ${autofocusAfterLoad}; not focused when goto returned: ${unfocusedAtGoto}`,
  );
});

test("browser selection and native behavior", async ({ page, browserName }) => {
  await page.goto(`${baseURL}/native`);
  await expect(page.getByLabel("Username")).toBeVisible();
  await expect(page.getByLabel("Username")).toHaveAttribute("autofocus", "");
  if (browserName === "webkit") {
    await expect(page.getByLabel("Username")).not.toBeFocused();
    expect(await page.getByLabel("Username").getAttribute("style")).toBeNull();
  } else {
    await expect(page.getByLabel("Username")).toBeFocused();
    expect(await page.getByLabel("Username").getAttribute("style")).toBeNull();
  }
});

test("reload, popup and context.newPage", async ({ page, context }) => {
  await page.goto(`${baseURL}/native`);
  await page.reload();
  await fillForm(page);
  const popupPromise = page.waitForEvent("popup");
  await page.evaluate((url) => window.open(url), `${baseURL}/native`);
  const popup = await popupPromise;
  await fillForm(popup);
  const second = await context.newPage();
  await second.goto(`${baseURL}/native`);
  await fillForm(second);
});

test("frame navigation and srcdoc", async ({ page, browserName }) => {
  await page.goto(`${baseURL}/empty`);
  await page.evaluate((url) => {
    const iframe = document.createElement("iframe");
    iframe.src = url;
    document.body.append(iframe);
  }, `${baseURL}/native`);
  const frame = page.frameLocator("iframe");
  await frame.getByLabel("Username").fill("alice");
  await frame.getByLabel("Password").fill("secret");
  await expect(frame.getByLabel("Username")).toHaveValue("alice");
  await expect(frame.getByLabel("Password")).toHaveValue("secret");
  await page.evaluate((content) => {
    document.querySelector("iframe")!.srcdoc = content;
  }, html);
  await expect(frame.getByLabel("Username")).toHaveValue("");
  await expect(frame.getByLabel("Username")).toBeVisible();
  if (browserName === "webkit") {
    await expect(frame.getByLabel("Username")).not.toBeFocused();
  }
  await frame.getByLabel("Username").fill("alice");
  await frame.getByLabel("Password").fill("secret");
  await expect(frame.getByLabel("Password")).toHaveValue("secret");
});

test("dynamic form replacement, reinsertion and removed attribute", async ({
  page,
  browserName,
}) => {
  await page.goto(`${baseURL}/empty`);
  for (let attempt = 0; attempt < 30; attempt++) {
    await page.evaluate(
      ({ markup, remove }) => {
        document.body.innerHTML = `<form>${markup}</form>`;
        // This removal cannot cancel the already queued native candidate.
        if (remove)
          document.querySelector("[autofocus]")!.removeAttribute("autofocus");
      },
      { markup: form, remove: attempt % 2 === 0 },
    );
    await expect(page.getByLabel("Username")).toBeVisible();
    if (browserName === "webkit")
      await expect(page.getByLabel("Username")).not.toBeFocused();
    await fillForm(page);
    await page.evaluate(() => {
      const element = document.querySelector("form")!;
      element.remove();
      document.body.append(element);
    });
    await fillForm(page);
  }
});

for (const path of ["/blocked", "/frame-blocked"]) {
  test(`stylesheet-blocked parser ${path}`, async ({ page, browserName }) => {
    test.skip(browserName !== "webkit", "WebKit queue deferral regression");
    releaseStylesheet = undefined;
    await page.goto(`${baseURL}${path}`, { waitUntil: "commit" });
    await expect.poll(() => Boolean(releaseStylesheet)).toBe(true);
    const username =
      path === "/blocked"
        ? page.getByLabel("Username")
        : page.frameLocator("iframe").getByLabel("Username");
    await expect(username).toBeAttached();
    // Hold the TOP parser on the server side. WebKit may also suspend this
    // document's rAF callbacks while the stylesheet is pending.
    await new Promise((resolve) => setTimeout(resolve, 100));
    await expect(username).toBeHidden();
    // Author changes must not reveal a queued candidate before the flush.
    await username.evaluate((element) => {
      element.style.setProperty("display", "inline-block", "important");
      element.style.setProperty("visibility", "visible", "important");
      element.style.setProperty("color", "red");
    });
    await expect(username).toBeHidden();
    releaseStylesheet!();
    releaseStylesheet = undefined;
    await page.waitForLoadState("load");
    await expect(username).toBeVisible();
    await expect(username).not.toBeFocused();
    expect(await username.evaluate((element) => element.style.display)).toBe(
      "inline-block",
    );
    await username.fill("alice");
    const password =
      path === "/blocked"
        ? page.getByLabel("Password")
        : page.frameLocator("iframe").getByLabel("Password");
    await password.fill("secret");
    await expect(username).toHaveValue("alice");
    await expect(password).toHaveValue("secret");
  });
}

test("detached candidate reinserted without autofocus while parser is blocked", async ({
  page,
  browserName,
}) => {
  test.skip(
    browserName !== "webkit",
    "WebKit retains queued candidates during parser blocking",
  );
  await page.goto(`${baseURL}/empty-blocked`, { waitUntil: "commit" });
  await expect.poll(() => Boolean(releaseStylesheet)).toBe(true);
  await page.evaluate(() => {
    const wrapper = document.createElement("form");
    wrapper.innerHTML = '<input id="candidate" autofocus>';
    document.body.append(wrapper);
    wrapper.querySelector("input")!.removeAttribute("autofocus");
    wrapper.remove();
    (window as unknown as { detachedForm: HTMLFormElement }).detachedForm =
      wrapper;
  });
  // The observer has seen the removal while the candidate was disconnected.
  await page.evaluate(() =>
    document.body.append(
      (window as unknown as { detachedForm: HTMLFormElement }).detachedForm,
    ),
  );
  await expect(page.locator("#candidate")).toBeAttached();
  await expect(page.locator("#candidate")).toBeHidden();
  releaseStylesheet!();
  releaseStylesheet = undefined;
  await page.waitForLoadState("load");
  await expect(page.locator("#candidate")).toBeVisible();
  await expect(page.locator("#candidate")).not.toBeFocused();
  await page.locator("#candidate").fill("right field");
  await expect(page.locator("#candidate")).toHaveValue("right field");
});

test("normal fill semantics, authored styles and application focus", async ({
  page,
}) => {
  await page.goto(`${baseURL}/empty`);
  await page.evaluate(() => {
    document.body.innerHTML = `<input autofocus style="display:inline-block!important;color:red" id="text" value="old">
      <textarea id="area"></textarea><div id="editor" contenteditable></div>
      <input type="number" id="number"><input disabled id="disabled"><input readonly id="readonly">`;
    (window as unknown as { inputEvents: string[] }).inputEvents = [];
    document.querySelector("#text")!.addEventListener("input", (event) => {
      (window as unknown as { inputEvents: string[] }).inputEvents.push(
        `${event.isTrusted}:${(event.target as HTMLInputElement).value}`,
      );
    });
  });
  await page.locator("#text").fill("replacement");
  await expect(page.locator("#text")).toHaveValue("replacement");
  expect(
    await page.locator("#text").evaluate((element) => ({
      display: element.style.display,
      priority: element.style.getPropertyPriority("display"),
      color: element.style.color,
    })),
  ).toEqual({ display: "inline-block", priority: "important", color: "red" });
  expect(
    await page.evaluate(
      () => (window as unknown as { inputEvents: string[] }).inputEvents,
    ),
  ).toEqual(["true:replacement"]);
  await page.locator("#area").fill("two\nlines");
  await expect(page.locator("#area")).toHaveValue("two\nlines");
  await page.locator("#editor").fill("editable");
  await expect(page.locator("#editor")).toHaveText("editable");
  await page.locator("#number").fill("42");
  await expect(page.locator("#number")).toHaveValue("42");
  await expect(
    page.locator("#disabled").fill("no", { timeout: 200 }),
  ).rejects.toThrow();
  await expect(
    page.locator("#readonly").fill("no", { timeout: 200 }),
  ).rejects.toThrow();
  await page.locator("#text").fill("");
  await expect(page.locator("#text")).toHaveValue("");
  await page.locator("#text").evaluate((element) => element.focus());
  await expect(page.locator("#text")).toBeFocused();
  await page.locator("#area").click();
  await expect(page.locator("#area")).toBeFocused();
});

test("controlled application focus stealing remains observable", async ({
  page,
  browserName,
}) => {
  test.skip(
    browserName !== "webkit",
    "The supplied controlled WebKit reproduction",
  );
  await page.goto(`${baseURL}/controlled`);
  await page.getByLabel("Username").fill("alice");
  await page.getByLabel("Password").fill("secret");
  await expect(page.getByLabel("Username")).toHaveValue("alicesecret");
  await expect(page.getByLabel("Password")).toHaveValue("");
});

test.describe("native autofocus opt-out", () => {
  test.use({ webkitAutofocusWorkaround: false });
  test("preserves native autofocus", async ({ page }) => {
    await page.goto(`${baseURL}/native`);
    await expect(page.getByLabel("Username")).toBeFocused();
    expect(await page.getByLabel("Username").getAttribute("style")).toBeNull();
  });

  test("attribute removal does not cancel a queued native candidate", async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== "webkit", "Investigated WebKit mechanism");
    await page.goto(`${baseURL}/empty`);
    await page.evaluate(() => {
      const input = document.createElement("input");
      input.id = "candidate";
      input.autofocus = true;
      document.body.append(input);
      input.removeAttribute("autofocus");
    });
    await expect(page.locator("#candidate")).toBeFocused();
    await expect(page.locator("#candidate")).not.toHaveAttribute("autofocus");
  });
});

test("setContent and navigation through a link", async ({
  page,
  browserName,
}) => {
  await page.goto(`${baseURL}/empty`);
  await page.setContent(html);
  await expect(page.getByLabel("Username")).toBeVisible();
  if (browserName === "webkit")
    await expect(page.getByLabel("Username")).not.toBeFocused();
  await fillForm(page);
  await page.evaluate((url) => {
    const link = document.createElement("a");
    link.href = url;
    link.textContent = "Login";
    document.body.append(link);
  }, `${baseURL}/native`);
  await page.getByRole("link", { name: "Login" }).click();
  await fillForm(page);
});

test("cross-origin frame keeps browser-native restrictions", async ({
  page,
  browserName,
}) => {
  test.skip(
    browserName !== "webkit",
    "WebKit blocks cross-origin document autofocus",
  );
  await page.goto(`${baseURL}/empty`);
  await page.evaluate(
    (url) => {
      const iframe = document.createElement("iframe");
      iframe.src = url;
      document.body.append(iframe);
    },
    `${baseURL.replace("127.0.0.1", "localhost")}/native`,
  );
  const username = page.frameLocator("iframe").getByLabel("Username");
  await expect(username).toBeVisible();
  await expect(username).not.toBeFocused();
  expect(await username.getAttribute("style")).toBeNull();
  await username.fill("alice");
  await expect(username).toHaveValue("alice");
});
