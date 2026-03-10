---
id: 2
group: "docroot-detection"
dependencies: []
status: "pending"
created: "2026-03-10"
skills:
  - taskfile
---
# Replace hardcoded web/ in Taskfile with dynamic docroot variable

## Objective
Update `tasks/playwright.yml` to read the docroot from `composer.json` via a dynamic variable, replacing all hardcoded `web/` references.

## Skills Required
- Taskfile (taskfile.dev) YAML syntax, including dynamic `sh:` variables

## Acceptance Criteria
- [ ] A `DOCROOT` variable is defined at the top of `tasks/playwright.yml` using a `sh:` dynamic command
- [ ] The variable reads `extra.drupal-scaffold.locations.web-root` from `composer.json`
- [ ] The variable defaults to `web` if the key is absent or `composer.json` is missing
- [ ] All 6 references to `web/` in the `prepare` and `cleanup` tasks use `{{ .DOCROOT }}` instead
- [ ] The `prepare` task summary is updated to reflect the dynamic docroot

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- Taskfile `vars:` with `sh:` for dynamic evaluation
- `node -e` for JSON extraction (Node is always available in DDEV containers)

## Input Dependencies
None — this is a standalone implementation task.

## Output Artifacts
- Updated `tasks/playwright.yml` with dynamic `DOCROOT` variable replacing all hardcoded `web/` paths

## Implementation Notes

<details>
<summary>Detailed implementation guidance</summary>

### Define the dynamic variable
At the top of the file, add a `vars:` block with a `sh:` command:

```yaml
vars:
  DOCROOT:
    sh: node -e "try { const c = require('./composer.json'); const w = (c.extra?.['drupal-scaffold']?.locations?.['web-root'] || 'web').replace(/\/$/, ''); process.stdout.write(w); } catch(e) { process.stdout.write('web'); }"
```

The task runner executes from the Drupal project root, so `./composer.json` is the correct path.

Key points:
- Use `process.stdout.write()` instead of `console.log()` to avoid a trailing newline
- Strip trailing slash with `.replace(/\/$/, '')`
- Wrap in try/catch to handle missing `composer.json` gracefully

### Replace all hardcoded `web/` references
There are 6 occurrences in the file that need updating. All are in the `prepare` and `cleanup` tasks:

**In `prepare` task (lines 57-58):**
```yaml
rm -rf web/sites/simpletest/{{ shellQuote .test_id }}/
mkdir -p web/sites/simpletest/{{ shellQuote .test_id }}/
```
→ Replace `web/` with `{{ .DOCROOT }}/`

**In `prepare` task (lines 65-66):**
```yaml
cp -a web/sites/default/*.php web/sites/simpletest/{{ shellQuote .test_id }}/
cp -a web/sites/default/*.yml web/sites/simpletest/{{ shellQuote .test_id }}/
```
→ Replace all 4 `web/` with `{{ .DOCROOT }}/`

**In `cleanup` task (lines 123-124):**
```yaml
while [ -d web/sites/simpletest/{{ shellQuote .test_id }}/ ]; do
  rm -rf web/sites/simpletest/{{ shellQuote .test_id }}/ 2>/dev/null || true
```
→ Replace both `web/` with `{{ .DOCROOT }}/`

### Update the `prepare` summary
Line 48 says `will import the database into \`web/sites/simpletest/456/.ht.sqlite\``. Update to mention the dynamic docroot.

</details>
