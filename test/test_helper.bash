#!/usr/bin/env bash

# test_helper.bash — Helper functions for bats integration tests.
# These functions implement the full README workflow for setting up a DDEV
# Drupal project, installing playwright-drupal, and running Playwright tests.

setup_drupal_project() {
  local docroot="${1:-web}"

  # Create a temporary directory for the Drupal project.
  # Use the pwtest- prefix so the CI artifact upload glob matches.
  mkdir -p tmp
  PROJECT_DIR="$(mktemp -d ./tmp/pwtest-XXXXXXXXXX)"

  # Generate a randomized project name to avoid collisions.
  PROJECT_NAME="pwtest-$(LC_ALL=C tr -dc 'a-z0-9' < /dev/urandom | head -c 4)"

  # Persist these values so other functions and tests can access them.
  echo "$PROJECT_DIR" > "$BATS_FILE_TMPDIR/project_dir"
  echo "$PROJECT_NAME" > "$BATS_FILE_TMPDIR/project_name"

  export PROJECT_DIR PROJECT_NAME

  cd "$PROJECT_DIR"

  # Follow the README steps: Create the Drupal Site and Initialize DDEV.
  # Each command's output is written to FD 3 (bats' real-time log channel)
  # so progress is visible in CI logs as each sub-step runs.
  echo "--- ddev config" >&3
  ddev config --project-type=drupal11 --docroot="$docroot" --project-name="$PROJECT_NAME" >&3 2>&3

  # In the Copilot agent sandbox, Docker may inject host CA certificates into
  # containers via a bind mount on /etc/ssl/certs with mode 0700 root:root.
  # This prevents the non-root web-container user from writing there, and
  # ddev's /start.sh (which calls mkcert) crashes.  Only apply these
  # workarounds when running inside the Copilot agent sandbox.
  if [[ -n "${COPILOT_AGENT_CALLBACK_URL:-}" ]]; then
    mkdir -p .ddev/web-build
    cat > .ddev/web-build/Dockerfile <<'DOCKERFILE'
RUN mv /start.sh /start-original.sh && \
    printf '#!/bin/bash\nsudo chown "$(id -u)" /etc/ssl/certs 2>/dev/null || true\nexec /start-original.sh "$@"\n' > /start.sh && \
    chmod +x /start.sh
DOCKERFILE

    if [[ -n "${NODE_EXTRA_CA_CERTS:-}" && -f "${NODE_EXTRA_CA_CERTS}" ]]; then
      cp "$NODE_EXTRA_CA_CERTS" .ddev/web-build/custom-ca.crt
      # The sandbox's Docker daemon injects NODE_EXTRA_CA_CERTS pointing to
      # /etc/ssl/certs/ca-certificates.crt and re-mounts /etc/ssl/certs with
      # mode 0700 on every build RUN step, making it unreadable by non-root
      # users.  Since the ddev-playwright Dockerfile runs `sudo -u $username
      # npx playwright install`, Node.js can't read the cert bundle and
      # browser downloads fail with SELF_SIGNED_CERT_IN_CHAIN.
      #
      # Work around this by:
      # 1. Installing the custom CA into the system trust store.
      # 2. Copying the resulting bundle to a world-readable path.
      # 3. Wrapping sudo to point NODE_EXTRA_CA_CERTS at the readable copy.
      cat >> .ddev/web-build/Dockerfile <<'DOCKERFILE'
COPY custom-ca.crt /usr/local/share/ca-certificates/custom-ca.crt
RUN chmod 755 /etc/ssl/certs && \
    update-ca-certificates && \
    cp /etc/ssl/certs/ca-certificates.crt /etc/ssl/ca-bundle-with-custom.crt && \
    chmod 644 /etc/ssl/ca-bundle-with-custom.crt && \
    mv /usr/bin/sudo /usr/bin/sudo.orig && \
    printf '#!/bin/bash\nexec /usr/bin/sudo.orig NODE_EXTRA_CA_CERTS=/etc/ssl/ca-bundle-with-custom.crt "$@"\n' > /usr/bin/sudo && \
    chmod +x /usr/bin/sudo
DOCKERFILE
    fi
  fi

  # In CI, skip containers that aren't needed to reduce startup time.
  if [[ -n "${CI:-}" ]]; then
    ddev config global --omit-containers=ddev-ssh-agent >&3 2>&3
  fi

  echo "--- ddev start" >&3
  ddev start >&3 2>&3
  # Pin Drupal core to the 11.3.x line. Drupal 11.4.0 (2026-07-01) moved
  # Drupal\Core\Recipe\RecipeCommand to Drupal\Core\Recipe\Command\RecipeCommand
  # and renamed the CLI command from `recipe` to `recipe:apply`. Drush still gates
  # `drush recipe` on the old class name in ServiceManager::instantiateDrupalCoreBootstrappedCommands(),
  # so on 11.4 the command is silently dropped and recipe.spec.ts fails with
  # "Command recipe is not defined". No fixed Drush release exists yet (13.7.4 and
  # the 13.x/14.x tips are all affected), so pin core until Drush supports the
  # Drupal 11.4 recipe command. Create from the 11.3 project template so every
  # core-* constraint stays ^11.3, letting `require --update-with-all-dependencies`
  # resolve the whole graph down to 11.3.x without conflicts.
  # Refs: https://www.drupal.org/node/3453474
  #       https://github.com/drush-ops/drush/blob/13.x/src/Runtime/ServiceManager.php
  echo "--- ddev composer create-project drupal/recommended-project (pinned to 11.3.x)" >&3
  ddev composer create-project 'drupal/recommended-project:~11.3.0' >&3 2>&3
  echo "--- ddev composer require drush/drush + pin drupal/core-recommended to 11.3.x" >&3
  ddev composer require drush/drush 'drupal/core-recommended:~11.3.0' --update-with-all-dependencies >&3 2>&3

  # If using a non-default docroot, rewrite composer.json and rename the
  # web directory so DDEV and Drupal use the custom docroot.
  if [[ "$docroot" != "web" ]]; then
    echo "--- Changing docroot from web to $docroot" >&3
    # Use node to rewrite composer.json since jq may not be on the host.
    ddev exec node -e "
      const fs = require('fs');
      let c = JSON.parse(fs.readFileSync('composer.json', 'utf8'));
      // Update drupal-scaffold web-root
      c.extra['drupal-scaffold'].locations['web-root'] = '${docroot}/';
      // Update installer-paths: replace 'web/' prefix with new docroot
      const newPaths = {};
      for (const [key, val] of Object.entries(c.extra['installer-paths'])) {
        newPaths[key.replace(/^web\//, '${docroot}/')] = val;
      }
      c.extra['installer-paths'] = newPaths;
      // Update autoload paths (classmap and files) that reference web/
      if (c.autoload) {
        for (const key of ['classmap', 'files']) {
          if (Array.isArray(c.autoload[key])) {
            c.autoload[key] = c.autoload[key].map(p => p.replace(/^web\//, '${docroot}/'));
          }
        }
      }
      fs.writeFileSync('composer.json', JSON.stringify(c, null, 4) + '\n');
    " >&3 2>&3
    # Rename the directory
    ddev exec mv web "$docroot" >&3 2>&3
    # Re-run composer install so Composer recalculates package install paths
    # (installed.json) and regenerates the autoloader for the new docroot.
    echo "--- ddev composer install (recalculate paths)" >&3
    ddev composer install --no-progress >&3 2>&3
    # Restart DDEV to pick up the new docroot
    echo "--- ddev restart (docroot change)" >&3
    ddev restart >&3 2>&3
  fi

  # Install the ddev-playwright add-on. No restart here: `ddev install-playwright`
  # below enables Dockerfile.playwright and does its own rebuild + restart, which
  # picks up the add-on's Dockerfile.task and Dockerfile.uv in the same pass.
  # Restarting now just pays for an extra container/router cycle, and its
  # pre-start hook would copy a test/playwright directory that doesn't exist yet.
  #
  # Set DDEV_PLAYWRIGHT_ADDON to a local checkout to validate an unreleased
  # add-on change against this suite.
  local addon="${DDEV_PLAYWRIGHT_ADDON:-Lullabot/ddev-playwright}"
  echo "--- ddev add-on get $addon" >&3
  ddev add-on get "$addon" >&3 2>&3

  # Initialize Playwright tests.
  mkdir -p test/playwright
  echo "--- npx create-playwright" >&3
  ddev exec -- npx create-playwright@latest --lang=TypeScript --quiet test/playwright --no-browsers >&3 2>&3

  PROJECT_DIR="$(cat "$BATS_FILE_TMPDIR/project_dir")"

  # Return to the repo root so that the relative PROJECT_DIR path resolves
  # correctly regardless of whether we build the tarball or use a pre-built one.
  cd "$REPO_ROOT"

  # Use a pre-built tarball if available (set by CI), otherwise build one.
  if [[ -n "${PLAYWRIGHT_DRUPAL_TARBALL:-}" && -f "$PLAYWRIGHT_DRUPAL_TARBALL" ]]; then
    echo "--- Using pre-built tarball: $PLAYWRIGHT_DRUPAL_TARBALL" >&3
    TARBALL_PATH="$PLAYWRIGHT_DRUPAL_TARBALL"
  else
    # Run npm pack from the repo root (on the host) to create a tarball.
    # npm install is needed first because prepack runs "npm run build" (tsc),
    # which requires @playwright/test and typescript to be installed.
    cd "$REPO_ROOT"
    echo "--- npm install (repo root)" >&3
    npm install >&3 2>&3
    echo "--- npm pack" >&3
    npm pack >&3 2>&3

    # Find the generated tarball.
    TARBALL_PATH="$REPO_ROOT/$(ls -t lullabot-playwright-drupal-*.tgz | head -n 1)"
  fi

  TARBALL="$(basename "$TARBALL_PATH")"

  # Copy the tarball into test/playwright, which is bind-mounted under
  # /var/www/html inside the DDEV container.
  #
  # It has to live here rather than at the project root. npm records a local
  # tarball as a "file:" dependency relative to the package directory, and
  # ddev-playwright's pre-start hook stages only test/playwright's dependency
  # manifests (plus any *.tgz alongside them) into the web image build context.
  # From the project root the recorded path would be
  # "file:../../lullabot-playwright-drupal-x.y.z.tgz", which resolves outside
  # the staged directory, so the build's npm install would fail with ENOENT.
  cp "$TARBALL_PATH" "$PROJECT_DIR/test/playwright/"
  echo "--- Waiting for mutagen..." >&3
  # On macOS with mutagen enabled, sync so the tarball is visible inside the
  # container immediately. On Linux (no mutagen), this is a no-op.
  ddev mutagen sync 2>/dev/null || true

  # Install the tarball inside the DDEV container. Passing the bare filename
  # makes npm record "file:<tarball>", relative to test/playwright.
  cd "$PROJECT_DIR"
  echo "--- npm install @lullabot/playwright-drupal" >&3
  ddev exec -d /var/www/html/test/playwright npm install "./$TARBALL" >&3 2>&3

  # Clean up the tarball from the repo root (only if we built it).
  if [[ -z "${PLAYWRIGHT_DRUPAL_TARBALL:-}" ]]; then
    rm -f "$TARBALL_PATH"
  fi

  # Install Playwright browsers via the DDEV add-on command.
  echo "--- ddev install-playwright" >&3
  ddev install-playwright >&3 2>&3
}

configure_playwright() {
  local docroot="${1:-web}"

  PROJECT_DIR="$(cat "$BATS_FILE_TMPDIR/project_dir")"

  cd "$PROJECT_DIR"

  # Write tsconfig.json per the README.
  cat > test/playwright/tsconfig.json << 'EOF'
{
  "compilerOptions": {
    "noEmit": true,
    "baseUrl": ".",
    "paths": {
      "~": ["./src"],
      "~*": ["./src/*"],
      "@packages/playwright-drupal": ["./packages/playwright-drupal"]
    }
  },
  "include": [
    "tests/**/*.ts"
  ]
}
EOF

  # Write playwright.config.ts using definePlaywrightDrupalConfig() helper.
  # Import from '@lullabot/playwright-drupal/config' (subpath export) to avoid
  # loading the test fixture module which registers test.afterEach() side
  # effects. Test files import from '@packages/playwright-drupal' (source copy),
  # so loading the full compiled package here would cause duplicate registration.
  cat > test/playwright/playwright.config.ts << 'TSEOF'
import { definePlaywrightDrupalConfig } from '@lullabot/playwright-drupal/config';
import { devices } from '@playwright/test';

export default definePlaywrightDrupalConfig({
  testDir: './tests',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  use: {
    ignoreHTTPSErrors: true,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    }
  ],
});
TSEOF

  # Add Playwright settings to Drupal's settings.php.
  # The file may be read-only, so chmod it first.
  chmod 644 "$docroot/sites/default/settings.php"
  echo "include '../test/playwright/node_modules/@lullabot/playwright-drupal/settings/settings.playwright.php';" >> "$docroot/sites/default/settings.php"

  # Create Taskfile.yml in the project root.
  cat > Taskfile.yml << 'EOF'
version: '3'
silent: true
includes:
  playwright:
    taskfile: test/playwright/node_modules/@lullabot/playwright-drupal/tasks/playwright.yml
    optional: true
EOF

  # Ignore the packages directory from git.
  echo '/packages/playwright-drupal' >> test/playwright/.gitignore
}

write_example_test() {
  PROJECT_DIR="$(cat "$BATS_FILE_TMPDIR/project_dir")"

  cd "$PROJECT_DIR"

  # Remove default Playwright example tests from create-playwright.
  rm -f test/playwright/tests/example.spec.ts
  rm -rf test/playwright/tests-examples

  # Write the example Drupal test from the README (lines 143-177).
  cat > test/playwright/tests/example.drupal.spec.ts << 'TESTEOF'
import { test, expect, execDrushInTestSite, login } from '@packages/playwright-drupal';

test('has title', async ({ page }) => {
  await page.goto('/');

  // Expect a title "to contain" a substring.
  await expect(page).toHaveTitle(/Playwright/);
});

// This tests proves parallel databases work by setting a random title for the
// first node created in the site.
test('proves parallel tests work', async ({ page }) => {
  await execDrushInTestSite('user:password admin "correct horse battery staple"');
  await page.goto('/user/login');
  const username = page.getByLabel('Username');
  const password = page.getByLabel('Password');
  const loginButton = page.getByRole('button', { name: 'Log in' });
  await username.fill('admin');
  await password.fill('correct horse battery staple');
  await loginButton.click();
  // A waitForURL or page assertion is needed here; otherwise Playwright's
  // next goto() call won't wait for the form submission to finish before
  // navigating, which can cause the login to be skipped.
  await page.waitForURL(/\/user\//);

  await page.goto('/node/add/article');

  let randomTitle = (Math.random() + 1).toString(36).substring(2);
  await page.getByLabel('Title', { exact: true }).fill(randomTitle);
  await page.getByRole('button', { name: 'Save' }).click();

  // A waitForURL or page assertion is needed here; otherwise Playwright's
  // next goto() or assertion may execute before the form submission finishes.
  // Since we're testing with Umami, upstream changes may change the node ID.
  // If you are creating a test like this on your own site, and the node ID is
  // deterministic, consider hard-coding that node ID instead.
  await expect(page).toHaveURL(/\/node\/\d+(?:\?.*)?$/);

  await expect(page).toHaveTitle(`${randomTitle} | Playwright`);
  await expect(page.locator('h1')).toHaveText(randomTitle);
});

test('login helper works', async ({ page }) => {
  await login(page);
  // Verify we're logged in by checking we can access admin.
  await page.goto('/admin');
  await expect(page).toHaveTitle(/Administration/);
});

test('login helper works with a specific username', async ({ page }) => {
  await login(page, 'admin');
  // Verify we're logged in by checking we can access admin.
  await page.goto('/admin');
  await expect(page).toHaveTitle(/Administration/);
});
TESTEOF
}

run_playwright_tests() {
  PROJECT_DIR="$(cat "$BATS_FILE_TMPDIR/project_dir")"

  cd "$PROJECT_DIR"

  # Run Playwright tests, streaming output to FD 3 for real-time CI log
  # visibility while also saving it for assertions in subsequent tests.
  # FD 3 is bats' real-time output channel, opened by the test runner
  # before each @test, setup(), and teardown() call.
  set +e
  ddev exec -d /var/www/html/test/playwright npx playwright test --repeat-each 2 \
    2>&1 | tee "$BATS_FILE_TMPDIR/playwright_output.txt" >&3
  echo "${PIPESTATUS[0]}" > "$BATS_FILE_TMPDIR/playwright_exit_code"
  set -e
}

write_a11y_check_test() {
  PROJECT_DIR="$(cat "$BATS_FILE_TMPDIR/project_dir")"

  cd "$PROJECT_DIR"

  cat > test/playwright/tests/a11y-check.spec.ts << 'TESTEOF'
import { test, expect, checkAccessibility } from '@packages/playwright-drupal';

test('standalone accessibility check works', async ({ page }, testInfo) => {
  await page.goto('/');
  await checkAccessibility(page, testInfo, { bestPracticeMode: 'off' });
});
TESTEOF
}

run_a11y_update_snapshots() {
  PROJECT_DIR="$(cat "$BATS_FILE_TMPDIR/project_dir")"

  cd "$PROJECT_DIR"

  set +e
  ddev exec -d /var/www/html/test/playwright npx playwright test tests/a11y-check.spec.ts --update-snapshots \
    2>&1 | tee "$BATS_FILE_TMPDIR/a11y_update_output.txt" >&3
  echo "${PIPESTATUS[0]}" > "$BATS_FILE_TMPDIR/a11y_update_exit_code"
  set -e
}

run_a11y_tests() {
  PROJECT_DIR="$(cat "$BATS_FILE_TMPDIR/project_dir")"

  cd "$PROJECT_DIR"

  set +e
  ddev exec -d /var/www/html/test/playwright npx playwright test tests/a11y-check.spec.ts --repeat-each 2 \
    2>&1 | tee "$BATS_FILE_TMPDIR/a11y_output.txt" >&3
  echo "${PIPESTATUS[0]}" > "$BATS_FILE_TMPDIR/a11y_exit_code"

  # Preserve the JSON report outside test-results/ since Playwright cleans
  # that directory at the start of each run.
  if [ -f test/playwright/test-results/results.json ]; then
    cp test/playwright/test-results/results.json test/playwright/a11y-results.json
  fi
  set -e
}

write_a11y_fixture_test() {
  PROJECT_DIR="$(cat "$BATS_FILE_TMPDIR/project_dir")"

  cd "$PROJECT_DIR"

  cat > test/playwright/tests/a11y-fixture.spec.ts << 'TESTEOF'
import { test, expect } from '@packages/playwright-drupal';

test('a11y fixture check works', async ({ page, a11y }) => {
  await page.goto('/');
  await a11y.check({ bestPracticeMode: 'off' });
});
TESTEOF
}

run_a11y_fixture_update_snapshots() {
  PROJECT_DIR="$(cat "$BATS_FILE_TMPDIR/project_dir")"

  cd "$PROJECT_DIR"

  set +e
  ddev exec -d /var/www/html/test/playwright npx playwright test tests/a11y-fixture.spec.ts --update-snapshots \
    2>&1 | tee "$BATS_FILE_TMPDIR/a11y_fixture_update_output.txt" >&3
  echo "${PIPESTATUS[0]}" > "$BATS_FILE_TMPDIR/a11y_fixture_update_exit_code"
  set -e
}

run_a11y_fixture_tests() {
  PROJECT_DIR="$(cat "$BATS_FILE_TMPDIR/project_dir")"

  cd "$PROJECT_DIR"

  set +e
  ddev exec -d /var/www/html/test/playwright npx playwright test tests/a11y-fixture.spec.ts --repeat-each 2 \
    2>&1 | tee "$BATS_FILE_TMPDIR/a11y_fixture_output.txt" >&3
  echo "${PIPESTATUS[0]}" > "$BATS_FILE_TMPDIR/a11y_fixture_exit_code"
  set -e
}

write_a11y_baseline_test() {
  PROJECT_DIR="$(cat "$BATS_FILE_TMPDIR/project_dir")"

  cd "$PROJECT_DIR"

  cat > test/playwright/tests/a11y-baseline.spec.ts << 'TESTEOF'
import { test, expect, checkAccessibility, defineAccessibilityBaseline } from '@packages/playwright-drupal';

const baseline = defineAccessibilityBaseline([
  {
    rule: 'list',
    targets: ['.footer__top ul'],
    reason: 'Umami footer list structure is a known violation',
    willBeFixedIn: 'https://www.drupal.org/project/drupal/issues/0000000',
  },
  {
    rule: 'color-contrast',
    targets: ['.footer a'],
    reason: 'Umami footer link contrast is a known violation',
    willBeFixedIn: 'https://www.drupal.org/project/drupal/issues/0000001',
  },
]);

test('baseline suppresses known Umami violations', async ({ page }, testInfo) => {
  await page.goto('/');
  await checkAccessibility(page, testInfo, {
    bestPracticeMode: 'off',
    baseline,
  });
});
TESTEOF
}

run_a11y_baseline_tests() {
  PROJECT_DIR="$(cat "$BATS_FILE_TMPDIR/project_dir")"

  cd "$PROJECT_DIR"

  set +e
  ddev exec -d /var/www/html/test/playwright npx playwright test tests/a11y-baseline.spec.ts \
    2>&1 | tee "$BATS_FILE_TMPDIR/a11y_baseline_output.txt" >&3
  echo "${PIPESTATUS[0]}" > "$BATS_FILE_TMPDIR/a11y_baseline_exit_code"
  set -e
}

# The failure summary reads the report from outside the container that wrote
# it, so the one attachment kind carrying a file path — the snapshot comparison
# images — is the only kind that can land on the wrong side of that boundary.
# Accessibility screenshots are attached as a body and inlined into the report
# as base64, so they never exercise it. Produce a real failing comparison.
#
# The page is built with setContent() rather than fetched from Drupal: the
# subject here is the path the diff image is written to, and a fixture that
# cannot vary with site content makes the failure deterministic.
write_visual_diff_test() {
  PROJECT_DIR="$(cat "$BATS_FILE_TMPDIR/project_dir")"

  cd "$PROJECT_DIR"

  cat > test/playwright/tests/visual-diff.spec.ts << 'TESTEOF'
import { test, expect } from '@playwright/test';

test('visual comparison fixture', async ({ page }) => {
  const colour = process.env.VISUAL_DIFF_COLOUR ?? 'white';
  await page.setContent(`<body style="margin:0;background:${colour}"><h1>Visual diff fixture</h1></body>`);
  await expect(page).toHaveScreenshot('fixture.png', { maxDiffPixels: 0 });
});
TESTEOF
}

run_visual_diff_baseline() {
  PROJECT_DIR="$(cat "$BATS_FILE_TMPDIR/project_dir")"

  cd "$PROJECT_DIR"

  # Keep this run away from test-results/, which holds the report the workflow
  # picks up, and off the JSON reporter, which would overwrite it.
  set +e
  ddev exec -d /var/www/html/test/playwright \
    npx playwright test tests/visual-diff.spec.ts --project=chromium --update-snapshots \
    --reporter=line --output=test-results-visual \
    2>&1 | tee "$BATS_FILE_TMPDIR/visual_baseline_output.txt" >&3
  echo "${PIPESTATUS[0]}" > "$BATS_FILE_TMPDIR/visual_baseline_exit_code"
  set -e
}

# Fail the comparison against the baseline just written, and keep the report
# out of test-results/: that is where every other suite's report lives, and
# Playwright empties the output directory at the start of each run.
run_visual_diff_tests() {
  PROJECT_DIR="$(cat "$BATS_FILE_TMPDIR/project_dir")"

  cd "$PROJECT_DIR"

  set +e
  ddev exec -d /var/www/html/test/playwright \
    bash -c 'VISUAL_DIFF_COLOUR=red PLAYWRIGHT_JSON_OUTPUT_NAME=visual-diff-results.json \
      npx playwright test tests/visual-diff.spec.ts --project=chromium --reporter=json \
      --output=test-results-visual' \
    > "$BATS_FILE_TMPDIR/visual_diff_output.txt" 2>&1
  echo "$?" > "$BATS_FILE_TMPDIR/visual_diff_exit_code"
  set -e

  # Leave the tree as it was found: a spec that fails by design would fail any
  # later full-suite run.
  rm -f test/playwright/tests/visual-diff.spec.ts
  rm -rf test/playwright/tests/visual-diff.spec.ts-snapshots
}

# Run the failure summary the way a workflow does — on the host, against a
# report whose attachment paths were written inside the container.
run_visual_diff_failure_summary() {
  PROJECT_DIR="$(cat "$BATS_FILE_TMPDIR/project_dir")"

  cd "$PROJECT_DIR"

  local command
  command="test/playwright/node_modules/@lullabot/playwright-drupal/lib/github/failure-summary.js"

  # Point $GITHUB_STEP_SUMMARY at a file of our own. The command writes the
  # summary there whenever it is set, which on a runner it always is — so
  # reading stdout instead would find it empty under CI and full locally, and
  # this run's invented failure would land in the real job summary.
  #
  # That frees stdout, which is where workflow commands have to go, so both
  # streams can be merged into one log and asserted on the same way either way.
  set +e
  env GITHUB_STEP_SUMMARY="$BATS_FILE_TMPDIR/visual_diff_summary.md" \
    node "$command" \
      --report-path=test/playwright/visual-diff-results.json \
      --comment-path="$BATS_FILE_TMPDIR/visual_diff_comment.md" \
      > "$BATS_FILE_TMPDIR/visual_diff_summary_log.txt" 2>&1
  echo "$?" > "$BATS_FILE_TMPDIR/visual_diff_summary_exit_code"
  set -e

  cat "$BATS_FILE_TMPDIR/visual_diff_summary_log.txt" >&3
}

write_recipe_test() {
  PROJECT_DIR="$(cat "$BATS_FILE_TMPDIR/project_dir")"

  cd "$PROJECT_DIR"

  # Create a test recipe that installs the language module. Language provides
  # field type plugins (DefaultLanguageItem) that must be in the container for
  # subsequent commands to work. This catches DRUPAL_DEV_SITE_PATH bugs where
  # the recipe caches the container under a different key than regular drush
  # commands, leaving the test site's container stale.
  echo "--- Creating test recipe fixture" >&3
  ddev exec mkdir -p /var/www/html/test-recipe
  ddev exec bash -c 'cat > /var/www/html/test-recipe/recipe.yml << RECIPE
name: "Test Recipe"
description: "Installs language module for testing."
type: "Testing"
install:
  - language
RECIPE'

  # Write a Playwright spec that applies the recipe and then runs a drush
  # command that requires the newly-installed module's classes to be in the
  # container. user:login triggers a full bootstrap that loads language plugin
  # classes — if DRUPAL_DEV_SITE_PATH is wrong, the container cache key
  # mismatches between the recipe command and regular drush commands, and
  # this fails with "Plugin (language) instance class does not exist".
  cat > test/playwright/tests/recipe.spec.ts << 'TESTEOF'
import { test, expect, execDrushInTestSite } from '@packages/playwright-drupal';

test('recipe installs module visible to subsequent commands', async ({ page }) => {
  // Apply a recipe that installs the language module.
  await execDrushInTestSite('recipe /var/www/html/test-recipe');

  // user:login triggers a full Drupal bootstrap that loads language module
  // plugin classes. If the container is stale (wrong DRUPAL_DEV_SITE_PATH),
  // this will fail with "DefaultLanguageItem does not exist".
  const result = await execDrushInTestSite('user:login --name=admin');
  expect(result.stdout).toContain('/user/reset');
});
TESTEOF
}

run_recipe_playwright_test() {
  PROJECT_DIR="$(cat "$BATS_FILE_TMPDIR/project_dir")"

  cd "$PROJECT_DIR"

  # Run only the recipe spec file.
  set +e
  ddev exec -d /var/www/html/test/playwright npx playwright test tests/recipe.spec.ts \
    2>&1 | tee "$BATS_FILE_TMPDIR/recipe_playwright_output.txt" >&3
  echo "${PIPESTATUS[0]}" > "$BATS_FILE_TMPDIR/recipe_playwright_exit_code"
  set -e
}

assert_wrong_import_error() {
  local import_path="$1"
  local description="$2"

  PROJECT_DIR="$(cat "$BATS_FILE_TMPDIR/project_dir")"
  cd "$PROJECT_DIR"

  # Save the correct config so we can restore it after this test.
  cp test/playwright/playwright.config.ts "$BATS_FILE_TMPDIR/playwright.config.ts.bak"

  # Write a bad config that imports from the given path.
  cat > test/playwright/playwright.config.ts << TSEOF
import { definePlaywrightDrupalConfig } from '${import_path}';

export default definePlaywrightDrupalConfig({
  testDir: './tests',
});
TSEOF

  # Run Playwright — it should fail with our error message.
  set +e
  local output
  output="$(ddev exec -d /var/www/html/test/playwright npx playwright test 2>&1)"
  local exit_code=$?
  set -e

  # Restore the correct config.
  cp "$BATS_FILE_TMPDIR/playwright.config.ts.bak" test/playwright/playwright.config.ts

  if [ "$exit_code" -eq 0 ]; then
    echo "[$description] Expected Playwright to fail but it exited with code 0. Output:" >&2
    echo "$output" >&2
    return 1
  fi

  if ! echo "$output" | grep -q "Wrong import path in playwright.config"; then
    echo "[$description] Expected 'Wrong import path in playwright.config' error message. Actual output:" >&2
    echo "$output" >&2
    return 1
  fi

  if ! echo "$output" | grep -q "@lullabot/playwright-drupal/config"; then
    echo "[$description] Expected correct import suggestion in error. Actual output:" >&2
    echo "$output" >&2
    return 1
  fi
}

cleanup_drupal_project() {
  PROJECT_DIR="$(cat "$BATS_FILE_TMPDIR/project_dir" 2>/dev/null || true)"
  PROJECT_NAME="$(cat "$BATS_FILE_TMPDIR/project_name" 2>/dev/null || true)"

  if [[ -n "$PROJECT_DIR" && -d "$PROJECT_DIR" ]]; then
    cd "$PROJECT_DIR"
    echo "--- ddev delete" >&3
    ddev delete -Oy >&3 2>&3 || true
    cd /
    # Do not rm -rf "$PROJECT_DIR" here — the Playwright HTML report at
    # $PROJECT_DIR/test/playwright/playwright-report/ must survive until
    # the GitHub Actions upload-artifact step can collect it.
  fi
}
