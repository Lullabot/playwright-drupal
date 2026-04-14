# Visual Comparisons (Diffs)

Playwright Visual Comparisons are a great way to add additional assertions to your tests. Since visual comparisons are integrated into the testing system, developers can compare all aspects of a site - including content forms or other authenticated content.

We've found that taking a screenshot for a visual comparison is a great point to check for accessibility issues. Unlike other steps in a test, a visual comparison is specifically declaring that the page is ready for human consumption. For standalone accessibility testing without visual comparisons, see [Accessibility Testing](accessibility.md).

The `takeAccessibleScreenshot()` method will:

1. Ensure that complex pages like node forms have time to stabilize before taking screenshots.
2. Handle browsers that have non-deterministic rendering of images (in particular, WebP) and allow for minute pixel differences in images that are not observable by a human.
3. Automatically trigger loading of all lazy-loaded images.
4. Automatically trigger loading of all lazy-loaded iframes.
5. Generate an accessibility report of the element being tested.

The accessibility reports save a JSON object with all accessibility failures. Commit these to your repository to mark those failures as ignored. Pages with no failures will generate a report with an empty array (`[]`).

## Visual Comparisons for Static Content

The above workflow is great for testing after creating or editing content. However, teams may also want visual comparisons purely of the front-end. In that case, there's no concurrency issues (every request can use the same Drupal database), and often the content itself comes from a test website whose database has been copied down.

The `VisualDiffTestCases` class scaffolds out support for this use case, including:

- The ability to define a configuration file of URLs to test.
- Grouping of related tests for better reporting.
- The ability to skip specific tests. This is useful when a test is added and later determined to be flaky.
- Links to related content, such as a link to a production URL similar to the tested content, or a ticket for fixing the underlying reason behind a skipped test.

To set up visual comparisons this way:

1. Create a file at `test/playwright/src/visualdiff-urls.ts` to hold pages to compare. Here is an example using the Drupal Umami install profile.

```typescript
import { defineVisualDiffConfig } from '@packages/playwright-drupal';

export const config = defineVisualDiffConfig({
  name: "Umami Visual Diffs",
  description: "Execute a series of visual diffs against the Umami site.",
  groups: [
    {
      name: "Landing Pages",
      description: "Pages built with Layout Builder and Views.",
      // There isn't a stable link to a running copy of the Umami profile, but
      // imagine this goes to a production website.
      representativeUrl: "https://drupal.org/...",
      testCases: [
        {
          name: "Home Page",
          path: "/",
        },
        {
          name: "Articles",
          path: "/en/articles",
        },
        {
          name: "Recipes",
          path: "/en/recipes",
        },
        {
          name: "Alternate Recipe View",
          path: "/en/recipes-alt",
          skip: {
            reason: "The recipes are listed in random order",
            willBeFixedIn: "https://drupal.org/node/12345",
          }
        }
      ]
    }
  ],
});
```

2. Create a test file at `test/playwright/tests/visualdiff/visualdiffs.spec.ts`:

```typescript
import {config} from '~/visualdiff-urls';

config.describe();
```

3. Update the Playwright configuration to skip these tests in normal functional tests, and skip normal functional tests when running these tests.

For all existing tests, add `testIgnore` like so:

```typescript
{
  name: 'desktop chrome',
  testIgnore: '/visualdiff/*',
  use: { ...devices['Desktop Chrome'] },
},
```

Then, add the following as projects to run the new visual diffs, editing as needed.

```typescript
{
  name: 'visualdiff-desktop',
  testMatch: '/visualdiff/*',
  use: { baseURL: "https://<MYPROJECT>.ddev.site/", ...devices['Desktop Chrome'] },
},
{
  name: 'visualdiff-tablet',
  testMatch: '/visualdiff/*',
  use: { baseURL: "https://<MYPROJECT>.ddev.site/", ...devices['Galaxy Tab S4'] },
},
{
  name: 'visualdiff-phone',
  testMatch: '/visualdiff/*',
  use: { baseURL: "https://<MYPROJECT>.ddev.site/", ...devices['Pixel 5'] },
},
```
Now, you can run just these tests with a command like:

```console
# Run all visual diff tests, using path matching.
ddev playwright test -- tests/visualdiff
```

```console
# Run all tests, but only at desktop.
ddev playwright --project 'visualdiff-desktop'
```

## Including the Visual Comparison Drupal Database as a Fixture

It's important that the database with the content is tied to version control somehow. Otherwise, changes to content will yield false failures and developer tears. Since every site is different, we don't automatically set this up in this project. However, if you are using [lullabot/drainpipe](https://github.com/lullabot/drainpipe), you likely already have much of this wired up. Otherwise, consider adding something like the following to the end of your `playwright:install:hook` task:

```yaml
# Now set up the Visual Comparison database.
unset PLAYWRIGHT_SETUP

# Remove any old databases from prior checkouts.
rm -f .private/databases/MYSITE-live_*_database.sql.gz

# Create the directory for first-runs.
mkdir -p ./private/databases

# Copy the database to the expected location before refreshing the site.
cp ./test/playwright/tests/visualdiff/fixtures/MYSITE-live_*_database.sql.gz ./private/databases/

# Restore the database, but don't download a new one, and don't enable
# development dependencies.
# "refresh" should be the command that imports the database, runs database
# updates, and so on.
task refresh site=@mysite no_fetch=1 production_mode=1

# Enable Stage File Proxy for images.
./vendor/bin/drush @mysite -y en stage_file_proxy
```

## Replacing the Test Case With Your Own

The describe() function can optionally take a replacement test function. This is useful if you need to mock HTTP responses or add other custom logic.

```typescript
import {config} from '~/visualdiff-urls';
import {defaultTestFunction, VisualDiff, VisualDiffGroup} from "@packages/playwright-drupal";
import {test, TestInfo} from "@playwright/test";

/**
 * Skips Firefox on /en/articles.
 */
const skipFirefox = function (testCase: VisualDiff, group: VisualDiffGroup) {
  const defaultFunction = defaultTestFunction(testCase, group);
  return async ({page, context, browserName}, testInfo: TestInfo) => {
    test.skip(browserName == 'firefox' && testCase.path == '/en/articles', 'Skip Firefox as we are trying to save CI budget.');
    await defaultFunction({page, context}, testInfo);
  };
}

config.describe(skipFirefox);
```

```typescript
import {config} from '~/visualdiff-urls';
import {defaultTestFunction, VisualDiff, VisualDiffGroup} from "@packages/playwright-drupal";
import {TestInfo} from "@playwright/test";

/**
 * Mirror all console messages to the Playwright console, even if they aren't
 * errors.
 */
const consoleLoggingTestFunction = function (testCase: VisualDiff, group: VisualDiffGroup) {
  const defaultFunction = defaultTestFunction(testCase, group);
  return async ({page, context}, testInfo: TestInfo) => {
    context.on('console', (message) => {
      console.log(message.text());
    });

    await defaultFunction({page, context}, testInfo);
  };
}

config.describe(consoleLoggingTestFunction);
```

## Mocking Iframe Content

External iframes (such as YouTube embeds) load third-party content that changes independently of your site, causing non-deterministic screenshots in visual diff tests. The `mockClass` property on test cases allows you to intercept and replace these requests with stable placeholder content.

### Using the Built-in YouTube Mock

```typescript
import { defineVisualDiffConfig } from '@packages/playwright-drupal';
import { YoutubeMock } from '@packages/playwright-drupal';

export const config = defineVisualDiffConfig({
  name: "MySite Visual Diffs",
  groups: [
    {
      name: "Landing Pages",
      testCases: [
        {
          name: "About Us",
          path: "/about-us",
          mockClass: YoutubeMock,
        }
      ]
    }
  ],
});
```

When `mockClass` is set, the mock's `mock(page)` method is called before the page navigates to the test URL. `YoutubeMock` intercepts all requests to `www.youtube.com` and returns a simple HTML placeholder, ensuring consistent screenshots regardless of YouTube's actual content.

### Creating a Custom Mock

Any class implementing the `Mockable` interface can be used with `mockClass`. The interface requires a single method:

```typescript
import { Page } from '@playwright/test';
import { Mockable } from '@packages/playwright-drupal';

export class VimeoMock implements Mockable {
  public async mock(page: Page): Promise<void> {
    await page.route(/player\.vimeo\.com/i, async route => {
      await route.fulfill({
        contentType: 'text/html',
        body: '<html><body><div>Vimeo Mock</div></body></html>',
      });
    });
  }
}
```

Use Playwright's [`page.route()`](https://playwright.dev/docs/api/class-page#page-route) to intercept requests matching a URL pattern and return deterministic content via `route.fulfill()`.

## Masking Dynamic Elements

Some elements change over time independently of your code — copyright years, timestamps, or live counters. These cause false snapshot failures. You can mask such elements by providing CSS selectors at any level of the visual diff configuration. Masked elements are covered with an overlay box (pink `#FF00FF` by default) in the screenshot.

Masks defined at multiple levels are merged together, so you can set global masks on the config and add more at the group or test-case level.

```typescript
import { defineVisualDiffConfig } from '@packages/playwright-drupal';

export const config = defineVisualDiffConfig({
  name: "MySite Visual Diffs",
  // Global masks applied to every screenshot.
  mask: ['.footer__copyright-year'],
  groups: [
    {
      name: "Landing Pages",
      // Additional masks for this group, merged with the global masks.
      mask: ['.live-counter'],
      testCases: [
        {
          name: "Home Page",
          path: "/",
        },
        {
          name: "Events",
          path: "/events",
          // Test-case masks are also merged with config and group masks.
          mask: ['.event-countdown'],
        },
      ]
    }
  ],
});
```

In this example, the "Events" screenshot will mask `.footer__copyright-year`, `.live-counter`, and `.event-countdown`. The "Home Page" screenshot will mask `.footer__copyright-year` and `.live-counter`.

You can also override the mask overlay color at any level. The most specific level wins (test case > group > config):

```typescript
{
  name: "MySite Visual Diffs",
  mask: ['.copyright-year'],
  maskColor: '#000000',  // Black overlay globally
  groups: [
    {
      name: "Landing Pages",
      maskColor: '#333333',  // Dark gray for this group
      testCases: [
        {
          name: "Home Page",
          path: "/",
          maskColor: '#666666',  // Lighter gray for this specific test
        },
      ]
    }
  ],
}
```

Selectors that don't match any element on the page are silently ignored — no error is thrown.

**Note:** When using a custom test function via `config.describe(myTestFunction)`, automatic mask merging is bypassed. Your custom function is responsible for applying masks itself.

## Snapshot Storage

Commiting screenshots to your project repository is the easiest way to save and compare them. However, projects with many snapshots or design changes may lead to significant churn on the snapshots, which can cause [git repository size to grow significantly](https://www.lullabot.com/articles/how-calculate-git-repository-growth-over-time). Instead of committing snapshots directly to your project, consider:

- Using [git-lfs](https://docs.github.com/en/repositories/working-with-files/managing-large-files/configuring-git-large-file-storage) to store snapshots (and even static assets like databases and images).
- Using a third-party service integrated with Playwright to upload snapshots for storage and comparison.
