---
id: 5
group: "deployment"
dependencies: [1]
status: "pending"
created: 2026-04-12
skills:
  - docker
---
# Update Tugboat PR Preview Configuration

## Objective
Replace the `tugboatqa/node:24` Tugboat service configuration with `tugboatqa/httpd:2`, replacing the runit-based VitePress preview with a simple Apache static file server built from MkDocs output.

## Skills Required
- docker: Tugboat service configuration, container image selection

## Acceptance Criteria
- [ ] Service image changed to `tugboatqa/httpd:2`
- [ ] `expose: 3000` removed (Apache uses default port 80)
- [ ] `init` phase installs `uv` via curl installer
- [ ] `build` phase runs `uvx --with-requirements docs/requirements.txt mkdocs build --strict`
- [ ] `build` phase symlinks `site/` to `${DOCROOT}` (`/var/www/html`)
- [ ] All runit-related commands removed (no `mkdir /etc/service/node`, no `echo #!/bin/sh`, no `chmod`)
- [ ] `npm ci` and Node.js-based build steps removed

## Technical Requirements
- Tugboat image: `tugboatqa/httpd:2` (Apache-based, ships with Python 3)
- `${DOCROOT}` for `tugboatqa/httpd:2` is `/var/www/html`
- `uv` install command: `curl -LsSf https://astral.sh/uv/install.sh | sh`
- After installing uv via curl, the `uv` binary is at `$HOME/.cargo/bin/uv` or `$HOME/.local/bin/uv` — may need to source the env or use full path. Use `. $HOME/.local/bin/env` or add to PATH
- Symlink: `ln -snf ${TUGBOAT_ROOT}/site ${DOCROOT}`
- Service must be `default: true`

## Input Dependencies
- Task 1: `docs/requirements.txt` must exist

## Output Artifacts
- `.tugboat/config.yml` (replaced)

## Implementation Notes

<details>
<summary>Details</summary>

Replace `.tugboat/config.yml` entirely with:

```yaml
services:
  httpd:
    image: tugboatqa/httpd:2
    default: true

    commands:
      init:
        - curl -LsSf https://astral.sh/uv/install.sh | sh
        - echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc

      build:
        - export PATH="$HOME/.local/bin:$PATH" && uvx --with-requirements ${TUGBOAT_ROOT}/docs/requirements.txt mkdocs build --strict --config-file ${TUGBOAT_ROOT}/mkdocs.yml
        - ln -snf ${TUGBOAT_ROOT}/site ${DOCROOT}
```

Key points:
- The service name changes from `node` to `httpd` to match the image
- `expose: 3000` is removed — Apache on port 80 is automatically discovered by Tugboat via `${DOCROOT}`
- `uv` installs to `$HOME/.local/bin/uv` via the official shell installer
- The `uvx` command needs `PATH` to include `$HOME/.local/bin` — set it inline with `export PATH=...`
- `mkdocs build` must be run from the repo root or with `--config-file` pointing to `mkdocs.yml`
- The symlink replaces whatever is at `${DOCROOT}` with a link to the built `site/` directory
- No `npm ci` or Node.js commands needed — MkDocs build is pure Python

Note on uv PATH: Tugboat runs commands in a shell but doesn't source `.bashrc` between commands. Use `export PATH="$HOME/.local/bin:$PATH"` inline before the `uvx` call in the build phase, rather than relying on the `init` phase's `.bashrc` modification.

</details>
