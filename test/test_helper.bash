#!/usr/bin/env bash

# test_helper.bash — Helper functions for bats integration tests.
# These functions implement the full README workflow for setting up a DDEV
# Drupal project, installing playwright-drupal, and running Playwright tests.

setup_drupal_project() {
  # Create a temporary directory for the Drupal project.
  PROJECT_DIR="$(mktemp -d)"

  # Generate a randomized project name to avoid collisions.
  PROJECT_NAME="pwtest-$(tr -dc 'a-z0-9' < /dev/urandom | head -c 4)"

  # Persist these values so other functions and tests can access them.
  echo "$PROJECT_DIR" > "$BATS_FILE_TMPDIR/project_dir"
  echo "$PROJECT_NAME" > "$BATS_FILE_TMPDIR/project_name"

  export PROJECT_DIR PROJECT_NAME

  cd "$PROJECT_DIR"

  # Follow the README steps: Create the Drupal Site and Initialize DDEV.
  ddev config --project-type=drupal11 --docroot=web --project-name="$PROJECT_NAME"
  ddev start
  ddev composer create-project drupal/recommended-project
  ddev composer require drush/drush

  # Install the ddev-playwright add-on and restart.
  ddev add-on get Lullabot/ddev-playwright
  ddev restart

  # Initialize Playwright tests.
  mkdir -p test/playwright
  ddev exec -- npx create-playwright@latest --lang=TypeScript --quiet test/playwright --no-browsers

  # Install Playwright browsers via the DDEV add-on command.
  ddev install-playwright
}

install_playwright_drupal() {
  PROJECT_DIR="$(cat "$BATS_FILE_TMPDIR/project_dir")"

  # Run npm pack from the repo root (on the host) to create a tarball.
  cd "$REPO_ROOT"
  npm pack

  # Find the generated tarball.
  TARBALL="$(ls -t lullabot-playwright-drupal-*.tgz | head -n 1)"

  # Copy the tarball into the Drupal project root, which is bind-mounted
  # at /var/www/html inside the DDEV container.
  cp "$TARBALL" "$PROJECT_DIR/"

  # Install the tarball inside the DDEV container.
  cd "$PROJECT_DIR"
  ddev exec -d /var/www/html/test/playwright npm install "/var/www/html/$TARBALL"

  # Clean up the tarball from the repo root.
  rm -f "$REPO_ROOT/$TARBALL"
}

configure_playwright() {
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

  # Write playwright.config.ts with chromium-only config.
  cat > test/playwright/playwright.config.ts << 'TSEOF'
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  globalSetup: require.resolve('./node_modules/@lullabot/playwright-drupal/lib/setup/global-setup'),
  use: {
    baseURL: process.env.DDEV_PRIMARY_URL,
    ignoreHTTPSErrors: true,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
TSEOF

  # Add Playwright settings to Drupal's settings.php.
  # The file may be read-only, so chmod it first.
  chmod 644 web/sites/default/settings.php
  echo "include '../test/playwright/node_modules/@lullabot/playwright-drupal/settings/settings.playwright.php';" >> web/sites/default/settings.php

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
import { test, expect, execDrushInTestSite } from '@packages/playwright-drupal';

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

  await page.goto('/node/add/article');

  let randomTitle = (Math.random() + 1).toString(36).substring(2);
  await page.getByLabel('Title', { exact: true }).fill(randomTitle);
  await page.getByRole('button', { name: 'Save' }).click();

  // Since we're testing with Umami, upstream changes may change the node ID.
  // If you are creating a test like this on your own site, and the node ID is
  // deterministic, consider hard-coding that node ID instead.
  await expect(page).toHaveURL(/\/node\/\d+(?:\?.*)?$/);

  await expect(page).toHaveTitle(`${randomTitle} | Playwright`);
  await expect(page.locator('h1')).toHaveText(randomTitle);
});
TESTEOF
}

run_playwright_tests() {
  PROJECT_DIR="$(cat "$BATS_FILE_TMPDIR/project_dir")"

  cd "$PROJECT_DIR"

  # Run Playwright tests and capture output and exit code.
  # We use set +e to prevent bats from aborting on a non-zero exit code,
  # since we want to capture the exit code for assertion in individual tests.
  set +e
  ddev exec -d /var/www/html/test/playwright npx playwright test \
    > "$BATS_FILE_TMPDIR/playwright_output.txt" 2>&1
  echo "$?" > "$BATS_FILE_TMPDIR/playwright_exit_code"
  set -e
}

cleanup_drupal_project() {
  PROJECT_DIR="$(cat "$BATS_FILE_TMPDIR/project_dir" 2>/dev/null || true)"
  PROJECT_NAME="$(cat "$BATS_FILE_TMPDIR/project_name" 2>/dev/null || true)"

  if [[ -n "$PROJECT_DIR" && -d "$PROJECT_DIR" ]]; then
    cd "$PROJECT_DIR"
    ddev delete -Oy || true
    cd /
    rm -rf "$PROJECT_DIR"
  fi
}
