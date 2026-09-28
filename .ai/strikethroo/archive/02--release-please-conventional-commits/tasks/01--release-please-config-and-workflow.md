---
id: 1
group: "release-pipeline"
dependencies: []
status: "completed"
created: "2026-03-09"
skills:
  - github-actions
  - ci-cd
---
# Create release-please Configuration and Release Workflow

## Objective
Set up release-please configuration files and a GitHub Actions workflow that automates versioning, changelog generation, GitHub releases, and npm publishing on every push to `main`.

## Skills Required
- `github-actions`: Authoring GitHub Actions workflow YAML with multi-job pipelines, environment secrets, and conditional job execution
- `ci-cd`: Configuring release-please for node packages, npm publish setup with scoped packages

## Acceptance Criteria
- [ ] `release-please-config.json` exists at repo root with correct settings
- [ ] `.release-please-manifest.json` exists at repo root seeded with version `1.0.7`
- [ ] `.github/workflows/release-please.yml` workflow runs on push to `main`
- [ ] Release job uses `RELEASE_PLEASE_TOKEN` from `release-please` environment
- [ ] Publish job triggers only when `release_created` is true
- [ ] Publish job builds TypeScript and runs `npm publish --access public`
- [ ] Node.js 22 is used in all workflow steps

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- `googleapis/release-please-action@v4`
- `actions/checkout` and `actions/setup-node` for the publish job
- Node.js 22 LTS

## Input Dependencies
None — this task is independent.

## Output Artifacts
- `release-please-config.json`
- `.release-please-manifest.json`
- `.github/workflows/release-please.yml`

## Implementation Notes

<details>
<summary>Detailed implementation guidance</summary>

### release-please-config.json

Create at repository root:

```json
{
  "$schema": "https://raw.githubusercontent.com/googleapis/release-please/main/schemas/config.json",
  "release-type": "node",
  "include-v-in-tag": false,
  "packages": {
    ".": {}
  }
}
```

Key points:
- `"include-v-in-tag": false` is **critical** — existing tags (`1.0.0` through `1.0.7`) have no `v` prefix. Without this, release-please creates `v1.0.8` and loses track of existing history.
- `"release-type": "node"` tells release-please to update `package.json` version field.
- `"packages": { ".": {} }` targets the repository root (monorepo-style config even for single package).

### .release-please-manifest.json

Create at repository root:

```json
{
  ".": "1.0.7"
}
```

This seeds the current version so release-please knows the last release. The npm registry and git tags both confirm `1.0.7` is the latest.

### .github/workflows/release-please.yml

```yaml
name: Release

on:
  push:
    branches: [main]

permissions:
  contents: write
  pull-requests: write

jobs:
  release-please:
    runs-on: ubuntu-latest
    environment: release-please
    outputs:
      release_created: ${{ steps.release.outputs.release_created }}
      tag_name: ${{ steps.release.outputs.tag_name }}
    steps:
      - name: Run release-please
        id: release
        uses: googleapis/release-please-action@v4
        with:
          token: ${{ secrets.RELEASE_PLEASE_TOKEN }}

  publish:
    needs: release-please
    if: needs.release-please.outputs.release_created == 'true'
    runs-on: ubuntu-latest
    environment: release-please
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22'
          registry-url: 'https://registry.npmjs.org'

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build

      - name: Publish to npm
        run: npm publish --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

Key points:
- The `release-please` job uses a PAT (`RELEASE_PLEASE_TOKEN`) from the `release-please` environment, not `GITHUB_TOKEN`, so that the Release PR and tags it creates can trigger downstream workflows.
- The `publish` job only runs when `release_created` is `true`.
- `registry-url` must be set in `actions/setup-node` so `.npmrc` is configured for `NODE_AUTH_TOKEN`.
- `--access public` is required because `@lullabot/playwright-drupal` is a scoped package (scoped packages default to private).
- No `package-lock.json` exists in this repo, so `npm ci` will work from `package.json` alone (it creates a lockfile on the fly).

</details>
