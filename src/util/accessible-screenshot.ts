import AxeBuilder from '@axe-core/playwright';
import {expect, Locator, Page, TestInfo} from "@playwright/test";
import {waitForAllImages} from "./images";
import {waitForFrames} from "./frames"
import axe from 'axe-core';

interface ScreenshotOptions {
  /**
   * When set to `"disabled"`, stops CSS animations, CSS transitions and Web Animations. Animations get different
   * treatment depending on their duration:
   * - finite animations are fast-forwarded to completion, so they'll fire `transitionend` event.
   * - infinite animations are canceled to initial state, and then played over after the screenshot.
   *
   * Defaults to `"disabled"` that disables animations.
   */
  animations?: "disabled" | "allow";

  /**
   * When set to `"hide"`, screenshot will hide text caret. When set to `"initial"`, text caret behavior will not be
   * changed.  Defaults to `"hide"`.
   */
  caret?: "hide" | "initial";

  /**
   * When true, takes a screenshot of the full scrollable page, instead of the currently visible viewport. Defaults to
   * `false`.
   */
  fullPage?: boolean;

  /**
   * Specify locators that should be masked when the screenshot is taken. Masked elements will be overlaid with a pink
   * box `#FF00FF` (customized by `maskColor`) that completely covers its bounding box.
   */
  mask?: Array<Locator>;

  /**
   * Specify the color of the overlay box for masked elements, in
   * [CSS color format](https://developer.mozilla.org/en-US/docs/Web/CSS/color_value). Default color is pink `#FF00FF`.
   */
  maskColor?: string;

  /**
   * An acceptable ratio of pixels that are different to the total amount of pixels, between `0` and `1`. Default is
   * configurable with `TestConfig.expect`. Unset by default.
   */
  maxDiffPixelRatio?: number;

  /**
   * An acceptable amount of pixels that could be different. Default is configurable with `TestConfig.expect`. Unset by
   * default.
   */
  maxDiffPixels?: number;

  /**
   * Hides default white background and allows capturing screenshots with transparency. Not applicable to `jpeg` images.
   * Defaults to `false`.
   */
  omitBackground?: boolean;

  /**
   * When set to `"css"`, screenshot will have a single pixel per each css pixel on the page. For high-dpi devices, this
   * will keep screenshots small. Using `"device"` option will produce a single pixel per each device pixel, so
   * screenshots of high-dpi devices will be twice as large or even larger.
   *
   * Defaults to `"css"`.
   */
  scale?: "css" | "device";

  /**
   * An acceptable perceived color difference in the [YIQ color space](https://en.wikipedia.org/wiki/YIQ) between the
   * same pixel in compared images, between zero (strict) and one (lax), default is configurable with
   * `TestConfig.expect`. Defaults to `0.2`.
   */
  threshold?: number;

  /**
   * Time to retry the assertion for in milliseconds. Defaults to `timeout` in `TestConfig.expect`.
   */
  timeout?: number;
}

/**
 * Take a visual comparison, and also ensure there's no accessibility issues.
 *
 * @param page The Page fixture from the test.
 * @param testInfo The testInfo object from the test.
 * @param options Screenshot options from toHaveScreenshot().
 * @param scrollLocator A locator to ensure is visible before taking the screenshot.
 * @param locator A specific locator to take the screenshot of. aXe still checks the whole page.
 */
export async function takeAccessibleScreenshot(page: Page, testInfo: TestInfo, options?: ScreenshotOptions, scrollLocator?: Locator, locator?: Locator|Page)  {
  if (!options) {
    options = {}
  }

  // The default is 5 seconds. However, even on a fast machine it can take
  // longer than 5 seconds for large pages like node forms to stabilize. This
  // doesn't affect end users because the page still being rendered is
  // typically below the viewport, and it's loaded by the time they scroll.
  // So, we set this to at least 10 seconds, unless it's already larger.
  // To test changing this, try running this command and see if it times out:
  options.timeout = Math.max(options.timeout ?? 0, 10000)

  // Handle browsers that have strongly non-deterministic rendering of images.
  if (testInfo.project.name == 'desktop firefox') {
    options.threshold = 0.5;
  }
  if (testInfo.project.name == 'desktop safari') {
    options.threshold = 0.8;
  }

  await waitForAllImages(page);
  await waitForFrames(page);

  if (scrollLocator) {
    await scrollLocator.scrollIntoViewIfNeeded();
  }

  let locatorToScreenshot: Page|Locator = page;
  if (locator) {
    locatorToScreenshot = locator;
  }
  // Soft failure here so we can get accessibility violations too.
  await expect.soft(locatorToScreenshot).toHaveScreenshot(options);

  const accessibilityScanResults = await new AxeBuilder({ page })
    .withTags(['best-practice'])
    // Exclude "Skip to main content" anchor. See https://dequeuniversity.com/rules/axe/4.7/region?application=playwright
    .exclude('.focusable.skip-link')
    // Exclude duplicated landmarks. See https://dequeuniversity.com/rules/axe/4.7/landmark-unique?application=playwright
    .exclude('[role="article"]')
    .exclude('[role="region"]')
    .exclude('.footer__inner-3')
    .analyze();

  await testInfo.attach('a11y-best-practice-scan-results', {
    body: JSON.stringify(accessibilityScanResults, null, 2),
    contentType: 'application/json'
  });

  expect.soft(violationFingerprints(accessibilityScanResults)).toMatchSnapshot();

  const wcagScanResults = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .exclude('[data-drupal-media-preview="ready"]')
    .analyze();

  await testInfo.attach('a11y-wcag-scan-results', {
    body: JSON.stringify(wcagScanResults, null, 2),
    contentType: 'application/json'
  });

  return expect(violationFingerprints(wcagScanResults)).toMatchSnapshot();
}

/**
 * Filter violations down to stable elements.
 *
 * If we try to create a snapshot of the entire report, it will fail on random
 * unique HTML IDs.
 *
 * @param accessibilityScanResults
 */
function violationFingerprints(accessibilityScanResults: axe.AxeResults) {
  const uniqueHtmlID = /(#.*)--\d+/
  const ariaLabelledById = /(aria-labelledby="[^"]+)--\d+"/
  const violationFingerprints = accessibilityScanResults.violations.map(violation => ({
    rule: violation.id,
    // These are CSS selectors which uniquely identify each element with
    // a violation of the rule in question.
    targets: violation.nodes.map(node => node.target.map((target) => {
      // If the violation is within an iframe, the target may be an array.
      if (typeof target == "string") {
        return target.replace(uniqueHtmlID, "$1--UNIQUE-ID")
          .replace(ariaLabelledById, '$1--UNIQUE-ID"');
      }
      return target;
    })),
  }));

  return JSON.stringify(violationFingerprints, null, 2);

}
