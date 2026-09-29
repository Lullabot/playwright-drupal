export {
  generateAnnotations as generateA11yAnnotations,
  generateSummary as generateA11ySummary,
  main as runA11ySummary,
  parseA11yResults,
} from './a11y-summary'
export type { A11yReport, A11yTestResult } from './a11y-summary'

export * from './attachments'

export {
  FAILURE_MARKER_PREFIX,
  FLAKE_MARKER_PREFIX,
  defuseMaskTriggers,
  generateComment as generateFailureComment,
  generateSummary as generateFailureSummary,
  main as runFailureSummary,
  parseFailures,
  resolveImagePaths,
  uploaderFromEnvironment,
  uploadImages,
} from './failure-summary'
export type {
  FailedTest,
  FailureImage,
  FailureReport,
  FailureCommentOptions,
  FailureSummaryMainOptions,
  ImageKind,
  IncludeMode,
  PathResolutionSummary,
  SummaryOptions,
} from './failure-summary'

export * from './report-paths'
