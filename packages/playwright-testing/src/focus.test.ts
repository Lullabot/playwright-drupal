import { afterEach, describe, expect, it, vi } from "vitest";
import { blurActiveElement } from "./focus";

describe("blurActiveElement", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("blurs a genuinely focused element", async () => {
    const activeElement = { blur: vi.fn() };
    const document = { activeElement, body: {}, documentElement: {} };
    const page = {
      evaluate: vi.fn((callback: () => boolean) => {
        vi.stubGlobal("document", document);
        return callback();
      }),
    };

    await expect(blurActiveElement(page as never)).resolves.toBe(true);
    expect(activeElement.blur).toHaveBeenCalledOnce();
  });

  it("does not blur the document body fallback", async () => {
    const body = { blur: vi.fn() };
    const document = { activeElement: body, body, documentElement: {} };
    const page = {
      evaluate: vi.fn((callback: () => boolean) => {
        vi.stubGlobal("document", document);
        return callback();
      }),
    };

    await expect(blurActiveElement(page as never)).resolves.toBe(false);
    expect(body.blur).not.toHaveBeenCalled();
  });
});
