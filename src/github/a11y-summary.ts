import {
  generateA11yAnnotations,
  generateA11ySummary,
  parseA11yResults,
  runA11ySummary,
} from '@lullabot/playwright-testing/github'

export type {
  A11yReport,
  A11yTestResult,
} from '@lullabot/playwright-testing/github'

export {
  generateA11yAnnotations as generateAnnotations,
  generateA11ySummary as generateSummary,
  parseA11yResults,
}

/** Keep the Drupal-branded command name while delegating all behavior. */
export function main(args: string[] = process.argv.slice(2)): void {
  return runA11ySummary(args, {
    commandName: 'playwright-drupal-a11y-summary',
  })
}

// Preserve direct execution of the historical compiled module path.
if (require.main === module) {
  main()
}
