import { Page } from "@playwright/test";

export interface WaitForImagesOptions {
  /** How long to wait for visible images to decode. */
  decodeTimeoutMs?: number;
  /**
   * Re-request broken images with a cache-busting URL. This mutates `src`,
   * `srcset`, and enclosing `<picture>` sources, so it is disabled by default.
   */
  recoverErroredImages?: boolean;
  /** Optional adapter hook run after the viewport has returned to the top. */
  afterScroll?: (page: Page) => Promise<void>;
}

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
export async function waitForImages(
  page: Page,
  selector: string,
  options: WaitForImagesOptions = {},
): Promise<void> {
  const locators = page.locator(selector);

  try {
    // Trigger lazy-loading images. Since this should be fast, and we don't want to
    // have to deal with concurrency bugs, we do this in serial.
    for (const l of await locators.all()) {
      // Ensure images are connected to the DOM before trying to scroll to them.
      // https://github.com/microsoft/playwright/issues/23758
      if (await l.evaluate((image) => image.isConnected)) {
        await l.scrollIntoViewIfNeeded();
      }
    }

    // Make sure all images have loaded.
    const promises = (await locators.all()).map((locator) =>
      locator.evaluate(settleImage),
    );
    await Promise.all(promises);

    // The wait above treats an errored image as "loaded". Decode each visible
    // image as well; source rewriting is available only when explicitly enabled.
    await waitForImagesToDecode(
      page,
      options.decodeTimeoutMs ?? 15000,
      options.recoverErroredImages ?? false,
    );
  } finally {
    // Lazy-loading scrolls the document. Always put it back, including when an
    // image listener, decode poll, or adapter hook fails.
    await page.evaluate(() =>
      window.scroll({
        top: 0,
        left: 0,
        behavior: "instant",
      }),
    );

    // window.scroll is async and doesn't return a promise, so wait until the
    // browser confirms we are at the top again.
    const scrollState = { forced: false };
    await page.waitForFunction((state) => {
      if (window.scrollY !== 0 && !state.forced) {
        window.scroll({ top: 0, left: 0, behavior: "instant" });
        state.forced = true;
      }
      return window.scrollY === 0;
    }, scrollState);

    await options.afterScroll?.(page);
  }
}

/**
 * Wait for a single image to stop being in flight.
 *
 * Returns without a promise for an image that needs no waiting at all: one that
 * has already settled, or a 1x1 image that is visually hidden for accessibility
 * (a common visually-hidden accessibility technique), which would otherwise
 * hang forever -- even
 * though such images are :visible, Chrome doesn't load them at desktop widths. See
 * https://www.tpgi.com/the-anatomy-of-visually-hidden/ for how .visually-hidden
 * works.
 *
 * Otherwise it waits for the request to finish, whether it succeeds or fails.
 * Waiting on `load` alone would hang until the test timed out on any image that
 * errors after the wait begins -- a 404, or an image proxy that fails while it
 * fetches the original on demand -- because such an image only ever
 * fires `error`. That hang is worse than useless here: it happens before
 * waitForImagesToDecode() runs, so it also denies the one piece of code that
 * knows how to re-request a broken image the chance to recover it. Settling on
 * `error` hands the image on to that recovery instead.
 *
 * Listeners are added rather than assigned to `onload`/`onerror` so that any
 * handler the page itself installed keeps working.
 *
 * This runs in the browser via `evaluate()`, which serializes the function
 * source, so it must stay self-contained and reference nothing else in this
 * module. It is exported so the waiting can be tested directly.
 *
 * @param image
 */
export function settleImage(image: HTMLImageElement): void | Promise<void> {
  if ((image.width <= 1 && image.height <= 1) || image.complete) {
    return;
  }
  return new Promise<void>((resolve) => {
    const settled = () => {
      image.removeEventListener("load", settled);
      image.removeEventListener("error", settled);
      resolve();
    };
    image.addEventListener("load", settled);
    image.addEventListener("error", settled);
  });
}

/**
 * Wait for all image tags on the page to load.
 *
 * @param page
 */
export async function waitForAllImages(
  page: Page,
  options: WaitForImagesOptions = {},
): Promise<void> {
  await waitForImages(page, "img:visible", options);
}

/**
 * Poll every visible image until it decodes, optionally re-requesting failures.
 *
 * A loaded image is `complete` with a `naturalWidth` greater than zero. An
 * errored request (a 404, or an image proxy that fails while it
 * fetches the original on demand) is `complete` with a `naturalWidth` of 0 and
 * would otherwise be screenshotted as a broken image. A zero `naturalWidth` is
 * ambiguous, though -- a valid but dimensionless image such as an SVG without an
 * intrinsic size reports it too -- so `decode()` disambiguates: it rejects only
 * for a genuine failure. When recovery is explicitly enabled, a broken image
 * is re-requested with a cache-busting query parameter. The retry reuses
 * `currentSrc` (the URL already
 * chosen from `srcset`) and drops the responsive sources so that exact image
 * loads, keeping the render identical to a clean first load. 1x1
 * visually-hidden images are skipped.
 *
 * This runs in the browser via `page.evaluate()`, which serializes the function
 * source, so it must stay self-contained and reference nothing else in this
 * module. It is exported separately from waitForImagesToDecode() so the polling
 * can be tested directly.
 *
 * Every image is checked at least once, even with a timeout of zero, and the
 * images that never settled are returned rather than swallowed so the caller
 * can report them.
 *
 * @param options.timeoutMs How long to keep polling before giving up.
 * @param options.pollMs How long to sleep between polls.
 * @param options.reloadIntervalMs How long to leave a re-requested image to
 *   resolve before re-requesting it again.
 * @param options.recoverErroredImages Whether broken image sources may be
 *   rewritten and re-requested. Defaults to false.
 * @returns The URLs of the images that never decoded. Empty when they all did.
 */
export async function decodeVisibleImages(options: {
  timeoutMs: number;
  pollMs?: number;
  reloadIntervalMs?: number;
  recoverErroredImages?: boolean;
}): Promise<string[]> {
  const timeoutMs = options.timeoutMs;
  const pollMs = options.pollMs ?? 250;
  const reloadIntervalMs = options.reloadIntervalMs ?? 2000;
  const recoverErroredImages = options.recoverErroredImages ?? false;
  const deadline = Date.now() + timeoutMs;
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
        picture.querySelectorAll("source").forEach((source) => source.remove());
      }
      img.removeAttribute("srcset");
      img.src = url.href;
    } catch {
      // Ignore anything that is not a reloadable URL.
    }
  };

  let lastReload = 0;
  // Checking before testing the deadline means a zero or already-elapsed
  // timeout still reports on the images instead of claiming success.
  for (;;) {
    const candidates = Array.from(document.images).filter(isCandidate);
    // Collect the verdicts positionally rather than pushing as each check
    // settles, so anything reported below stays in document order.
    const verdicts = await Promise.all(
      candidates.map(async (img) => {
        if (img.complete && img.naturalWidth > 0) {
          return "loaded"; // Loaded with intrinsic dimensions.
        }
        if (!img.complete) {
          return "loading";
        }
        // Complete with a zero naturalWidth is ambiguous: a genuine load error
        // (404/503) rejects decode(), while a valid but dimensionless image
        // (such as an SVG with no intrinsic size) resolves it. Only the former
        // should be re-requested; the latter is already settled.
        try {
          await img.decode();
          return "loaded";
        } catch {
          return "errored";
        }
      }),
    );
    const pending = candidates.filter(
      (img, index) => verdicts[index] !== "loaded",
    );
    const errored = candidates.filter(
      (img, index) => verdicts[index] === "errored",
    );
    if (pending.length === 0) {
      return [];
    }
    if (Date.now() >= deadline) {
      return pending.map((img) => {
        const src = img.currentSrc || img.src;
        try {
          // Report the URL as the page authored it, without the cache-busting
          // parameter a retry added, so the warning is greppable.
          const url = new URL(src, location.href);
          url.searchParams.delete("playwrightReload");
          return url.href;
        } catch {
          return src;
        }
      });
    }
    // Re-request errored images, throttled so each retry has time to resolve.
    if (recoverErroredImages && Date.now() - lastReload > reloadIntervalMs) {
      lastReload = Date.now();
      errored.forEach(reload);
    }
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
}

/**
 * Wait for every visible image to finish decoding.
 *
 * See decodeVisibleImages() for how an image is judged loaded, broken, or
 * merely dimensionless, and how broken ones are re-requested.
 *
 * Giving up is not an error: a page that legitimately references a missing
 * image should still be screenshotted and still have its accessibility checked,
 * and the screenshot comparison is what fails. But the wait is not silent
 * either -- the images that never decoded are warned about, so a mysterious
 * pixel diff (and the timeout's worth of delay before it) has an explanation --
 * and they are returned so a caller can assert on them.
 *
 * @param page
 * @param timeoutMs How long to wait for images to decode before giving up.
 * @param recoverErroredImages Whether broken image sources may be rewritten.
 * @returns The URLs of the images that never decoded. Empty when they all did.
 */
export async function waitForImagesToDecode(
  page: Page,
  timeoutMs = 15000,
  recoverErroredImages = false,
): Promise<string[]> {
  const undecoded = await page.evaluate(decodeVisibleImages, {
    timeoutMs,
    recoverErroredImages,
  });
  if (undecoded.length > 0) {
    console.warn(
      `waitForImagesToDecode: ${undecoded.length} image(s) did not finish loading within ${timeoutMs}ms and may be captured as broken: ${undecoded.join(", ")}`,
    );
  }
  return undecoded;
}
