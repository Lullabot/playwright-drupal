---
id: 2
group: "mkdocs-setup"
dependencies: [1]
status: "completed"
created: 2026-04-12
skills:
  - mkdocs
  - html
complexity_score: 5
complexity_notes: "Multiple interrelated file changes: mkdocs.yml, overrides/home.html, image moves, content page updates, and VitePress directory removal."
---
# MkDocs Configuration and Content Migration

## Objective
Replace the VitePress configuration with MkDocs + Material setup: create `mkdocs.yml`, create the `overrides/home.html` template, move images from `docs/public/images/` to `docs/images/`, rewrite `docs/index.md` for MkDocs Material, update image paths in `docs/github-actions.md`, and remove the `docs/.vitepress/` and `docs/public/` directories.

## Skills Required
- mkdocs: MkDocs configuration, Material theme, mike version provider, overrides templates
- html: Jinja2/HTML for the home override template

## Acceptance Criteria
- [ ] `mkdocs.yml` exists at repo root with Material theme, mike version provider, nav matching VitePress sidebar
- [ ] `overrides/home.html` reproduces the hero image and 4 feature cards from the VitePress home page
- [ ] `docs/images/` contains all 3 images (moved from `docs/public/images/`)
- [ ] `docs/index.md` uses MkDocs Material home template (`template: overrides/home.html`)
- [ ] `docs/github-actions.md` uses relative image path `images/github-a11y-summary.webp` (not `/images/...`)
- [ ] `docs/.vitepress/` directory is deleted
- [ ] `docs/public/` directory is deleted

## Technical Requirements
- `mkdocs.yml` at repo root with:
  - `site_name: playwright-drupal`
  - `site_url: https://lullabot.github.io/playwright-drupal/`
  - `docs_dir: docs`
  - `site_dir: site`
  - Material theme with `custom_dir: overrides`, `mike` version provider, `version` section
  - Nav: Getting Started, Writing Tests, Visual Comparisons, Configuration, GitHub Actions & Accessibility, Development
- `overrides/home.html` extends `main.html`, has hero section (image + title + tagline + buttons) and 4-card feature grid
- The 4 features verbatim from `docs/index.md`:
  1. Fast Parallel Tests — Supports fast parallel tests by installing or importing sites into sqlite databases.
  2. Drush in Tests — Enables Playwright tests to run Drush commands against a test site.
  3. Browser Console Errors — Shows browser console errors during the test.
  4. PHP Error Log — Attaches PHP's error log to the Playwright test results.
- Hero image: `images/demo.webp`; hero tagline: "Playwright / Drupal integration, supporting fast parallel tests and visual comparisons"
- Two action buttons: "Get Started" (→ `getting-started/`) and "View on GitHub" (→ `https://github.com/Lullabot/playwright-drupal`)

## Input Dependencies
- Task 1: `docs/requirements.txt` must exist (validates Python toolchain is defined)

## Output Artifacts
- `mkdocs.yml` (repo root)
- `overrides/home.html`
- `docs/images/demo.webp`
- `docs/images/github-a11y-summary.webp`
- `docs/images/a11y-violation-screenshot.webp`
- `docs/index.md` (rewritten)
- `docs/github-actions.md` (image path updated)
- `docs/.vitepress/` (deleted)
- `docs/public/` (deleted)

## Implementation Notes

<details>
<summary>Details</summary>

### 1. Create `mkdocs.yml` at repo root

```yaml
site_name: playwright-drupal
site_url: https://lullabot.github.io/playwright-drupal/
docs_dir: docs
site_dir: site

theme:
  name: material
  custom_dir: overrides
  palette:
    scheme: default
  features:
    - navigation.tabs
    - navigation.top
  version:
    provider: mike

extra:
  version:
    provider: mike

nav:
  - Getting Started: getting-started.md
  - Writing Tests: writing-tests.md
  - Visual Comparisons: visual-comparisons.md
  - Configuration: configuration.md
  - GitHub Actions & Accessibility: github-actions.md
  - Development: development.md
```

### 2. Create `overrides/home.html`

The `overrides/` directory must be at the repo root (same level as `mkdocs.yml`). Create `overrides/home.html`:

```html
{% extends "main.html" %}

{% block tabs %}
{{ super() }}

<section class="mdx-container">
  <div class="md-grid md-typeset">
    <div class="mdx-hero">
      <div class="mdx-hero__image">
        <img src="{{ base_url }}/images/demo.webp" alt="Demo showing running isolated Drupal tests in parallel" draggable="false">
      </div>
      <div class="mdx-hero__content">
        <h1>playwright-drupal</h1>
        <p>Playwright / Drupal integration, supporting fast parallel tests and visual comparisons</p>
        <a href="{{ page.next_page.url | url }}" class="md-button md-button--primary">
          Get Started
        </a>
        <a href="https://github.com/Lullabot/playwright-drupal" class="md-button">
          View on GitHub
        </a>
      </div>
    </div>
  </div>
</section>

<section class="mdx-features">
  <div class="md-grid md-typeset">
    <div class="mdx-features__grid">
      <div class="mdx-features__item">
        <h2>Fast Parallel Tests</h2>
        <p>Supports fast parallel tests by installing or importing sites into sqlite databases.</p>
      </div>
      <div class="mdx-features__item">
        <h2>Drush in Tests</h2>
        <p>Enables Playwright tests to run Drush commands against a test site.</p>
      </div>
      <div class="mdx-features__item">
        <h2>Browser Console Errors</h2>
        <p>Shows browser console errors during the test.</p>
      </div>
      <div class="mdx-features__item">
        <h2>PHP Error Log</h2>
        <p>Attaches PHP's error log to the Playwright test results.</p>
      </div>
    </div>
  </div>
</section>
{% endblock %}

{% block content %}{% endblock %}
```

### 3. Move images

Run these shell commands:
```bash
mkdir -p docs/images
git mv docs/public/images/demo.webp docs/images/demo.webp
git mv docs/public/images/github-a11y-summary.webp docs/images/github-a11y-summary.webp
git mv docs/public/images/a11y-violation-screenshot.webp docs/images/a11y-violation-screenshot.webp
git rm -r docs/public/
```

### 4. Rewrite `docs/index.md`

Replace the entire content with:

```markdown
---
template: overrides/home.html
title: playwright-drupal
---
```

### 5. Update image path in `docs/github-actions.md`

Change:
```
![GitHub workflow job summary showing accessibility violations, a violation table, and the highlighted screenshot](/images/github-a11y-summary.webp)
```
To:
```
![GitHub workflow job summary showing accessibility violations, a violation table, and the highlighted screenshot](images/github-a11y-summary.webp)
```

### 6. Remove `docs/.vitepress/`

```bash
git rm -r docs/.vitepress/
```

### 7. Verify other content pages have no VitePress-specific frontmatter

Check `getting-started.md`, `writing-tests.md`, `visual-comparisons.md`, `configuration.md`, `development.md` — if any have VitePress frontmatter (e.g. `layout:`, `hero:`, `features:`), remove it. Based on plan context, these pages have no VitePress-specific frontmatter to remove.

</details>
