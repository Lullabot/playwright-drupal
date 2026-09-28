---
id: 6
group: "documentation"
dependencies: [2, 3, 4, 5]
status: "pending"
created: 2026-04-12
skills:
  - bash
---
# Documentation Updates and Repository Cleanup

## Objective
Update `docs/development.md` with MkDocs/uv setup instructions and the GitHub Pages manual step, add `site/` to `.gitignore`, and update README.md links to use `/playwright-drupal/latest/`.

## Skills Required
- bash: .gitignore editing, file modifications

## Acceptance Criteria
- [ ] `site/` is added to `.gitignore`
- [ ] `docs/development.md` has a new "Docs Development" section documenting: how to install `uv`, how to run docs locally, the one-time GitHub Pages source change, and how tag-triggered deployment works
- [ ] `README.md` links updated from `/playwright-drupal/` to `/playwright-drupal/latest/` where applicable

## Technical Requirements
- `.gitignore` must include `site/` (MkDocs build output)
- `docs/development.md` new section should cover:
  1. Prerequisites: `uv` install (`curl -LsSf https://astral.sh/uv/install.sh | sh`)
  2. Local dev commands: `npm run docs:dev`, `npm run docs:build`, `npm run docs:preview`
  3. One-time GitHub Pages source change: Settings → Pages → Source → "Deploy from a branch" → `gh-pages` → `/ (root)`
  4. Deployment: tagging with `playwright-drupal-X.Y.Z` triggers the workflow; mike deploys to versioned URL
- Do NOT attempt to change GitHub Pages settings via API — only document it

## Input Dependencies
- Task 2: MkDocs config and content in place
- Task 3: npm scripts in place
- Task 4: GitHub Actions workflow in place
- Task 5: Tugboat config in place

## Output Artifacts
- `.gitignore` (site/ added)
- `docs/development.md` (new docs section added)
- `README.md` (links updated if applicable)

## Implementation Notes

<details>
<summary>Details</summary>

### 1. Add `site/` to `.gitignore`

Read the existing `.gitignore` and append `site/` at the end (or add it in a logical location near other build outputs).

### 2. Update `docs/development.md`

Add a new section "## Documentation" (or "## Docs Development") before or after the existing content. The existing content covers test running and PR commands — add the docs section at the end or in a logical location:

```markdown
## Documentation

### Local Development

The documentation site uses [MkDocs](https://www.mkdocs.org/) with the [Material theme](https://squidfunk.github.io/mkdocs-material/) and [`mike`](https://github.com/jimporter/mike) for versioned deployments.

**Prerequisites:** Install [`uv`](https://docs.astral.sh/uv/) (no manual Python virtualenv setup required):

```console
curl -LsSf https://astral.sh/uv/install.sh | sh
```

**Local development:**

```console
npm run docs:dev      # Starts live-reload server at http://localhost:8000
npm run docs:build    # Builds static site to site/
npm run docs:preview  # Previews the built site
```

### Versioned Deployment

Docs are deployed automatically when a release tag matching `playwright-drupal-*` is pushed (e.g., `playwright-drupal-1.5.1`). The GitHub Actions workflow:

1. Strips the `playwright-drupal-` prefix to get the semver version (e.g., `1.5.1`)
2. Runs `mike deploy --push --update-aliases 1.5.1 latest` to deploy to the `gh-pages` branch
3. Sets `latest` as the default version so the root URL redirects to current stable docs

Deployed docs are available at `https://lullabot.github.io/playwright-drupal/1.5.1/` and `https://lullabot.github.io/playwright-drupal/latest/`.

### One-Time GitHub Pages Setup

Before the first versioned deployment succeeds, the GitHub Pages source must be changed from "GitHub Actions" to "Deploy from a branch":

1. Go to the repository **Settings → Pages**
2. Under **Source**, select **Deploy from a branch**
3. Set the branch to **`gh-pages`** and folder to **`/ (root)`**
4. Save

This change is required because `mike` commits versioned directories directly to the `gh-pages` branch. The `gh-pages` branch is created automatically by `mike` on first deployment.
```

### 3. Update README.md

Read `README.md` and find any links pointing to `https://lullabot.github.io/playwright-drupal/` (without a version segment). Update them to `https://lullabot.github.io/playwright-drupal/latest/`. Be careful to only update links that reference the docs site root, not versioned paths that may already be correct.

</details>
