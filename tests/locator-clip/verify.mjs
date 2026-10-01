import { spawnSync } from "node:child_process";
import { stripVTControlCharacters } from "node:util";

// Run after installing browsers. Mutation runs must fail specifically on the
// visual assertions, rather than merely failing to launch or scan the page.
for (const mutation of ["", "content", "layout"]) {
  const args = [
    "playwright",
    "test",
    "-c",
    "tests/locator-clip/playwright.config.ts",
    "--reporter=json",
  ];
  if (mutation) args.push("--grep", "derived clip");
  const result = spawnSync("npx", args, {
    encoding: "utf8",
    env: { ...process.env, CLIP_MUTATION: mutation },
    maxBuffer: 10 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  const report = JSON.parse(result.stdout);
  const tests = [];
  function collect(suites) {
    for (const suite of suites) {
      for (const spec of suite.specs ?? []) tests.push(...spec.tests);
      collect(suite.suites ?? []);
    }
  }
  collect(report.suites);
  const expectedCount = mutation ? 6 : 18;
  const valid =
    tests.length === expectedCount &&
    (mutation
      ? result.status === 1 &&
        tests.every((t) =>
          t.results.some((r) =>
            r.errors.some((e) =>
              stripVTControlCharacters(e.message).includes(
                "toHaveScreenshot(expected) failed",
              ),
            ),
          ),
        )
      : result.status === 0 && tests.every((t) => t.status === "expected"));
  if (!valid) {
    process.stderr.write(result.stderr);
    process.stderr.write(result.stdout);
    process.exit(1);
  }
  console.log(
    mutation
      ? `${mutation}: all 6 visual comparisons failed as intended`
      : "all 18 browser checks passed",
  );
}
