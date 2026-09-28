---
id: 1
group: "mkdocs-setup"
dependencies: []
status: "completed"
created: 2026-04-12
skills:
  - python
---
# Create Python Dependency Manifest

## Objective
Create `docs/requirements.txt` with pinned versions of `mkdocs`, `mkdocs-material`, and `mike` to serve as the single source of truth for the Python toolchain across CI, Tugboat, and local development.

## Skills Required
- python: Python dependency management and package pinning

## Acceptance Criteria
- [ ] `docs/requirements.txt` exists with pinned versions for `mkdocs`, `mkdocs-material`, and `mike`
- [ ] Versions use exact pins (`==`) not ranges

## Technical Requirements
- Use exact version pins (`==`) for reproducible builds
- Versions to use:
  - `mkdocs==1.6.1`
  - `mkdocs-material==9.5.50`
  - `mike==2.1.3`

## Input Dependencies
None.

## Output Artifacts
- `docs/requirements.txt`

## Implementation Notes

<details>
<summary>Details</summary>

Create `docs/requirements.txt` at the path `docs/requirements.txt` relative to the repository root. The file should contain exactly:

```
mkdocs==1.6.1
mkdocs-material==9.5.50
mike==2.1.3
```

These are the pinned versions that will be referenced by:
1. `npm run docs:*` scripts via `uvx --with-requirements docs/requirements.txt`
2. The GitHub Actions workflow via `pip install -r docs/requirements.txt`
3. The Tugboat build phase via `uvx --with-requirements docs/requirements.txt`

</details>
