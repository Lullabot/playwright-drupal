# Contributing

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

## Pull Request Commands

Maintainers can use the following commands by posting a comment on a pull request:

- **`/fast-forward`** — Performs a true fast-forward merge (`git merge --ff-only`) that preserves the original commit SHAs. This avoids the SHA-rewriting that GitHub's built-in rebase merge does. The PR branch must be up to date with the base branch for this to succeed.
- **`/rebase`** — Rebases the PR branch onto the base branch, stripping any empty commits created during the rebase. Only repository owners, members, and collaborators can trigger this command.
