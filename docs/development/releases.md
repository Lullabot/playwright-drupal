# Releases

## Versioned Deployment

Docs are deployed automatically when a release tag matching `playwright-drupal-*` is pushed (e.g. `playwright-drupal-1.5.1`). The GitHub Actions workflow strips the `playwright-drupal-` prefix and runs `mike deploy --push --update-aliases 1.5.1 latest`, committing versioned docs to the `gh-pages` branch. Deployed docs are available at `https://lullabot.github.io/playwright-drupal/1.5.1/` and `https://lullabot.github.io/playwright-drupal/latest/`.

## One-Time GitHub Pages Setup

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
