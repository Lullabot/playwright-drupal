# Screenshots in CI

When a visual comparison or an accessibility check fails, Playwright captures
exactly what you need to see: a diff image for the comparison, and for
accessibility a full-page screenshot with the violating elements outlined. By
default those end up zipped inside an artifact that has to be downloaded and
unpacked before anyone can look at them.

This package can put them in the job summary instead, and post a pull request
comment pointing at it.

## The quickest version

Two actions ship with the package. The first writes the job summary for a job,
and the second turns whatever the jobs produced into a single pull request
comment:

```yaml
jobs:
  test:
    steps:
      # ... run your Playwright tests ...

      - name: Failure summary
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

Pin `@main` to a release tag in real use. The `actions: read` permission is
needed because a job-level `permissions:` block denies everything it does not
list, and the second action reads the run's artifacts.

Without `SCREENSHOT_GITHUB_TOKEN` the summary still gets written — it just
points at the Playwright artifact rather than showing the images. That is also
what happens on pull requests from forks, which never receive secrets.

## Or call the command directly

The actions wrap `playwright-drupal-failure-summary`, which you can run
yourself:

```bash
npx playwright-drupal-failure-summary --report-path=test-results/results.json
```

It writes to `$GITHUB_STEP_SUMMARY`, or to stdout when run outside GitHub
Actions.

## The upload token

Embedding images means uploading them to GitHub first, and that upload is the
one part of this needing a token you create yourself.

GitHub's attachment endpoint accepts **user** tokens only. The Actions
`GITHUB_TOKEN` and GitHub App installation tokens are both refused with a 404,
so there is no way to do this with credentials a workflow already has.

**Use a fine-grained personal access token.** They work — that is what this
feature was built and tested against — and unlike a classic token they can be
restricted to the one repository that needs them.

What is verified about what the token needs:

- **Access to the repository whose ID you pass.** Uploading against a
  repository the token has no grant on returns exactly the same 404 an Actions
  token gets, so repository access is genuinely checked.
- `GITHUB_REPOSITORY_ID` supplies that ID, and Actions sets it for you.

What is *not* knowable: the minimum permission set. The endpoint is
undocumented and does not return the `X-Accepted-GitHub-Permissions` header
that documented endpoints use to advertise their requirements, so it cannot be
read off the API. It is verified working with a token granted repository access
and Contents. Start with the narrowest grant you think will do and widen only
if uploads fail — the command logs the status and response body, and switches
uploading off for the rest of the run rather than retrying.

!!! warning "Prefer a machine account"

    Uploaded assets are attributed to the account owning the token, and the
    token can act as that account everywhere else it has access. A fine-grained
    token limits the blast radius to the repositories you select, but the
    account is still a real one.

### Who can see the images

Assets are not public. GitHub serves them from a private host behind a signed
URL that expires minutes after the page renders, and rendering requires access
to the repository — roughly the same posture as a workflow artifact.

Two differences from artifacts are worth knowing. A signed URL, once rendered,
works for anyone holding it until it expires. And the asset itself is retained
indefinitely, where artifacts expire on the schedule you set. If your tests
screenshot a site with real content, that content leaves your artifact
retention policy when you turn this on.

## Comments

The comment carries no images, deliberately. Notification emails are rendered
once when sent, and the signed image URLs expire minutes later, so an inline
image in a comment is a broken image in everyone's inbox. The images live in
the job summary and the comment links to it.

With a matrix build, each job writes its own comment body and uploads it as an
artifact, and one job afterwards assembles them into a single comment. Posting
from each matrix job instead means they overwrite each other, and no single
comment can say how the run went as a whole. This repository's own `test.yml`
works this way.

### Deciding whether to comment at all

Each comment body ends with an HTML comment carrying the failure count, so an
assembling job can tell a green run from a red one without reading the prose:

```
<!-- playwright-drupal-failures: 0 -->
```

The shipped action reads this for you. If you assemble comments yourself, grep
for that rather than for wording — the empty-state sentence is "No failing
tests with screenshots", which contains the words "failing test" and will
happily match a naive pattern:

```bash
if grep -qE '<!-- playwright-drupal-failures: [1-9]' comment.md; then
  echo 'has-failures=true' >> "$GITHUB_OUTPUT"
fi
```

Pair that with the sticky action's `delete:` input to clear the comment when a
previously failing pull request goes green.

## Options

The action inputs map onto the command's flags.

| Flag | Input | Default | Meaning |
| --- | --- | --- | --- |
| `--report-path` | `report-path` | `test-results/results.json` | Playwright JSON report to read. |
| `--comment-path` | `comment-path` | none | Where to write the comment body. |
| `--title` | `title` | `Playwright results` | Heading for the comment. |
| `--include` | `include` | `diff` | `diff` uploads only the diff image; `all` adds the expected and actual images. Accessibility screenshots are included either way. |
| `--max-uploads` | `max-uploads` | `20` | Stop uploading after this many images. |
| — | `token` | none | The upload token. Without it, no images. |
| — | `artifact-name` | none | Upload the comment body under this artifact name. |
| — | `package` | `@lullabot/playwright-drupal` | Where to run the command from. |

A missing report is not an error — the suite may simply not have run.

## When uploads fail

The endpoint is undocumented and may change or disappear. A single failure
switches uploading off for the rest of the run rather than retrying against
something that is not there, and the reason is logged. The summary still gets
written; it points at the artifact instead of showing images. Nothing about
this can fail a build.

One consequence of how the endpoint works is worth stating plainly: the URL it
returns cannot be fetched. It is a handle that only GitHub's Markdown renderer
resolves, and a direct request for it returns 404 whether or not you send
credentials. A 201 response carrying a URL is the only success signal there is,
so do not add a step that verifies an upload by reading it back.
