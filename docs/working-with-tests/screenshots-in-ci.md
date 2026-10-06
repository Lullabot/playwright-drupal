# Screenshots in CI

The framework-neutral report commands and library API are documented in the
canonical
[GitHub reporting guide](../generic-playwright-utilities/github-reporting.md).
The Drupal package preserves its original executable names and this repository
continues to provide composite actions for Drupal/DDEV workflows.

## Repository actions

Run the failure-summary action in each test job. A final job combines the
generated artifacts into one pull request comment:

```yaml
jobs:
  test:
    steps:
      # ... run your Playwright tests ...

      - name: Failure and flake summary
        if: always()
        uses: Lullabot/playwright-drupal/.github/actions/failure-summary@main
        with:
          report-path: test/playwright/test-results/results.json
          token: ${{ secrets.SCREENSHOT_GITHUB_TOKEN }}
          comment-path: failure-comment.md
          artifact-name: failure-comment-${{ matrix.suite }}

  failure-comment:
    needs: test
    if: always() && github.event_name == 'pull_request'
    runs-on: ubuntu-24.04
    permissions:
      pull-requests: write
      actions: read
      contents: read
    steps:
      - uses: actions/checkout@v5
      - uses: Lullabot/playwright-drupal/.github/actions/failure-comment@main
```

Pin `@main` to a release tag in production. `actions: read` is required for the
final job to download the per-job artifacts. Configure Playwright retries if
the report should distinguish failures from tests that passed on retry.

Without `SCREENSHOT_GITHUB_TOKEN`, the summary and comment are still written,
but link to Playwright artifacts instead of embedding images. This is the
expected behavior for pull requests from forks, where secrets are unavailable.

## Legacy executables

Existing workflows can continue to invoke the Drupal-branded commands:

```console
npx playwright-drupal-failure-summary --report-path=test-results/results.json
npx playwright-drupal-a11y-summary --mode=summary
```

They delegate to the generic implementation while preserving Drupal command
names and machine-readable marker prefixes. New framework-neutral workflows
should use `playwright-testing-failure-summary` and
`playwright-testing-a11y-summary`.

## Upload credentials and options

Inline screenshots use GitHub's user-attachments endpoint. It requires a
fine-grained personal access token with **Contents: read and write** access to
the selected repository; the standard Actions token and GitHub App tokens are
not accepted. Prefer a dedicated machine account and restrict the token to the
single repository.

The action inputs correspond to the generic command's `--report-path`,
`--comment-path`, `--title`, `--include`, `--max-uploads`, and `--path-prefix`
flags. See the canonical guide for the complete option table, security and
retention implications, container path remapping, and failure behavior.
