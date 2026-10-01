import {
  defuseMaskTriggers,
  generateFailureComment,
  generateFailureSummary,
  parseFailures,
  resolveImagePaths,
  runFailureSummary,
  uploaderFromEnvironment,
  uploadImages,
} from "@lullabot/playwright-testing/github";
import type {
  FailureCommentOptions,
  FailureReport,
} from "@lullabot/playwright-testing/github";

export type {
  FailedTest,
  FailureImage,
  FailureReport,
  ImageKind,
  IncludeMode,
  PathResolutionSummary,
  SummaryOptions,
} from "@lullabot/playwright-testing/github";

export {
  defuseMaskTriggers,
  generateFailureSummary as generateSummary,
  parseFailures,
  resolveImagePaths,
  uploaderFromEnvironment,
  uploadImages,
};

export const FAILURE_MARKER_PREFIX = "<!-- playwright-drupal-failures: ";
export const FLAKE_MARKER_PREFIX = "<!-- playwright-drupal-flakes: ";

/** Preserve the legacy machine-readable comment markers. */
export function generateComment(
  report: FailureReport,
  options: FailureCommentOptions = {},
): string {
  return generateFailureComment(report, {
    ...options,
    failureMarkerPrefix: options.failureMarkerPrefix ?? FAILURE_MARKER_PREFIX,
    flakeMarkerPrefix: options.flakeMarkerPrefix ?? FLAKE_MARKER_PREFIX,
  });
}

/** Keep the Drupal-branded CLI and markers while delegating implementation. */
export async function main(
  args: string[] = process.argv.slice(2),
): Promise<void> {
  return runFailureSummary(args, {
    commandName: "playwright-drupal-failure-summary",
    failureMarkerPrefix: FAILURE_MARKER_PREFIX,
    flakeMarkerPrefix: FLAKE_MARKER_PREFIX,
  });
}

// Preserve direct execution of the historical compiled module path.
if (require.main === module) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
