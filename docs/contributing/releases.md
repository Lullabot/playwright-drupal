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

## Versioned documentation

The deployed MkDocs site is the Drupal package's documentation. It is deployed
when a tag matching `playwright-drupal-*` is pushed, for example
`playwright-drupal-1.5.1`. The workflow strips the prefix and runs `mike deploy`
with the version and `latest` alias. Generic package guides remain canonical in
`packages/playwright-testing/docs` and are linked from the Drupal site.

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
