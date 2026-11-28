import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import {
  drushPlaywrightCommand,
  findDdevProjectRoot,
  resolveDrushPlaywrightBin,
} from "./project-paths";

let project: string;

beforeEach(() => {
  project = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), "project-paths-test-")),
  );
  fs.mkdirSync(path.join(project, ".ddev"));
});

afterEach(() => {
  fs.rmSync(project, { recursive: true, force: true });
});

/** Create a suite at the given folder with the package installed in it. */
function installSuite(suite: string): string {
  const pkg = path.join(
    project,
    suite,
    "node_modules/@lullabot/playwright-drupal",
  );
  fs.mkdirSync(path.join(pkg, "bin"), { recursive: true });
  fs.mkdirSync(path.join(pkg, "lib/testcase"), { recursive: true });
  fs.writeFileSync(path.join(pkg, "bin/drush-playwright"), "");
  fs.mkdirSync(
    path.join(project, suite, "packages/playwright-drupal/testcase"),
    {
      recursive: true,
    },
  );
  return pkg;
}

describe("resolveDrushPlaywrightBin", () => {
  it.each(["test/playwright", "tests/e2e"])(
    "finds the binary from the package's lib directory in %s",
    (suite) => {
      const pkg = installSuite(suite);
      expect(resolveDrushPlaywrightBin(path.join(pkg, "lib/testcase"))).toBe(
        path.join(pkg, "bin/drush-playwright"),
      );
    },
  );

  it.each(["test/playwright", "tests/e2e"])(
    "finds the binary from the packages/ copy in %s",
    (suite) => {
      const pkg = installSuite(suite);
      const copy = path.join(
        project,
        suite,
        "packages/playwright-drupal/testcase",
      );
      expect(resolveDrushPlaywrightBin(copy)).toBe(
        path.join(pkg, "bin/drush-playwright"),
      );
    },
  );

  it("throws when the binary is nowhere above", () => {
    expect(() => resolveDrushPlaywrightBin(project)).toThrow(
      /Could not find bin\/drush-playwright/,
    );
  });
});

describe("findDdevProjectRoot", () => {
  it("returns the closest directory with a .ddev folder", () => {
    const pkg = installSuite("tests/e2e");
    expect(findDdevProjectRoot(pkg)).toBe(project);
  });
});

describe("drushPlaywrightCommand", () => {
  it("uses the absolute path inside the web container", () => {
    const pkg = installSuite("tests/e2e");
    expect(
      drushPlaywrightCommand(42, path.join(pkg, "lib/testcase"), true),
    ).toBe(`${path.join(pkg, "bin/drush-playwright")} 42`);
  });

  it("uses a project-relative path through ddev exec from the host", () => {
    const pkg = installSuite("tests/e2e");
    expect(
      drushPlaywrightCommand(42, path.join(pkg, "lib/testcase"), false),
    ).toBe(
      "ddev exec ./tests/e2e/node_modules/@lullabot/playwright-drupal/bin/drush-playwright 42",
    );
  });
});
