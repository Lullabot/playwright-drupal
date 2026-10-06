# Releases

`@lullabot/playwright-drupal` and `@lullabot/playwright-testing` are versioned
and published independently from the same repository. Release Please tracks
the root package and `packages/playwright-testing` separately; a release for
one package does not require a version bump or npm publication of the other.

The release workflow publishes:

- the root directory when a Drupal package release is created; and
- `packages/playwright-testing` when a generic package release is created.

Both publications use npm trusted publishing. Before merging a release, verify
the package-specific changelog and run the workspace build, tests, and dry-run
pack commands from the [development guide](development.md).

## Release CI

The full Test workflow runs on every pull request, including Release Please's
release PRs. New commits to a PR cancel its outdated test run. The release path
is:

1. Feature PR checks pass, then the PR is merged into `main`.
2. Release Please immediately creates or updates the release PR.
3. Release PR checks pass, then the release PR is merged into `main`.
4. Release Please creates the release and publishes the affected packages to npm.

The Release workflow does not rerun the Test workflow on pushes to `main`.
This removes two full test runs from the release path. Keep the Test workflow's
PR checks required on `main`, require PRs to be up to date before merging, and
merge changes through PRs so the checks remain the gate for releasing code.
Maintainers can also run Test manually from the Actions tab when needed.

## Versioned documentation

The deployed MkDocs site is the Drupal package's documentation. It is deployed
when a tag matching `playwright-drupal-*` is pushed, for example
`playwright-drupal-1.5.1`. The workflow strips the prefix and runs `mike deploy`
with the version and `latest` alias. Generic package guides remain canonical in
`packages/playwright-testing/docs` and are included directly in the Drupal site.
Each deployed version includes the generic guides from that version's checkout.

Before the first versioned deployment, configure GitHub Pages to deploy the
`gh-pages` branch from `/ (root)`. The branch is created by `mike` on the first
deployment.

## One-off alpha releases

Stable releases are handled by Release Please. A maintainer can publish an
unreleased build under the `alpha` dist-tag without changing `latest`.

Authenticate npm using a granular token with publish access:

```console
npm config set //registry.npmjs.org/:_authToken <your-token>
npm whoami
```

From a clean, up-to-date `main`, bump only the package being tested. Do not
commit or push this version change.

```console
# Drupal adapter
npm version 1.13.0-alpha.0 --no-git-tag-version
npm publish --tag alpha --access public

# Generic package
npm version 0.2.0-alpha.0 \
  --workspace=@lullabot/playwright-testing \
  --no-git-tag-version
npm publish --workspace=@lullabot/playwright-testing \
  --tag alpha \
  --access public
```

Each package's `prepack` builds that package. The root Drupal build also builds
the generic dependency. Verify the dist-tags and then restore the manifest and
lockfile changes using your normal Git workflow:

```console
npm dist-tag ls @lullabot/playwright-drupal
npm dist-tag ls @lullabot/playwright-testing
```

Consumers install a prerelease with the corresponding `@alpha` package spec.
