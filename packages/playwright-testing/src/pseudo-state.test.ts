import { describe, expect, it, vi } from "vitest";
import { forcePseudoState } from "./pseudo-state";

function fakePage(nodeId = 2) {
  const session = {
    send: vi.fn(async (method: string) => {
      if (method === "DOM.getDocument") {
        return { root: { nodeId: 1 } };
      }
      if (method === "DOM.querySelector") {
        return { nodeId };
      }
      return {};
    }),
    detach: vi.fn().mockResolvedValue(undefined),
  };
  const context = {
    newCDPSession: vi.fn().mockResolvedValue(session),
  };
  const page = {
    context: vi.fn(() => context),
  };

  return { context, page, session };
}

describe("forcePseudoState", () => {
  it("forces pseudo-classes on the first selector match and clears them", async () => {
    const { context, page, session } = fakePage();

    const cleanup = await forcePseudoState(page as any, ".menu-trigger", [
      "hover",
      "focus-visible",
    ]);

    expect(context.newCDPSession).toHaveBeenCalledWith(page);
    expect(session.send).toHaveBeenNthCalledWith(1, "DOM.enable");
    expect(session.send).toHaveBeenNthCalledWith(2, "CSS.enable");
    expect(session.send).toHaveBeenNthCalledWith(3, "DOM.getDocument");
    expect(session.send).toHaveBeenNthCalledWith(4, "DOM.querySelector", {
      nodeId: 1,
      selector: ".menu-trigger",
    });
    expect(session.send).toHaveBeenNthCalledWith(5, "CSS.forcePseudoState", {
      nodeId: 2,
      forcedPseudoClasses: ["hover", "focus-visible"],
    });

    await cleanup();
    await cleanup();

    expect(session.send).toHaveBeenNthCalledWith(6, "CSS.forcePseudoState", {
      nodeId: 2,
      forcedPseudoClasses: [],
    });
    expect(session.detach).toHaveBeenCalledOnce();
  });

  it("fails clearly and detaches when the selector does not match", async () => {
    const { page, session } = fakePage(0);

    await expect(
      forcePseudoState(page as any, ".missing", ["hover"]),
    ).rejects.toThrow('could not find an element matching ".missing"');
    expect(session.detach).toHaveBeenCalledOnce();
  });

  it("reports that CDP requires Chromium", async () => {
    const page = {
      context: () => ({
        newCDPSession: vi
          .fn()
          .mockRejectedValue(new Error("CDP only supported in Chromium")),
      }),
    };

    await expect(
      forcePseudoState(page as any, "button", ["focus"]),
    ).rejects.toThrow("requires a Chromium browser project");
  });

  it("detaches even when clearing the state fails", async () => {
    const { page, session } = fakePage();
    const cleanup = await forcePseudoState(page as any, "button", ["focus"]);
    session.send.mockRejectedValueOnce(new Error("node disappeared"));

    await expect(cleanup()).rejects.toThrow("node disappeared");
    expect(session.detach).toHaveBeenCalledOnce();
  });
});
