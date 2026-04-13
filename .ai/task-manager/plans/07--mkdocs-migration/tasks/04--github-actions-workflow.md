---
id: 4
group: "deployment"
dependencies: [1]
status: "pending"
created: 2026-04-12
skills:
  - github-actions
---
# Replace GitHub Actions Docs Deployment Workflow

## Objective
Replace the existing `docs.yml` GitHub Actions workflow (which deploys VitePress on `push` to `main`) with a new mike-based workflow that triggers on `playwright-drupal-*` tag pushes, installs Python toolchain, extracts the semver version from the tag, and deploys via `mike deploy --push`.

## Skills Required
- github-actions: GitHub Actions workflow authoring, tag triggers, git credential configuration

## Acceptance Criteria
- [ ] Workflow triggers on `push` matching `playwright-drupal-*` tag pattern and `workflow_dispatch`
- [ ] Checks out full history (`fetch-depth: 0`)
- [ ] Installs `uv` via official installer action
- [ ] Installs Python dependencies via `pip install -r docs/requirements.txt`
- [ ] Extracts semver version by stripping `playwright-drupal-` prefix from tag
- [ ] Configures git identity before running mike
- [ ] Runs `mike deploy --push --update-aliases <version> latest`
- [ ] Runs `mike set-default --push latest`
- [ ] Uses `contents: write` permission (not `pages: write` / `id-token: write`)

## Technical Requirements
- Trigger: `push` with `tags: ['playwright-drupal-*']` + `workflow_dispatch`
- `fetch-depth: 0` is required for mike to read/update the `gh-pages` branch
- Version extraction: strip `playwright-drupal-` prefix from `${{ github.ref_name }}`
  - e.g. `playwright-drupal-1.5.1` → `1.5.1`
  - Use `VERSION=${GITHUB_REF_NAME#playwright-drupal-}` in a shell step
- Git identity configuration needed: `git config user.name "github-actions[bot]"` and email
- mike aliases: `latest` is updated to point to current version
- Permissions: `contents: write` only (remove `pages: write`, `id-token: write`, `pull-requests: read`)
- For `workflow_dispatch`, the version extraction should still work — use `github.ref_name` which for manual dispatch on main would produce `main` — add a fallback or note in workflow
- Use `astral-sh/setup-uv@v6` action for uv installation

## Input Dependencies
- Task 1: `docs/requirements.txt` must exist

## Output Artifacts
- `.github/workflows/docs.yml` (completely replaced)

## Implementation Notes

<details>
<summary>Details</summary>

Replace `.github/workflows/docs.yml` entirely with:

```yaml
name: Deploy Docs

on:
  push:
    tags:
      - 'playwright-drupal-*'
  workflow_dispatch:

permissions:
  contents: write

concurrency:
  group: "pages"
  cancel-in-progress: false

jobs:
  deploy:
    runs-on: ubuntu-24.04
    timeout-minutes: 10
    steps:
      - name: Checkout
        uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683 # v4
        with:
          fetch-depth: 0

      - name: Install uv
        uses: astral-sh/setup-uv@v6

      - name: Install Python dependencies
        run: pip install -r docs/requirements.txt

      - name: Configure git identity
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"

      - name: Extract version from tag
        id: version
        run: |
          VERSION="${GITHUB_REF_NAME#playwright-drupal-}"
          echo "version=${VERSION}" >> $GITHUB_OUTPUT

      - name: Deploy docs with mike
        run: |
          mike deploy --push --update-aliases ${{ steps.version.outputs.version }} latest

      - name: Set default version
        run: |
          mike set-default --push latest
```

Key points:
- `actions/checkout` uses the v4 pinned hash — use the actual v4 hash. A placeholder is shown above; the implementer should use `actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683` which is a known v4 hash.
- `fetch-depth: 0` ensures full history so mike can push to `gh-pages`
- `concurrency` set to `cancel-in-progress: false` (unlike the original `true`) because mike deployments should not be cancelled mid-push
- The `workflow_dispatch` trigger allows manual re-deployment; in that case `GITHUB_REF_NAME` will be the branch name (e.g., `main`), so the version step would output `main` — this is acceptable for manual triggers or can be improved with an input parameter if needed
- The old `build` + `deploy` two-job structure is replaced with a single `deploy` job since mike handles everything

</details>
