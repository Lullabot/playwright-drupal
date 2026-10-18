import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
// Outside the checkout: neither workspaces nor ancestor node_modules can help.
const project = mkdtempSync(path.join(tmpdir(), "playwright-consumer-"));
const env = {
  ...process.env,
  NODE_PATH: "",
  PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: "1",
  YARN_ENABLE_IMMUTABLE_INSTALLS: "false",
  YARN_ENABLE_GLOBAL_CACHE: "false",
};
function run(command, args, cwd = project) {
  return execFileSync(command, args, { cwd, env, stdio: "inherit" });
}
function yarn(...args) {
  run("corepack", ["yarn", ...args]);
}
function write(name, value) {
  writeFileSync(path.join(project, name), value);
}
try {
  // Pack BOTH current packages and check Drupal’s transitive generic-helper edge.
  run("npm", ["pack", "--pack-destination", project], root);
  run(
    "npm",
    [
      "pack",
      "--workspace=@lullabot/playwright-testing",
      "--pack-destination",
      project,
    ],
    root,
  );
  const dependencies = {};
  for (const name of ["playwright-drupal", "playwright-testing"]) {
    const source =
      name === "playwright-drupal" ? root : path.join(root, "packages", name);
    const manifest = JSON.parse(
      readFileSync(path.join(source, "package.json")),
    );
    dependencies[manifest.name] =
      `file:./lullabot-${name}-${manifest.version}.tgz`;
  }
  // Yarn treats a registry locator and a file locator as different packages.
  // Point ONLY Drupal's generic-helper edge at the packed artifact too, so no
  // published helper can slip into this test. Playwright metadata is untouched;
  // no resolutions or deduplication are used.
  const staging = path.join(project, "staging");
  mkdirSync(staging);
  const drupalArchive = dependencies["@lullabot/playwright-drupal"].slice(7);
  run("tar", ["-xzf", path.join(project, drupalArchive), "-C", staging]);
  const packedManifestPath = path.join(staging, "package/package.json");
  const packedManifest = JSON.parse(readFileSync(packedManifestPath));
  packedManifest.dependencies["@lullabot/playwright-testing"] =
    `file:${path.join(project, dependencies["@lullabot/playwright-testing"].slice(7))}`;
  writeFileSync(packedManifestPath, JSON.stringify(packedManifest, null, 2));
  run("tar", [
    "-czf",
    path.join(project, drupalArchive),
    "-C",
    staging,
    "package",
  ]);
  rmSync(staging, { recursive: true });
  dependencies["@lullabot/playwright-testing"] =
    packedManifest.dependencies["@lullabot/playwright-testing"];
  write(
    "package.json",
    JSON.stringify(
      {
        name: "packed-consumer",
        private: true,
        packageManager: "yarn@4.18.1",
        devDependencies: {
          ...dependencies,
          "@playwright/test": "1.50.0",
          "playwright-core": "1.50.0",
        },
      },
      null,
      2,
    ),
  );
  write(".yarnrc.yml", "nodeLinker: node-modules\nenableGlobalCache: false\n");
  write(
    "check.cjs",
    `
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const fs = require('node:fs');
const path = require('node:path');
const consumer = require.resolve('@playwright/test');
for (const name of ['@lullabot/playwright-drupal', '@lullabot/playwright-testing']) {
  const entry = require.resolve(name);
  assert.ok(fs.realpathSync(entry).startsWith(process.cwd() + path.sep));
  const helper = createRequire(entry);
  const manifest = helper('./../package.json');
  assert.equal(manifest.dependencies?.['@playwright/test'], undefined);
  assert.equal(manifest.peerDependencies['@playwright/test'], '^1.50.0');
  assert.notEqual(manifest.peerDependenciesMeta?.['@playwright/test']?.optional, true);
  assert.equal(helper.resolve('@playwright/test'), consumer, name);
  assert.equal(helper('@playwright/test'), require('@playwright/test'), name);
  if (name.endsWith('drupal')) {
    const transitiveEntry = helper.resolve('@lullabot/playwright-testing');
    const directEntry = require.resolve('@lullabot/playwright-testing');
    const transitive = createRequire(transitiveEntry);
    // File locators can produce separate helper copies in Yarn; both must be
    // our artifact, and both must inherit the consumer's exact runner.
    assert.equal(fs.readFileSync(path.join(path.dirname(transitiveEntry), '../package.json'), 'utf8'), fs.readFileSync(path.join(path.dirname(directEntry), '../package.json'), 'utf8'));
    assert.equal(fs.readFileSync(transitiveEntry, 'utf8'), fs.readFileSync(directEntry, 'utf8'));
    assert.equal(transitive.resolve('@playwright/test'), consumer);
    assert.equal(transitive('@playwright/test'), require('@playwright/test'));
  }
}
assert.equal(require('@playwright/test/package.json').version, process.argv[2]);
assert.equal(require('playwright-core/package.json').version, process.argv[2]);
`,
  );
  write(
    "playwright.config.cjs",
    `module.exports = { testMatch: 'shared.spec.cjs', workers: 1, reporter: 'list' };\n`,
  );
  // Import the actual runtime barrels. The Drupal test does not request page or
  // context, so its database/browser fixtures never start.
  write(
    "shared.spec.cjs",
    `
const { test: consumerTest, expect } = require('@playwright/test');
const drupal = require('@lullabot/playwright-drupal');
const generic = require('@lullabot/playwright-testing');
consumerTest('generic helper uses consumer runner', async () => {
  expect(drupal.expect).toBe(expect);
  expect(drupal.takeAccessibleScreenshot).toBeInstanceOf(Function);
  expect(generic.takeAccessibleScreenshot).toBeInstanceOf(Function);
  generic.validateInteractionStates([]);
});
drupal.test('Drupal fixture registers with consumer runner', async ({}, info) => {
  expect(consumerTest.info()).toBe(info);
  expect(drupal.openAllDetails).toBeInstanceOf(Function);
});
`,
  );
  function check(version) {
    run(process.execPath, ["check.cjs", version]);
    yarn("playwright", "test");
  }
  yarn("install");
  check("1.50.0");
  // Establish the reported old consumer manifest AND lockfile before upgrading.
  yarn("up", "@playwright/test@1.63.0", "playwright-core@1.63.0");
  assert.match(
    readFileSync(path.join(project, "yarn.lock"), "utf8"),
    /version: 1\.63\.0/,
  );
  check("1.63.0");
  yarn("up", "@playwright/test@^1.64.1", "playwright-core@^1.64.1");
  const installed = JSON.parse(
    readFileSync(
      path.join(project, "node_modules/@playwright/test/package.json"),
    ),
  ).version;
  assert.notEqual(installed, "1.63.0");
  check(installed);
  // Follow the current stable release as well as the pinned reproducer.
  yarn("up", "@playwright/test@latest", "playwright-core@latest");
  const latest = JSON.parse(
    readFileSync(
      path.join(project, "node_modules/@playwright/test/package.json"),
    ),
  ).version;
  check(latest);
} finally {
  rmSync(project, { recursive: true, force: true });
}
