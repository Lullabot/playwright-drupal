# Screenshots in CI

When a visual comparison or an accessibility check fails, Playwright captures
exactly what you need to see: a diff image for the comparison, and for
accessibility a full-page screenshot with the violating elements outlined. By
default those end up zipped inside an artifact that has to be downloaded and
unpacked before anyone can look at them.

`playwright-drupal-failure-summary` reads the Playwright JSON report and writes
a job summary with those images embedded inline, plus an optional body for a
pull request comment.

## What it does without any configuration

```bash
npx playwright-drupal-failure-summary --report-path=test-results/results.json
```

This writes a text summary of the failures to `$GITHUB_STEP_SUMMARY` (or to
stdout when run outside GitHub Actions). Each failing test gets a collapsed
block, and where images exist but could not be uploaded it points at the
Playwright report artifact instead.

## Adding the images

Embedding images requires uploading them to GitHub first, and that upload is
the one part of this that needs a token you have to create yourself.

GitHub's attachment endpoint accepts **user** tokens only. The Actions
`GITHUB_TOKEN` and GitHub App installation tokens are both rejected, so there is
no way to do this with the credentials a workflow already has. Create a personal
access token, add it to the repository as a secret, and pass it in:

```yaml
- name: Failure summary
  if: always()
  env:
    SCREENSHOT_GITHUB_TOKEN: ${{ secrets.SCREENSHOT_GITHUB_TOKEN }}
  run: npx playwright-drupal-failure-summary --report-path="$REPORT"
```

`GITHUB_REPOSITORY_ID` is supplied by Actions automatically and is the other
thing the endpoint needs.

!!! warning "Choosing the token"

    Uploaded assets are attributed to the account that owns the token, and the
    token can act as that account everywhere else it has access. Use a machine
    account rather than a personal one, and give it the narrowest permissions
    that work.

### Who can see the images

Assets are not public. GitHub serves them from a private host behind a signed
URL that expires minutes after the page is rendered, and rendering requires
access to the repository — roughly the same posture as a workflow artifact.

Two differences from artifacts are worth knowing. A signed URL, once rendered,
works for anyone holding it until it expires. And the asset itself is retained
indefinitely, where artifacts expire on the schedule you set. If your tests
screenshot a site with real content, that content leaves your artifact
retention policy when you turn this on.

## Posting a comment

Pass `--comment-path` to write a short comment body — counts, a list of failing
tests, and a link to the job summary:

```yaml
- run: |
    npx playwright-drupal-failure-summary \
      --report-path="$REPORT" \
      --comment-path=failure-comment.md \
      --title="Playwright results"

- uses: marocchino/sticky-pull-request-comment@v3
  with:
    header: playwright-results
    path: failure-comment.md
```

The comment deliberately carries no images. Notification emails are rendered
once when they are sent, and the signed image URLs expire minutes later, so an
inline image in a comment is a broken image in everyone's inbox. The images
live in the job summary, and the comment links to it.

With a matrix build, have each job write its own comment body, upload it as an
artifact, and assemble one comment in a job that runs after them. Posting from
each matrix job means they overwrite each other, and no single comment can say
how the run went as a whole. This repository's own `test.yml` does it this way.

## Options

| Flag | Default | Meaning |
| --- | --- | --- |
| `--report-path` | `test-results/results.json` | Playwright JSON report to read. |
| `--comment-path` | none | Where to write the comment body. |
| `--title` | `Playwright results` | Heading for the comment. |
| `--include` | `diff` | `diff` uploads only the diff image; `all` adds the expected and actual images. |
| `--max-uploads` | `20` | Stop uploading after this many images. |

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
