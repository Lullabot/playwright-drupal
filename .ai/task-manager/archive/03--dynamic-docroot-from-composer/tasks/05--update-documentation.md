---
id: 5
group: "documentation"
dependencies: [1, 2, 3]
status: "completed"
created: "2026-03-10"
skills:
  - documentation
---
# Update README to document auto-detected docroot

## Objective
Update `README.md` to note that the docroot is auto-detected from `composer.json` and remove any language that assumes `web/` is the only option.

## Skills Required
- Documentation: Markdown editing, clear technical writing

## Acceptance Criteria
- [ ] README mentions that the docroot is auto-detected from `extra.drupal-scaffold.locations.web-root` in `composer.json`
- [ ] Any instructions that hardcode `web/` are updated to be generic or note the auto-detection
- [ ] The fallback behavior (defaults to `web` if key is missing) is documented

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- Markdown

## Input Dependencies
- Tasks 1-3 must be complete so documentation accurately reflects the implementation.

## Output Artifacts
- Updated `README.md`

## Implementation Notes

<details>
<summary>Detailed implementation guidance</summary>

### What to update
Read the current `README.md` and look for:
1. Any mention of `web/` as a hardcoded path assumption
2. Setup instructions that reference the docroot
3. A good place to add a note about auto-detection (likely near the setup/configuration section)

### What to add
Add a brief note explaining:
- playwright-drupal automatically detects the docroot from `composer.json`'s `extra.drupal-scaffold.locations.web-root`
- No configuration is needed — it works with `web/`, `docroot/`, or any named directory
- If the key is missing, it defaults to `web`

Keep it concise — one paragraph or a small callout section is sufficient.

</details>
