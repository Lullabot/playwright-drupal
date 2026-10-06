# Development

This repository is an npm workspace monorepo:

- the repository root builds `@lullabot/playwright-drupal`; and
- `packages/playwright-testing` builds `@lullabot/playwright-testing`.

One root lockfile covers both packages. Install dependencies from the
repository root:

```console
npm ci
```

## Build and unit tests

Run coordinated checks from the root:

```console
npm run build:all
npm run test:all
```

The direct package commands are useful while developing one boundary:

```console
# Generic package only
npm run build --workspace=@lullabot/playwright-testing
npm test --workspace=@lullabot/playwright-testing

# Drupal package unit tests (the pretest builds the generic dependency)
npm run build
npm run test:unit
```

The generic workspace must not import files from the root Drupal package. The
dependency direction is always Drupal to generic. Code that supplies Drupal
selectors, toolbar behavior, DDEV paths, Drush integration, or database
isolation belongs in the root adapter.

## WebKit autofocus browser tests

Install the bundled browsers once, then run both the generic browser regression
suite and the Drupal fixture integration checks:

```console
npx playwright install --with-deps chromium firefox webkit
npm run build
npm run test:autofocus
```

The generic suite imports the public `@lullabot/playwright-testing` API and uses a
local context fixture. The smaller Drupal suite checks the production fixture's
default, opt-out, and no-isolation behavior. Neither suite requires Drupal or DDEV.
Run one suite with `npm run test:autofocus --workspace=@lullabot/playwright-testing`
or `npm run test:autofocus:drupal`. Failure traces live under
`test-results/webkit-autofocus/` in separate `generic` and `drupal` directories.

## DDEV integration tests

The repository uses [bats-core](https://github.com/bats-core/bats-core) for
consumer-style Drupal integration tests. They create a fresh DDEV project,
pack and install both local packages, and run the example Playwright tests.

Prerequisites are [DDEV](https://ddev.readthedocs.io/en/stable/) v1.25 or
newer and [bats-core](https://bats-core.readthedocs.io/en/stable/installation.html).

```console
npm run test:bats
```

The suite can take 10–15 minutes because it provisions a complete Drupal
environment.

## Verify package contents

Both packages should be checked independently before release:

```console
npm pack --dry-run --json
npm pack --dry-run --json --workspace=@lullabot/playwright-testing
```

Confirm that every declared export and executable target, its JavaScript and
declaration output, required runtime source, and README are present. The root
tarball must not contain workspace files, and the generic tarball must not
contain Drupal implementation or repository-only files.

For the strongest boundary check, create tarballs in a temporary directory,
install them into an empty package, and import the public entry points rather
than importing the worktree directly.

## Documentation

The Drupal site uses [MkDocs](https://www.mkdocs.org/) with the Material theme
and [`mike`](https://github.com/jimporter/mike) for versioned deployments. The
canonical generic guides live beside their package in
`packages/playwright-testing/docs`. Wrapper pages in
`docs/generic-playwright-utilities` include those guides and the package README
with `pymdownx.snippets`, so the site renders them without maintaining duplicate
copies. Edit the package sources to update the content; the development server
watches those files too. The overview wrapper overrides the README's guide
reference links with local destinations so readers stay within the site while
the standalone README keeps its GitHub links. Missing snippet files fail the
build.

Install [`uv`](https://docs.astral.sh/uv/) and run:

```console
npm run docs:dev      # live reload at http://localhost:8000
npm run docs:build    # strict static build
npm run docs:preview  # preview the built site
```

## Pull request commands

Maintainers can post these comments on a pull request:

- **`/fast-forward`** performs a true `git merge --ff-only`, preserving the
  original commit SHAs. The branch must already be current with the base.
- **`/rebase`** rebases the pull request branch onto the base and removes empty
  commits created by the rebase. Only repository owners, members, and
  collaborators can trigger it.
