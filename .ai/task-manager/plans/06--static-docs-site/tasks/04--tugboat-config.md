---
id: 4
group: "static-docs-site"
dependencies: [1]
status: "pending"
created: 2026-04-12
skills:
  - devops
---
# Tugboat PR Preview Configuration

## Objective
Create `.tugboat/config.yml` that builds the VitePress docs site using `tugboatqa/node:24` and serves the static output with `serve` for PR preview environments.

## Skills Required
- DevOps (Tugboat YAML configuration)

## Acceptance Criteria
- [ ] `.tugboat/config.yml` exists and is valid YAML
- [ ] Defines a single default service using `image: tugboatqa/node:24`
- [ ] `build` phase runs `npm ci` and `npm run docs:build`
- [ ] `serve` npm package is installed globally (or via `npx`) and used in the `online` phase to serve `docs/.vitepress/dist`
- [ ] The service is marked `default: true`
- [ ] The YAML is syntactically valid

## Technical Requirements
- Use `tugboatqa/node:24` as the image
- `serve` must be launched in the `online` lifecycle phase (not `build`) — the `online` phase keeps processes alive for the preview
- The git repo is cloned to `/var/lib/tugboat` by Tugboat; serve from `/var/lib/tugboat/docs/.vitepress/dist`
- Tugboat proxies the default service's exposed port — `serve` defaults to port 3000; confirm the port is correct or explicitly set it

## Input Dependencies
- Task 01 output: `docs:build` npm script defined in `package.json`

## Output Artifacts
- `.tugboat/config.yml`

## Implementation Notes
- The `.tugboat/config.yml` is inert until the repository owner connects the repo to a Tugboat account — it can be committed safely
- `serve` is a well-known static file server npm package; install with `npm install -g serve` in the `init` phase, then run `serve -s /var/lib/tugboat/docs/.vitepress/dist -l 3000` in `online`
- Tugboat's `online` phase is the correct place for long-running server processes
