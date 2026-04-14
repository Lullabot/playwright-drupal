# Development

## Running Tests

This project uses [bats-core](https://github.com/bats-core/bats-core) for integration testing. The tests create a fresh DDEV Drupal project, install this library, and run the example Playwright tests to verify everything works end-to-end.

**Prerequisites:**
- [DDEV](https://ddev.readthedocs.io/en/stable/) (v1.25+)
- [Docker](https://docs.docker.com/get-docker/)
- [bats-core](https://bats-core.readthedocs.io/en/stable/installation.html)

**Run the tests:**
```console
bats test/
```

Tests take approximately 10-15 minutes as they set up a complete Drupal environment.

## Documentation

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

Docs are deployed automatically when a release tag matching `playwright-drupal-*` is pushed (e.g. `playwright-drupal-1.5.1`). The GitHub Actions workflow strips the `playwright-drupal-` prefix and runs `mike deploy --push --update-aliases 1.5.1 latest`, committing versioned docs to the `gh-pages` branch. Deployed docs are available at `https://lullabot.github.io/playwright-drupal/1.5.1/` and `https://lullabot.github.io/playwright-drupal/latest/`.

### One-Time GitHub Pages Setup

Before the first versioned deployment, change the GitHub Pages source from "GitHub Actions" to "Deploy from a branch":

1. Go to **Settings → Pages**
2. Under **Source**, select **Deploy from a branch**
3. Set branch to **`gh-pages`** and folder to **`/ (root)`**
4. Save

The `gh-pages` branch is created automatically by `mike` on first deployment.

## Publishing a One-Off Alpha Release

Stable releases are handled automatically by [release-please](https://github.com/googleapis/release-please) from `main`. To publish a one-off prerelease (e.g. to let someone test an unreleased change) without disturbing the `latest` dist-tag, publish manually from your workstation.

**Prerequisites:**

- Push access to the `@lullabot/playwright-drupal` npm package.
- A granular access token from [npmjs.com](https://www.npmjs.com/) with publish permission on the package.

**1. Authenticate npm with your token:**

```console
npm config set //registry.npmjs.org/:_authToken <your-token>
npm whoami
```

This writes the token to `~/.npmrc`. `npm login` is now interactive/browser-based and won't accept a token directly, so setting `_authToken` is the standard path for automation-style tokens.

**2. Check out a clean `main` and bump the version locally:**

```console
git checkout main
git pull
npm version 1.6.0-alpha.0 --no-git-tag-version
```

Do **not** commit or push the version bump — release-please manages versions in the repo. The bump only needs to exist in the working copy for `npm publish` to read.

**3. Publish under the `alpha` dist-tag:**

```console
ddev exec npm ci
ddev exec npm publish --tag alpha --access public
```

`prepack` runs `npm run build` automatically, so no separate build step is required. The `--tag alpha` flag is critical: without it, the prerelease would replace `latest` and become the default install.

**4. Verify and clean up:**

```console
npm dist-tag ls @lullabot/playwright-drupal
git checkout -- package.json package-lock.json
```

Consumers install the prerelease with `npm install @lullabot/playwright-drupal@alpha`.

## Pull Request Commands

Maintainers can use the following commands by posting a comment on a pull request:

- **`/fast-forward`** — Performs a true fast-forward merge (`git merge --ff-only`) that preserves the original commit SHAs. This avoids the SHA-rewriting that GitHub's built-in rebase merge does. The PR branch must be up to date with the base branch for this to succeed.
- **`/rebase`** — Rebases the PR branch onto the base branch, stripping any empty commits created during the rebase. Only repository owners, members, and collaborators can trigger this command.
