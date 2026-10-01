export interface AccessibilityBaselineEntry {
  /** axe rule ID (e.g. 'color-contrast') */
  rule: string;
  /** CSS selectors for the elements with this violation */
  targets: string[];
  /** Why this violation is accepted */
  reason: string;
  /** Link to tracking ticket */
  willBeFixedIn: string;
}

export type AccessibilityBaseline = AccessibilityBaselineEntry[];

export function defineAccessibilityBaseline(
  entries: AccessibilityBaseline,
): AccessibilityBaseline {
  validateAccessibilityBaseline(entries);
  return entries;
}

/**
 * Validate waiver metadata and reject ambiguous duplicate entries.
 *
 * Seed files deliberately contain TODO placeholders, so callers validate only
 * committed/in-code baselines, not a seed during the local creation run.
 */
export function validateAccessibilityBaseline(
  entries: AccessibilityBaseline,
): void {
  const seen = new Set<string>();

  entries.forEach((entry, index) => {
    if (!entry.rule.trim()) {
      throw new Error(
        `Accessibility baseline entry ${index + 1} requires a rule.`,
      );
    }
    if (
      entry.targets.length === 0 ||
      entry.targets.some((target) => !target.trim())
    ) {
      throw new Error(
        `Accessibility baseline entry ${index + 1} requires at least one non-empty target.`,
      );
    }
    if (!entry.reason.trim() || entry.reason.trim().toUpperCase() === "TODO") {
      throw new Error(
        `Accessibility baseline entry ${index + 1} requires a reason.`,
      );
    }
    if (
      !entry.willBeFixedIn.trim() ||
      entry.willBeFixedIn.trim().toUpperCase() === "TODO"
    ) {
      throw new Error(
        `Accessibility baseline entry ${index + 1} requires a willBeFixedIn tracking reference.`,
      );
    }

    for (const target of new Set(entry.targets)) {
      const key = JSON.stringify([entry.rule, target]);
      if (seen.has(key)) {
        throw new Error(
          `Accessibility baseline contains a duplicate waiver for ${entry.rule} on ${target}.`,
        );
      }
      seen.add(key);
    }
  });
}
