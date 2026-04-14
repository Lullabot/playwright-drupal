/**
 * Build a synthetic A11yReport with representative violations, baselined
 * entries, stale entries, and a real violation screenshot, then render
 * generateSummary() as Markdown. Useful for previewing summary output
 * outside of a live CI run.
 *
 * Usage:
 *   npx tsx demo/a11y-summary-demo.ts               # writes demo/summary.md
 *   npx tsx demo/a11y-summary-demo.ts --screenshot  # also writes images/github-a11y-summary.webp
 *
 * The --screenshot flag requires @playwright/test and internet access
 * (pulls marked + github-markdown-css from a CDN). If `cwebp` is on PATH
 * the intermediate PNG is converted to WebP to save repo space.
 */

import * as fs from 'fs'
import * as path from 'path'
import { execFileSync } from 'child_process'
import { generateSummary, A11yReport } from '../src/github/a11y-summary'

const REPO_ROOT = path.resolve(__dirname, '..')
/**
 * A small pre-computed WebP of an Umami violation page. This is a tracked
 * demo fixture so the CI demo job and local preview both have a working
 * screenshot to embed — the real checkAccessibility() screenshot is a PNG
 * produced at test time.
 */
const VIOLATION_SCREENSHOT = path.join(
  REPO_ROOT,
  'demo',
  'a11y-summary-screenshot.webp',
)

function buildReport(): A11yReport {
  const screenshot = fs.existsSync(VIOLATION_SCREENSHOT)
    ? fs.readFileSync(VIOLATION_SCREENSHOT)
    : undefined

  return {
    tests: [
      {
        title: 'homepage has no accessibility violations',
        file: 'tests/a11y.spec.ts',
        line: 42,
        annotations: [
          { type: '@a11y' },
          { type: 'Accessibility', description: 'Best-practice scan: 0 violations (28 rules passed)' },
          { type: 'Accessibility', description: 'WCAG scan: 2 violations (48 rules passed)' },
        ],
        violations: [
          {
            rule: 'color-contrast',
            impact: 'serious',
            description: 'Elements must have sufficient color contrast',
            helpUrl: 'https://dequeuniversity.com/rules/axe/4.10/color-contrast',
            targets: ['.header__link', '.nav-item a', '.footer a', '.btn-primary'],
          },
          {
            rule: 'label',
            impact: 'critical',
            description: 'Form elements must have labels',
            helpUrl: 'https://dequeuniversity.com/rules/axe/4.10/label',
            targets: ['input[name="email"]'],
          },
        ],
        screenshot,
      },
      {
        title: 'product page matches the baseline',
        file: 'tests/a11y.spec.ts',
        line: 78,
        annotations: [
          { type: '@a11y' },
          { type: 'Accessibility', description: 'WCAG scan: 0 new violations (1 baselined)' },
          { type: 'Baselined a11y violation', description: 'duplicate-id: legacy footer markup — will be fixed in DRUP-1234' },
          { type: 'Stale a11y baseline entry', description: 'image-alt on .hero — no longer detected' },
        ],
        violations: [],
      },
    ],
    totalViolations: 2,
    totalBaselined: 1,
    totalStale: 1,
  }
}

async function renderScreenshot(markdown: string, outputPath: string) {
  const { chromium } = await import('@playwright/test')

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Accessibility summary preview</title>
<link
  rel="stylesheet"
  href="https://cdn.jsdelivr.net/npm/github-markdown-css@5.5.1/github-markdown-light.min.css"
/>
<script src="https://cdn.jsdelivr.net/npm/marked@11.1.1/marked.min.js"></script>
<style>
  body {
    margin: 0;
    background: #f6f8fa;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  }
  .wrapper {
    max-width: 1012px;
    margin: 0 auto;
    padding: 32px;
  }
  .markdown-body {
    background: #ffffff;
    border: 1px solid #d1d9e0;
    border-radius: 6px;
    padding: 32px;
    box-shadow: 0 1px 0 rgba(31, 35, 40, 0.04);
  }
  /* Render GitHub shortcode emoji (:white_check_mark: etc.) after marked runs. */
</style>
</head>
<body>
<div class="wrapper">
  <article class="markdown-body" id="content"></article>
</div>
<script>
  const md = ${JSON.stringify(markdown)};
  const emoji = {
    ':white_check_mark:': '✅',
    ':x:': '❌',
    ':warning:': '⚠️',
    ':information_source:': 'ℹ️',
  };
  const withEmoji = Object.entries(emoji).reduce(
    (s, [k, v]) => s.split(k).join(v),
    md,
  );
  document.getElementById('content').innerHTML = marked.parse(withEmoji);
  // Auto-expand <details> so the screenshot is visible in the preview.
  document.querySelectorAll('details').forEach((d) => (d.open = true));
</script>
</body>
</html>`

  const tmpHtml = path.join(REPO_ROOT, 'demo', '.summary-preview.html')
  fs.writeFileSync(tmpHtml, html)

  const browser = await chromium.launch()
  try {
    const context = await browser.newContext({
      viewport: { width: 1200, height: 900 },
      deviceScaleFactor: 2,
    })
    const page = await context.newPage()
    await page.goto('file://' + tmpHtml)
    await page.waitForLoadState('networkidle')
    // Give the CDN fonts + CSS a beat to settle.
    await page.waitForTimeout(500)
    const article = page.locator('#content')
    await article.screenshot({ path: outputPath })
  } finally {
    await browser.close()
    fs.rmSync(tmpHtml, { force: true })
  }
}

function maybeConvertToWebp(pngPath: string): string | null {
  const webpPath = pngPath.replace(/\.png$/, '.webp')
  try {
    execFileSync('cwebp', ['-quiet', '-q', '85', pngPath, '-o', webpPath])
    fs.rmSync(pngPath, { force: true })
    return webpPath
  } catch {
    return null
  }
}

async function main() {
  const report = buildReport()
  const md = generateSummary(report)

  // When running inside GitHub Actions, append the summary to the job summary
  // so the demo job visibly surfaces the failing-state markdown.
  const githubSummary = process.env.GITHUB_STEP_SUMMARY
  if (githubSummary) {
    fs.appendFileSync(githubSummary, md)
    console.log('Appended a11y summary to $GITHUB_STEP_SUMMARY')
  } else {
    // Locally, print the markdown size so users know it worked.
    console.log(`Generated a11y summary markdown (${md.length} bytes)`)
  }

  if (process.argv.includes('--screenshot')) {
    const pngPath = path.join(REPO_ROOT, 'images', 'github-a11y-summary.png')
    await renderScreenshot(md, pngPath)
    const webpPath = maybeConvertToWebp(pngPath)
    if (webpPath) {
      console.log(`Wrote ${path.relative(REPO_ROOT, webpPath)}`)
    } else {
      console.log(`Wrote ${path.relative(REPO_ROOT, pngPath)} (install cwebp to convert to WebP)`)
    }
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
