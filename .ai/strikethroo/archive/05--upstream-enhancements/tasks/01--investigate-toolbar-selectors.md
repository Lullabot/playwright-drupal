---
id: 1
group: "login-helper"
dependencies: []
status: "completed"
created: 2026-03-16
skills:
  - drupal-dom-research
  - web-inspector
---
# Investigate Toolbar Selectors for Login Helper

## Objective
Determine the correct CSS selectors for detecting a logged-in Drupal admin user that work with both the legacy Admin Toolbar module and the new Navigation module.

## Skills Required
- Drupal DOM structure knowledge (toolbar module vs Navigation module)
- Web research / documentation analysis

## Acceptance Criteria
- [ ] Identify the CSS selector(s) that indicate a logged-in admin when using Drupal's legacy `toolbar` module
- [ ] Identify the CSS selector(s) that indicate a logged-in admin when using Drupal's core Navigation module
- [ ] Determine a unified selector strategy (e.g., comma-separated selectors, body class, ARIA role) that works with both
- [ ] Document findings as a comment in this task file for the login helper implementation task to consume

## Technical Requirements
- Research Drupal core's toolbar module HTML output (the `#toolbar-administration` wrapper, `#toolbar-bar`, etc.)
- Research Drupal core's Navigation module HTML output (experimental, replacing toolbar)
- Prefer stable selectors: ARIA roles, `data-` attributes, or `body` classes over fragile element IDs
- The selectors will be used in a `Promise.race()` pattern: one locator for the toolbar/navigation element, one for the login form

## Input Dependencies
None — this is a research task.

## Output Artifacts
- Documented selector strategy that the login helper task (Task 5) will use
- A recommended approach for detecting "logged in" state that works across both admin UI modules

## Implementation Notes
- Check Drupal core source code for toolbar module templates: `core/modules/toolbar/templates/`
- Check Navigation module templates: `core/modules/navigation/templates/`
- The `body` element may have classes like `toolbar-fixed` or similar that indicate toolbar presence
- Consider using `page.locator('body.toolbar-fixed, body.admin-toolbar')` style composite selectors
- The reference implementation used `#admin-toolbar` which may not be correct for either module
