#!/usr/bin/env bash
# Throwaway — not committed. See plan 9 task 2.
# Derived from demo/generate.sh; the cleanup EXIT trap is deliberately omitted
# so the pwdemo project persists across tasks 5–8.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

SKIP_SETUP=false
if [[ -n "${PROJECT_DIR:-}" && -d "$PROJECT_DIR" ]]; then
  echo "=== Reusing existing project: $PROJECT_DIR"
  SKIP_SETUP=true
  PROJECT_NAME="$(awk '/^name:/ {print $2; exit}' "$PROJECT_DIR/.ddev/config.yaml")"
else
  mkdir -p tmp
  PROJECT_DIR="$(mktemp -d "$REPO_ROOT/tmp/pwdemo-XXXXXXXXXX")"
  PROJECT_NAME="pwdemo-$(head -c 100 /dev/urandom | LC_ALL=C tr -dc 'a-z0-9' | head -c 4)"
  echo "=== Creating DDEV project $PROJECT_NAME at $PROJECT_DIR"
fi

# NO `trap cleanup EXIT` — the project must persist.

if [[ "$SKIP_SETUP" == "false" ]]; then
  cd "$PROJECT_DIR"

  echo "--- ddev config"
  ddev config --project-type=drupal11 --docroot=web --project-name="$PROJECT_NAME"

  echo "--- ddev start"
  ddev start

  echo "--- ddev composer create-project"
  ddev composer create-project drupal/recommended-project

  echo "--- ddev composer require drush/drush"
  ddev composer require drush/drush

  echo "--- ddev add-on get Lullabot/ddev-playwright"
  ddev add-on get Lullabot/ddev-playwright
  ddev restart

  echo "--- npx create-playwright"
  mkdir -p test/playwright
  ddev exec -- npx create-playwright@latest --lang=TypeScript --quiet test/playwright --no-browsers

  cd "$REPO_ROOT"
  echo "--- npm install (repo root)"
  npm install
  echo "--- npm pack"
  npm pack

  TARBALL_PATH="$REPO_ROOT/$(ls -t lullabot-playwright-drupal-*.tgz | head -n 1)"
  cp "$TARBALL_PATH" "$PROJECT_DIR/"
  TARBALL="$(basename "$TARBALL_PATH")"

  cd "$PROJECT_DIR"
  echo "--- npm install @lullabot/playwright-drupal"
  ddev exec -d /var/www/html/test/playwright npm install "/var/www/html/$TARBALL"
  rm -f "$TARBALL_PATH"

  echo "--- ddev install-playwright"
  ddev install-playwright

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

  cat > test/playwright/playwright.config.ts << 'TSEOF'
import { definePlaywrightDrupalConfig } from '@lullabot/playwright-drupal/config';
import { devices } from '@playwright/test';

export default definePlaywrightDrupalConfig({
  testDir: './tests',
  retries: 0,
  use: {
    ignoreHTTPSErrors: true,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
TSEOF

  chmod 644 web/sites/default/settings.php
  echo "include '../test/playwright/node_modules/@lullabot/playwright-drupal/settings/settings.playwright.php';" >> web/sites/default/settings.php

  cat > Taskfile.yml << 'EOF'
version: '3'
silent: true
includes:
  playwright:
    taskfile: test/playwright/node_modules/@lullabot/playwright-drupal/tasks/playwright.yml
    optional: true
EOF

  echo '/packages/playwright-drupal' >> test/playwright/.gitignore

  echo "--- drush site:install demo_umami"
  ddev drush site:install demo_umami -y --account-pass=admin --site-name="pwdemo" || true

  echo "--- copy a11y-violations spec for trace capture"
  rm -f test/playwright/tests/example.spec.ts
  rm -rf test/playwright/tests-examples
  cp "$REPO_ROOT/demo/tests/a11y-violations.spec.ts" test/playwright/tests/
else
  cd "$PROJECT_DIR"
fi

echo "--- running a11y-violations spec with --trace on (expected to fail)"
set +e
ddev exec -d /var/www/html/test/playwright \
  npx playwright test tests/a11y-violations.spec.ts --trace on --reporter=html
set -e

PROJECT_URL="https://$PROJECT_NAME.ddev.site"

cat > "$REPO_ROOT/_screenshots/bootstrap-env.sh" <<ENV
export PROJECT_DIR="$PROJECT_DIR"
export PROJECT_NAME="$PROJECT_NAME"
export PROJECT_URL="$PROJECT_URL"
ENV

echo "=== Bootstrap complete."
echo "    PROJECT_DIR=$PROJECT_DIR"
echo "    PROJECT_NAME=$PROJECT_NAME"
echo "    PROJECT_URL=$PROJECT_URL"
