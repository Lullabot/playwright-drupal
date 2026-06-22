import {Page} from "@playwright/test";

/**
 * Wait for images specified by a selector to load.
 *
 * The function must scroll the page to handle lazy-loading images. After all
 * images have loaded, the page is scrolled back to the top.
 *
 * See https://github.com/microsoft/playwright/issues/14388 for further details.
 *
 * @param page
 * @param selector
 */
export async function waitForImages(page: Page, selector: string): Promise<void> {
  const locators = page.locator(selector);

  // Trigger lazy-loading images. Since this should be fast, and we don't want to
  // have to deal with concurrency bugs, we do this in serial.
  for (const l of await locators.all()) {
    // Ensure images are connected to the DOM before trying to scroll to them.
    // https://github.com/microsoft/playwright/issues/23758
    if (await l.evaluate(image => image.isConnected)) {
      await l.scrollIntoViewIfNeeded();
    }
  }

  // Make sure all images have loaded.
  // @ts-ignore
  const promises = (await locators.all()).map(locator => locator.evaluate(image => {
    // Make sure 1x1 images that are visually hidden for accessibility (like
    // on the Umami home page) don't hang waiting for the image to load. Even
    // though the images are :visible, Chrome doesn't load the image at desktop
    // widths.
    // See https://www.tpgi.com/the-anatomy-of-visually-hidden/ for details on
    // how .visually-hidden works.
    // @ts-ignore
    return ((image.width <= 1 && image.height <= 1) || image.complete || new Promise(f => image.onload = f));
  }));
  await Promise.all(promises);

  // The wait above treats an errored image as "loaded": a 404 -- or a Stage
  // File Proxy URL that 503s while it fetches the original on demand -- leaves
  // the image `complete` with a `naturalWidth` of 0. Wait for every visible
  // image to actually decode, re-requesting any that errored so a slow
  // on-demand fetch can recover before the screenshot is taken.
  await waitForImagesToDecode(page);

  // Scroll to the top.
  await page.evaluate(() =>
    window.scroll({
      top: 0,
      left: 0,
      behavior: 'instant',
    })
  );

  // The toolbar moves position even after the browser has updated the Y position.
  // This is especially noticeable in tablet viewports. The toolbar also ends
  // up slightly below the top of the viewport, but at least this way we have
  // more consistent screenshots.
  if (await page.locator('#toolbar-administration, #admin-toolbar').count() > 0) {
    await page.waitForTimeout(250);
  }

  // window.scroll is async and doesn't return a promise, so wait until the
  // browser confirms we are at the top again.
  const forcedScroll = false;
  await page.waitForFunction(forcedScroll => {
    // The above scroll can fail when a Drupal dialog is open. So, if we
    // haven't scrolled successfully, we trigger another one.
    if (window.scrollY !== 0 && !forcedScroll) {
      window.scroll({
        top: 0,
        left: 0,
        behavior: 'instant',
      });

      // But only trigger this once, so we don't override previous scroll
      // calls.
      forcedScroll = true;
    }
    return window.scrollY == 0;
  }, forcedScroll);
}

/**
 * Wait for all image tags on the page to load.
 *
 * @param page
 */
export async function waitForAllImages(page: Page): Promise<void> {
  await waitForImages(page, 'img:visible');
}

/**
 * Wait for every visible image to finish decoding, recovering errored ones.
 *
 * A loaded image is `complete` with a `naturalWidth` greater than zero. An
 * errored request (a 404, or a Stage File Proxy URL that returns a 503 while it
 * fetches the original on demand) is `complete` with a `naturalWidth` of 0 and
 * would otherwise be screenshotted as a broken image. A zero `naturalWidth` is
 * ambiguous, though -- a valid but dimensionless image such as an SVG without an
 * intrinsic size reports it too -- so `decode()` disambiguates: it rejects only
 * for a genuine failure. A broken image never recovers on its own, so it is re-requested
 * with a cache-busting query parameter -- by then the on-demand fetch triggered
 * by the first request has usually finished, so the retry resolves to a real
 * image. The retry reuses `currentSrc` (the URL already chosen from `srcset`)
 * and drops the responsive sources so that exact image loads, keeping the render
 * identical to a clean first load. 1x1 visually-hidden images are skipped, and
 * the whole thing is bounded by a timeout.
 *
 * @param page
 * @param timeoutMs How long to wait for images to decode before giving up.
 */
export async function waitForImagesToDecode(page: Page, timeoutMs = 15000): Promise<void> {
  await page.evaluate(async (timeout) => {
    const deadline = Date.now() + timeout;
    const isCandidate = (img: HTMLImageElement) => {
      // Skip 1x1 visually-hidden images (see waitForImages above).
      if (img.width <= 1 && img.height <= 1) {
        return false;
      }
      const rect = img.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) {
        return false;
      }
      const style = getComputedStyle(img);
      return style.visibility !== "hidden" && style.display !== "none";
    };
    const reload = (img: HTMLImageElement) => {
      const src = img.currentSrc || img.src;
      if (!src || src.startsWith("data:")) {
        return;
      }
      try {
        const url = new URL(src, location.href);
        url.searchParams.set("playwrightReload", String(Date.now()));
        // Drop the responsive sources so the resolved URL we just loaded is the
        // one fetched, instead of re-running srcset selection.
        const picture = img.closest("picture");
        if (picture) {
          picture.querySelectorAll("source").forEach(source => source.remove());
        }
        img.removeAttribute("srcset");
        img.src = url.href;
      } catch {
        // Ignore anything that is not a reloadable URL.
      }
    };

    let lastReload = 0;
    while (Date.now() < deadline) {
      const candidates = Array.from(document.images).filter(isCandidate);
      let pending = 0;
      const errored: HTMLImageElement[] = [];
      await Promise.all(candidates.map(async img => {
        if (img.complete && img.naturalWidth > 0) {
          return; // Loaded with intrinsic dimensions.
        }
        if (!img.complete) {
          pending++; // Still loading.
          return;
        }
        // Complete with a zero naturalWidth is ambiguous: a genuine load error
        // (404/503) rejects decode(), while a valid but dimensionless image
        // (such as an SVG with no intrinsic size) resolves it. Only the former
        // should be re-requested; the latter is already settled.
        try {
          await img.decode();
        } catch {
          pending++;
          errored.push(img);
        }
      }));
      if (pending === 0) {
        return;
      }
      // Re-request errored images, throttled so each retry has time to resolve.
      if (Date.now() - lastReload > 2000) {
        lastReload = Date.now();
        errored.forEach(reload);
      }
      await new Promise(resolve => setTimeout(resolve, 250));
    }
  }, timeoutMs);
}
