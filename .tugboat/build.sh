#!/usr/bin/env bash
set -euo pipefail

export PATH="$HOME/.local/bin:$PATH"

cd "${TUGBOAT_ROOT}"

# Pull the published docs (all versions) from gh-pages so the version
# dropdown is populated in the preview. We download a tarball over
# HTTPS rather than `git fetch`-ing because the build container has no
# SSH credentials for the configured `git@github.com:…` remote.
GH_PAGES_TARBALL="https://codeload.github.com/Lullabot/playwright-drupal/tar.gz/refs/heads/gh-pages"
rm -rf "${TUGBOAT_ROOT}/site"
mkdir -p "${TUGBOAT_ROOT}/site"
curl -fsSL "${GH_PAGES_TARBALL}" | tar -xz --strip-components=1 -C "${TUGBOAT_ROOT}/site"

# Build this preview's docs into their own version directory alongside
# the published versions.
PREVIEW_VERSION="preview-${TUGBOAT_PREVIEW_ID:-local}"
export PREVIEW_VERSION
uvx --with-requirements "${TUGBOAT_ROOT}/docs/requirements.txt" \
  mkdocs build --strict \
  --config-file "${TUGBOAT_ROOT}/mkdocs.yml" \
  --site-dir "${TUGBOAT_ROOT}/site/${PREVIEW_VERSION}"

# Add the preview to versions.json and make it the landing page so
# reviewers see the PR's changes first.
python3 - <<'PY'
import json, os
site = os.path.join(os.environ["TUGBOAT_ROOT"], "site")
preview = os.environ["PREVIEW_VERSION"]

versions_path = os.path.join(site, "versions.json")
with open(versions_path) as f:
    versions = json.load(f)
versions = [v for v in versions if v["version"] != preview]
versions.insert(0, {"version": preview, "title": f"{preview} (this PR)", "aliases": []})
with open(versions_path, "w") as f:
    json.dump(versions, f, indent=2)

with open(os.path.join(site, "index.html"), "w") as f:
    f.write(
        '<!DOCTYPE html><html><head>'
        f'<meta http-equiv="refresh" content="0; url={preview}/">'
        f'</head><body><a href="{preview}/">{preview}</a></body></html>'
    )
PY
