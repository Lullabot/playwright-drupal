---
id: 2
group: "static-docs-site"
dependencies: [1]
status: "pending"
created: 2026-04-12
skills:
  - markdown
  - typescript
---
# Content Migration: README to VitePress Pages

## Objective
Split the monolithic `README.md` into focused VitePress documentation pages, copy images to `docs/public/images/`, update all image references, and trim the `README.md` to the introductory content plus a link to the docs site.

## Skills Required
- Markdown authoring
- TypeScript (update VitePress sidebar config with correct file paths)

## Acceptance Criteria
- [ ] The following pages exist under `docs/` and contain the relevant README content:
  - `getting-started.md` (Requirements, How This Works, Docroot Auto-Detection, Getting Started steps)
  - `writing-tests.md` (Writing Tests, Recording tests in VS Code, Running Tests Without Isolation, Verbose CLI Output, Running Drush in Tests, Logging In)
  - `visual-comparisons.md` (Visual Comparisons section in full)
  - `configuration.md` (Configuration Helper section)
  - `github-actions.md` (GitHub Accessibility Annotations section)
  - `development.md` (Development section, Pull Request Commands)
- [ ] `docs/index.md` is a proper VitePress home page with hero text, the intro paragraph, the four feature bullet points, and the `demo.webp` image
- [ ] All three images (`demo.webp`, `github-a11y-summary.webp`, `a11y-violation-screenshot.webp`) are copied to `docs/public/images/`
- [ ] All image references in the docs Markdown use root-relative paths (`/images/demo.webp`)
- [ ] The sidebar in `docs/.vitepress/config.ts` is updated with correct file paths matching the created pages
- [ ] `README.md` is trimmed to: badges, `demo.webp` image, intro paragraph, four feature bullets, and a link to `https://lullabot.github.io/playwright-drupal/`
- [ ] `npm run docs:build` still passes with no errors after content migration

## Technical Requirements
- Image paths in VitePress Markdown must be root-relative (e.g. `/images/demo.webp`), not relative to the project root
- The `docs/index.md` home page should use VitePress frontmatter (`layout: home`, `hero`, `features`) for a polished landing page
- The README link to the docs site should read something like: "For full documentation, visit the [playwright-drupal docs site](https://lullabot.github.io/playwright-drupal/)."

## Input Dependencies
- Task 01 output: `docs/.vitepress/config.ts` (sidebar to update), `docs/index.md` (stub to replace)

## Output Artifacts
- `docs/index.md` (full home page)
- `docs/getting-started.md`
- `docs/writing-tests.md`
- `docs/visual-comparisons.md`
- `docs/configuration.md`
- `docs/github-actions.md`
- `docs/development.md`
- `docs/public/images/demo.webp`
- `docs/public/images/github-a11y-summary.webp`
- `docs/public/images/a11y-violation-screenshot.webp`
- Updated `docs/.vitepress/config.ts` sidebar
- Updated `README.md`

## Implementation Notes
- Preserve all code blocks, tables, and formatting exactly from the README — do not paraphrase
- The original `images/` directory at the project root should remain untouched (it's referenced by the GitHub README)
- The README `demo.webp` reference should stay as-is (`images/demo.webp`) since GitHub renders it from the repo root
