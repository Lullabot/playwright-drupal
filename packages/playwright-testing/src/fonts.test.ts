import { describe, expect, it, vi } from "vitest";
import { waitForFonts } from "./fonts";

describe("waitForFonts", () => {
  it("waits for the browser font set to become ready", async () => {
    const evaluate = vi.fn(async (callback: () => Promise<void>) => {
      const ready = Promise.resolve();
      vi.stubGlobal("document", { fonts: { ready } });
      await callback();
    });

    await waitForFonts({ evaluate } as never);

    expect(evaluate).toHaveBeenCalledOnce();
    vi.unstubAllGlobals();
  });
});
