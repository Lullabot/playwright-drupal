# GitHub reporting

GitHub reporting is an optional secondary entry point of
`@lullabot/playwright-testing`. It reads Playwright JSON reports and produces
accessibility summaries, workflow annotations, failure/flake summaries, and
pull request comment bodies with relevant screenshots.

Enable Playwright's JSON reporter first:

```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  reporter: [
    ['line'],
    ['html'],
    ['json', { outputFile: 'test-results/results.json' }],
  ],
});
```

## Accessibility summary

Run the accessibility command after the test step, including when tests fail:

```yaml
- name: Run Playwright tests
  run: npx playwright test

- name: Accessibility summary
  if: always()
  run: npx playwright-testing-a11y-summary --mode=summary

- name: Accessibility annotations
  if: always()
  run: npx playwright-testing-a11y-summary --mode=annotations
```

`--report-path=PATH` overrides `test-results/results.json`. Summary mode appends
Markdown to `$GITHUB_STEP_SUMMARY` when it is available and otherwise writes to
stdout. Annotation mode writes GitHub workflow commands for the accessibility
findings. A missing report is non-fatal because the suite may not have run.

## Failure and flake summary

```yaml
- name: Failure and flake summary
  if: always()
  env:
    SCREENSHOT_GITHUB_TOKEN: ${{ secrets.SCREENSHOT_GITHUB_TOKEN }}
  run: >-
    npx playwright-testing-failure-summary
    --report-path=test-results/results.json
    --comment-path=failure-comment.md
```

The command writes the job summary to `$GITHUB_STEP_SUMMARY`, or stdout outside
GitHub Actions. `--comment-path` writes a separate pull request comment body;
that is where uploaded images should be embedded because user attachments do
not reliably render in job summaries.

| Option | Default | Purpose |
| --- | --- | --- |
| `--report-path=PATH` | `test-results/results.json` | JSON report to read. |
| `--comment-path=PATH` | none | Write a pull request comment body. |
| `--include=diff\|all` | `diff` | Include only diff images or all comparison images. Accessibility images are always eligible. |
| `--path-prefix=FROM:TO` | inferred | Remap report attachment paths; repeatable. |
| `--max-uploads=COUNT` | package default | Limit uploaded images. |
| `--title=TEXT` | `Playwright results` | Change the comment heading. |

The command reports failures and retries that eventually passed as flakes. It
also emits machine-readable HTML comment markers with the counts so a workflow
can decide whether to create, update, or remove a sticky pull request comment.

## Screenshot upload credentials

Image uploads require these environment variables:

- `SCREENSHOT_GITHUB_TOKEN`: a fine-grained personal access token for the
  repository with **Contents: read and write**;
- `GITHUB_REPOSITORY_ID`: set automatically in GitHub Actions; and
- the normal `GITHUB_*` workflow context variables used to link to the run.

GitHub's workflow token and GitHub App installation tokens do not work with the
user-attachments endpoint. Prefer a dedicated machine account and grant the
fine-grained token access only to the repository that needs it. Without a
usable upload token, the summary and comment are still generated and point to
the test artifact instead of embedding images.

The endpoint is undocumented. An upload failure disables further uploads for
that run but does not fail the build; the rendered report explains why images
are absent.

## Container path remapping

JSON reports store attachment paths as seen by the Playwright process. When the
report was generated in a container but the summary runs on the host, use a
repeatable mapping:

```console
npx playwright-testing-failure-summary \
  --path-prefix=/workspace/tests:$GITHUB_WORKSPACE/tests
```

The command also attempts to infer a shared path suffix. Unreadable files are
reported separately from upload failures so container configuration problems
remain diagnosable.

## Library API

Import report parsing, summary generation, attachment uploads, and path
resolution from the secondary entry point:

```typescript
import {
  createPathResolver,
  generateFailureSummary,
  parseFailures,
} from '@lullabot/playwright-testing/github';

const report = parseFailures('test-results/results.json');
const resolver = createPathResolver({
  reportPath: 'test-results/results.json',
});

console.log(generateFailureSummary(report));
void resolver;
```

Use the secondary entry point instead of reaching into `lib/github/*`; only the
declared package export is part of the public API.
