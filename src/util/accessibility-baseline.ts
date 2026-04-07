export interface AccessibilityBaselineEntry {
  /** axe rule ID (e.g. 'color-contrast') */
  rule: string
  /** CSS selectors for the elements with this violation */
  targets: string[]
  /** Why this violation is accepted */
  reason: string
  /** Link to tracking ticket */
  willBeFixedIn: string
}

export type AccessibilityBaseline = AccessibilityBaselineEntry[]

export function defineAccessibilityBaseline(entries: AccessibilityBaseline): AccessibilityBaseline {
  return entries
}
