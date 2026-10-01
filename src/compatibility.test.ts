import { describe, expect, it } from "vitest";
import * as generic from "@lullabot/playwright-testing";
import { spawnSync } from "node:child_process";
import path from "node:path";

import { blurActiveElement } from "./util/focus";
import { defineAccessibilityBaseline } from "./util/accessibility-baseline";
import { YoutubeMock } from "./util/mock/youtube";
import {
  FAILURE_MARKER_PREFIX,
  FLAKE_MARKER_PREFIX,
  generateComment,
} from "./github/failure-summary";

describe("legacy package compatibility", () => {
  it("re-exports neutral generic APIs instead of owning copies", () => {
    expect(blurActiveElement).toBe(generic.blurActiveElement);
    expect(defineAccessibilityBaseline).toBe(
      generic.defineAccessibilityBaseline,
    );
    expect(YoutubeMock).toBe(generic.YoutubeMock);
  });

  it("keeps Drupal-branded failure markers", () => {
    const comment = generateComment({
      tests: [],
      totalFailed: 2,
      totalFlaky: 1,
      totalImages: 0,
    });

    expect(FAILURE_MARKER_PREFIX).toBe("<!-- playwright-drupal-failures: ");
    expect(FLAKE_MARKER_PREFIX).toBe("<!-- playwright-drupal-flakes: ");
    expect(comment).toContain("<!-- playwright-drupal-failures: 2 -->");
    expect(comment).toContain("<!-- playwright-drupal-flakes: 1 -->");
    expect(comment).not.toContain("playwright-testing-failures");
  });

  it.each([
    ["a11y", "playwright-drupal-a11y-summary"],
    ["failure", "playwright-drupal-failure-summary"],
  ])(
    "runs the %s summary CLI when its module is executed directly",
    (moduleName, commandName) => {
      const result = spawnSync(
        process.execPath,
        [
          "--import",
          "tsx",
          path.resolve(__dirname, "github", `${moduleName}-summary.ts`),
          "--help",
        ],
        { encoding: "utf8" },
      );

      expect(result.status, result.stderr).toBe(0);
      expect(result.stdout).toContain(`Usage: ${commandName}`);
    },
  );
});
