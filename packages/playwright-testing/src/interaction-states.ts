import type { Locator } from "@playwright/test";

/** Real browser interaction states supported consistently by Playwright. */
export type InteractionState = "hover" | "focus";

/** A locator and the real browser interaction states to apply to it. */
export interface ScreenshotInteractionState {
  locator: Locator;
  states: InteractionState[];
}

export interface InteractionStateCleanupOptions {
  /** Move the pointer away from the hovered locator during cleanup. */
  clearHover?: () => Promise<void>;
}

/** Validate that the requested states are possible with real browser input. */
export function validateInteractionStates(
  interactionStates: ScreenshotInteractionState[],
): void {
  const hoverTargets = interactionStates.filter(({ states }) =>
    states.includes("hover"),
  );
  const focusTargets = interactionStates.filter(({ states }) =>
    states.includes("focus"),
  );

  if (hoverTargets.length > 1) {
    throw new Error(
      "interactionStates can hover at most one locator at a time.",
    );
  }
  if (focusTargets.length > 1) {
    throw new Error(
      "interactionStates can focus at most one locator at a time.",
    );
  }
  for (const { states } of interactionStates) {
    if (new Set(states).size !== states.length) {
      throw new Error(
        "interactionStates cannot repeat a state for the same locator.",
      );
    }
  }
}

/**
 * Apply real hover and focus, returning an idempotent cleanup function.
 *
 * Hover is applied before focus so focusing cannot disturb the pointer. If an
 * interaction fails, any state already applied is cleaned before the original
 * error is rethrown.
 */
export async function applyInteractionStates(
  interactionStates: ScreenshotInteractionState[],
  cleanupOptions: InteractionStateCleanupOptions = {},
): Promise<() => Promise<void>> {
  validateInteractionStates(interactionStates);

  const hoverTarget = interactionStates.find(({ states }) =>
    states.includes("hover"),
  )?.locator;
  const focusTarget = interactionStates.find(({ states }) =>
    states.includes("focus"),
  )?.locator;
  let hoverApplied = false;
  let focusApplied = false;
  let cleaned = false;

  const cleanup = async () => {
    if (cleaned) {
      return;
    }
    cleaned = true;
    try {
      if (focusApplied) {
        await focusTarget?.blur();
      }
    } finally {
      if (hoverApplied) {
        await cleanupOptions.clearHover?.();
      }
    }
  };

  try {
    if (hoverTarget) {
      // Mark the state first: Playwright can move the pointer and then fail
      // while waiting for actionability, and that partial effect still needs
      // cleanup.
      hoverApplied = true;
      await hoverTarget.hover();
    }
    if (focusTarget) {
      focusApplied = true;
      await focusTarget.focus();
    }
    return cleanup;
  } catch (error) {
    try {
      await cleanup();
    } catch {
      // Preserve the interaction failure. Cleanup is best effort on this path;
      // callers cannot act on a cleanup error if applying the state failed.
    }
    throw error;
  }
}
