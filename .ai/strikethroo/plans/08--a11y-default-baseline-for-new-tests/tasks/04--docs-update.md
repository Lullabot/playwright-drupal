---
id: 4
group: "documentation"
dependencies: [2]
status: "completed"
created: 2026-04-14
skills:
  - documentation
---
# Update README, AGENTS, and Claude skill docs for the new default

## Objective
Document the behavioural change so library consumers and assistants know: (a) new tests default to baseline mode with an on-disk JSON file, (b) existing tests with snapshots behave unchanged, (c) `--update-snapshots` opts a new test into snapshot mode, (d) CI writes the seeded file but fails the test so it must be committed.

## Skills Required
- `documentation` — Markdown edits, clear examples, no code changes.

## Acceptance Criteria
- [ ] Top-level `README.md` accessibility section explains the new default dispatch (snapshot exists → snapshot mode; otherwise → baseline mode with on-disk JSON), the JSON file's object schema (`{ note, violations }`), the location convention (alongside snapshots, projectless, per-call counter), and the `--update-snapshots` opt-out to snapshot mode.
- [ ] README explicitly states the CI behaviour: on `CI=1`, the dispatch seeds the file AND fails the test; developer must download the artifact (or re-run locally) and commit it.
- [ ] README mentions that auto-seeded entries contain placeholder `TODO` values for `reason` and `willBeFixedIn` that must be filled in before merge.
- [ ] `AGENTS.md` (and any `.claude/skills/*` entry covering a11y testing) is updated with the same information in short form so assistants don't regenerate stale guidance.
- [ ] A short changelog/release-notes entry is added (e.g. `CHANGELOG.md` if the repo has one, otherwise a brief section in README covering the behavioural change and backwards-compat story).
- [ ] Docs mention that the best-practice scan participates in the same dispatch and uses a separate `.a11y-baseline-best-practice.json` file.

## Technical Requirements
- Update only Markdown. Do not touch source or tests.
- Match the existing tone and heading structure of the README a11y section.
- If an MkDocs site is configured (`mkdocs.yml` in repo root), update the relevant page there too.

## Input Dependencies
- Task 2's dispatch is implemented (so docs describe what the code actually does). Docs can be written in parallel with task 3 (tests).

## Output Artifacts
- Updated `README.md` (a11y section).
- Updated `AGENTS.md` and any relevant `.claude/skills/*` files.
- Changelog entry (existing file or new section).
- MkDocs page update if applicable.

## Implementation Notes

<details>

**Anchor the docs on the user-facing mental model**, not the internal branches:

> "Accessibility violations are pinned in one of two ways: a Playwright snapshot (the old default) or a JSON baseline file with a human-readable `note` and a `violations` array. As of this change, new tests default to the baseline file; existing tests keep their snapshots. Run with `--update-snapshots` to create a snapshot for a new test instead."

**Include a short FAQ** covering the likely questions:
- "My test passed locally but failed on CI — why?" → CI seeded the baseline file; download the artifact from the CI run and commit it.
- "Why do I have `TODO` values in my baseline file?" → They're placeholders; fill them in with the real reason and the ticket/milestone where the violation will be fixed before merging.
- "Can I still use `defineAccessibilityBaseline()` in code?" → Yes, unchanged; in-code baselines always take precedence.

**Assistant docs** (`AGENTS.md`, `.claude/skills/*`) should be terse — a few lines pointing at the README with the key invariants.

No need to inline the full decision tree in user-facing docs; keep that in the plan.

</details>
