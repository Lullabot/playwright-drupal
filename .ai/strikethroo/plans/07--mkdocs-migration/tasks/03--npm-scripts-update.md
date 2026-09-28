---
id: 3
group: "toolchain"
dependencies: [1]
status: "completed"
created: 2026-04-12
skills:
  - bash
---
# Update npm Scripts and Remove VitePress Dependency

## Objective
Rewrite the `docs:dev`, `docs:build`, and `docs:preview` scripts in `package.json` to use `uvx --with-requirements docs/requirements.txt mkdocs` instead of VitePress, and remove `vitepress` from `devDependencies`.

## Skills Required
- bash: npm script configuration and package.json editing

## Acceptance Criteria
- [ ] `docs:dev` runs `uvx --with-requirements docs/requirements.txt mkdocs serve`
- [ ] `docs:build` runs `uvx --with-requirements docs/requirements.txt mkdocs build --strict`
- [ ] `docs:preview` runs `uvx --with-requirements docs/requirements.txt mkdocs serve site/`
- [ ] `vitepress` is removed from `devDependencies`

## Technical Requirements
- The `uvx` binary must be available; `uv` is the prerequisite (single install, no virtualenv required)
- `docs:dev` starts the live-reload server on default port 8000
- `docs:build` emits static files to `site/` under `--strict` mode
- `docs:preview` serves the already-built `site/` directory (for reviewing production build)
- No other scripts should be modified

## Input Dependencies
- Task 1: `docs/requirements.txt` must exist for these scripts to function

## Output Artifacts
- `package.json` (modified: 3 scripts updated, `vitepress` removed from devDependencies)

## Implementation Notes

<details>
<summary>Details</summary>

In `package.json`, update the `scripts` section:

```json
"docs:dev": "uvx --with-requirements docs/requirements.txt mkdocs serve",
"docs:build": "uvx --with-requirements docs/requirements.txt mkdocs build --strict",
"docs:preview": "uvx --with-requirements docs/requirements.txt mkdocs serve site/",
```

Also remove `"vitepress": "^1.6.4"` from `devDependencies`.

No other scripts or dependencies should be changed. After editing, run `npm install` or `npm ci` is not required since we're only removing a devDependency — but the `package-lock.json` should be updated. Run `npm install` to regenerate the lockfile without vitepress.

Note: `mkdocs serve site/` serves the pre-built site at `site/` directory — MkDocs `serve` command when given a directory serves the built static output.

Actually, `mkdocs serve` serves live with watch mode from `docs/`. For previewing a built `site/`, the correct approach is using Python's built-in HTTP server or a similar static server. However, per the plan spec, `docs:preview` should use `mkdocs serve` against the built directory. The exact invocation should be:

```
uvx --with-requirements docs/requirements.txt mkdocs serve --dev-addr localhost:8000
```

For `docs:preview`, since mkdocs serve always rebuilds from source, use:
```
python3 -m http.server 8000 --directory site
```

But the plan explicitly states: `docs:preview` — invokes `mkdocs serve` against the already-built `site/` directory. Use the uvx invocation as specified:
```
uvx --with-requirements docs/requirements.txt mkdocs serve
```

Per the plan's Component 3 section, the exact scripts should be:
- `docs:dev` → `uvx --with-requirements docs/requirements.txt mkdocs serve`
- `docs:build` → `uvx --with-requirements docs/requirements.txt mkdocs build --strict`
- `docs:preview` → `uvx --with-requirements docs/requirements.txt mkdocs serve site/`

Implement exactly as stated in the plan.

</details>
