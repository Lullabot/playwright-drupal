# GitHub Accessibility Annotations

When running accessibility tests in CI, you can surface violations directly in GitHub workflow summaries and inline file annotations using the included composite action or CLI tool.

![GitHub workflow job summary showing accessibility violations, a violation table, and the highlighted screenshot](/images/github-a11y-summary.webp)

## Prerequisites

The JSON reporter must be enabled for the annotation tools to parse test results. This is included automatically when using `definePlaywrightDrupalConfig()` — no extra configuration needed.

## Using the Reusable Action (Recommended)

Add the following to your GitHub Actions workflow:

```yaml
- name: Run Playwright tests
  run: ddev exec npx playwright test

- name: Accessibility annotations
  if: always()
  uses: Lullabot/playwright-drupal/.github/actions/a11y-annotations@main
```

The `if: always()` ensures the annotations step runs even when the test step fails, so violations appear in the job summary regardless of overall job status.

This step will:
1. Write an accessibility summary to the workflow job summary
2. Create inline `::error` / `::warning` annotations on test files

### Action Inputs

| Input | Default | Description |
|-------|---------|-------------|
| `report-path` | `test-results/results.json` | Path to the Playwright JSON report |
| `mode` | `all` | Output mode: `all`, `summary`, or `annotations` |

## Using the CLI Directly

For more control, use the `playwright-drupal-a11y-summary` CLI:

```yaml
- name: Accessibility summary
  if: always()
  run: ddev exec npx playwright-drupal-a11y-summary --mode=summary

- name: Accessibility annotations
  if: always()
  run: ddev exec npx playwright-drupal-a11y-summary --mode=annotations
```

### CLI Options

| Option | Default | Description |
|--------|---------|-------------|
| `--mode=<mode>` | `summary` | Output mode: `summary` or `annotations` |
| `--report-path=<path>` | `test-results/results.json` | Path to the Playwright JSON report |
