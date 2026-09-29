---
id: 2
group: "generic-extraction"
dependencies: [1]
status: "pending"
created: 2026-09-29
skills:
  - playwright-browser-automation
  - typescript-refactoring
complexity_score: 5
---
# Extract Neutral Screenshot Stabilization

## Objective
Move the reusable font, image, frame, video, hover, focus, interaction-state, and pseudo-state behavior into the generic workspace with neutral defaults and deterministic cleanup.

## Skills Required
Use Playwright browser-context scripting and TypeScript API-preserving refactoring.

## Acceptance Criteria
- [ ] Generic source owns font readiness, image loading/decoding, lazy iframe activation, video settling/restoration, hover clearing, focus blurring, interaction states, and pseudo-state forcing.
- [ ] Generic defaults contain no Drupal toolbar selectors, Drupal project-name checks, or `playwrightDrupal` browser state identifiers.
- [ ] Adapter-facing options or hooks are limited to what later Drupal wrappers require for toolbar settling or legacy behavior.
- [ ] Existing focused tests are moved or adapted and cover successful settling plus cleanup/restoration failure paths.
- [ ] `npm test --workspace=@lullabot/playwright-testing -- --run` and `npm run build --workspace=@lullabot/playwright-testing` exit 0.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
Extract from `src/util/fonts.ts`, `images.ts`, `frames.ts`, `videos.ts`, `focus.ts`, `hover.ts`, and `pseudo-state.ts` with their meaningful tests. Neutralize internal DOM element names and saved-video keys. Preserve Playwright page/frame traversal and original playback restoration semantics. Image request recovery or source rewriting must be opt-in if it mutates page state.

## Input Dependencies
Task 1's generic workspace shell and the existing root utilities/tests.

## Output Artifacts
Generic stabilization modules, public exports, configuration points needed by a Drupal preset, and focused integration-style tests.

## Implementation Notes

<details>
<summary>Execution guidance</summary>

1. Copy then adapt the reusable modules into `packages/playwright-testing/src`, retaining cohesive utility filenames or a clear `stabilization/` boundary.
2. Replace Drupal-branded injected element names and `__playwrightDrupalVideoState` with neutral package-owned names. Avoid page globals when a DOM-local symbol/property remains necessary, and always delete temporary state during restoration.
3. Convert hard-coded toolbar waits in image/video settling into an optional callback or selector/delay option whose generic default does nothing. Keep scrolling and playback restoration in `finally`-safe flows.
4. Ensure lazy frames are activated, images are loaded and decoded, fonts reach readiness, videos settle at deterministic frames across nested frames, and the original video state is restored.
5. Move or adapt the existing tests. Prefer browser-facing orchestration behavior and error cleanup over tests of trivial forwarding functions.
6. Export the public utilities from the generic package root. Do not change root Drupal exports yet; task 6 owns compatibility wiring.
</details>

