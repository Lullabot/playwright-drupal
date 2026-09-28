---
id: 3
group: "mysql-to-sqlite"
dependencies: []
status: "completed"
created: 2026-03-16
skills:
  - taskfile-yaml
  - bats-testing
  - documentation
---
# MySQL-to-SQLite Conversion PR

## Objective
Add a `playwright:mysql-to-sqlite` Taskfile task that converts a MySQL/MariaDB database to SQLite, enabling projects to test against their real database. Include a Bats integration test and README documentation.

## Skills Required
- Taskfile.dev YAML syntax
- Bats integration testing
- README documentation (Markdown)

## Acceptance Criteria
- [ ] New `mysql-to-sqlite` task added to `tasks/playwright.yml`
- [ ] Task creates `/tmp/sqlite/` directory and runs `mysql-to-sqlite3` via `uv tool run` with DDEV defaults (db/db/db/3306)
- [ ] New Bats test file `test/integration-mysql-to-sqlite.bats` validates the conversion workflow end-to-end
- [ ] README updated with a section on testing with an existing database, covering task usage, `uv` prerequisite (provided by ddev-playwright), and recommended `playwright:install:hook` pattern
- [ ] All existing tests pass locally
- [ ] PR created on branch `feat/mysql-to-sqlite`, all CI status checks pass

## Technical Requirements

### Taskfile Task
Add to `tasks/playwright.yml`:
```yaml
mysql-to-sqlite:
  desc: "Convert the active MySQL/MariaDB database to SQLite for Playwright tests"
  cmds:
    - mkdir -p /tmp/sqlite
    - >-
      uv tool run --from mysql-to-sqlite3 mysql2sqlite
      --mysql-host db
      --mysql-port 3306
      --mysql-user db
      --mysql-password db
      --mysql-database db
      --sqlite-file /tmp/sqlite/.ht.sqlite
```

### Bats Integration Test
Create `test/integration-mysql-to-sqlite.bats` that:
1. Sets up a DDEV Drupal project (reuse helpers from `test/test_helper.bash`)
2. Installs Drupal to MySQL normally via `drush site:install`
3. Runs `task playwright:mysql-to-sqlite`
4. Verifies `/tmp/sqlite/.ht.sqlite` exists and is a valid SQLite database
5. Configures Playwright and runs a test against the converted database

### README Documentation
Add a section explaining:
- The `playwright:mysql-to-sqlite` task and when to use it
- That `uv` is provided by the ddev-playwright add-on
- Recommended pattern: use `playwright:install:hook` to populate MySQL first, then call `playwright:mysql-to-sqlite`

## Input Dependencies
None — standalone task.

## Output Artifacts
- Modified `tasks/playwright.yml` with new task
- New `test/integration-mysql-to-sqlite.bats`
- Updated `README.md`
- GitHub PR with passing CI checks

## Implementation Notes
- The DDEV default credentials (db/db/db/3306) are hardcoded — this is intentional per plan clarification
- Table truncation is NOT included in the task — it's project-specific and belongs in `playwright:install:hook`
- The Bats test may need to install `uv` in the DDEV container if not already available
- Commit message: `feat: add mysql-to-sqlite conversion task`
- After pushing, monitor CI with `gh pr checks <PR-URL> --watch` and fix any failures
