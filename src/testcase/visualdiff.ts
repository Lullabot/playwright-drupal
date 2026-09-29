import {
  VisualDiffTestCases as GenericVisualDiffTestCases,
  defaultTestFunction as genericDefaultTestFunction,
  type VisualDiff,
  type VisualDiffGroup,
  type VisualDiffPreset,
  type VisualDiffUrlConfig,
} from '@lullabot/playwright-testing'

import { createDrupalScreenshotOptions } from '../drupal-preset'

export type {
  BaseVisualDiff,
  Mockable,
  MockableConstructor,
  SkipTest,
  VisualDiff,
  VisualDiffExecutionContext,
  VisualDiffGroup,
  VisualDiffInteractionState,
  VisualDiffPreset,
  VisualDiffUrlConfig,
} from '@lullabot/playwright-testing'

/** Drupal behavior injected without changing the generic visual defaults. */
export const drupalVisualDiffPreset: VisualDiffPreset = {
  screenshotOptions: ({ testInfo }) => createDrupalScreenshotOptions(testInfo),
}

export function defineVisualDiffConfig(cases: VisualDiffUrlConfig) {
  return new VisualDiffTestCases(cases)
}

export function defaultTestFunction(
  testCase: VisualDiff,
  group: VisualDiffGroup,
  config?: VisualDiffUrlConfig,
) {
  return genericDefaultTestFunction(testCase, group, config, drupalVisualDiffPreset)
}

/** Legacy class name backed by the generic implementation and Drupal preset. */
export class VisualDiffTestCases extends GenericVisualDiffTestCases {
  constructor(config: VisualDiffUrlConfig) {
    super(config, drupalVisualDiffPreset)
  }
}
