import {Page} from "@playwright/test";

/**
 * Settle every <video> on the page so a screenshot of it is reproducible.
 *
 * A `<video>` is the one replaced element nothing else in the screenshot path
 * covers. waitForImages() only looks at `img`, and Playwright's
 * `animations: 'disabled'` only fast-forwards CSS transitions and Web
 * Animations -- it does not touch media playback. That leaves two separate ways
 * for a video to break a visual comparison:
 *
 * 1. **The frame is captured before it exists.** A full-page screenshot rasters
 *    the whole document, including regions that were never in the viewport, so
 *    it will happily capture a video that is still loading. The region paints as
 *    an empty box on one capture and as the video on the next, which Playwright
 *    reports as "Failed to take two consecutive stable screenshots" -- the run
 *    burns its whole stability window and fails even though the image it ended
 *    up with was correct. When the video is slower still, the captures agree on
 *    the empty box, which is worse: it passes stability and bakes a blank
 *    rectangle into the baseline if snapshots are being regenerated.
 * 2. **The frame is captured while the video is playing.** An `autoplay muted
 *    loop` video renders whatever moment the shutter caught. Chromium only
 *    autoplays a muted video while it is on screen, so whether such a baseline
 *    is reproducible at all currently rests on nothing more principled than
 *    whether an earlier scroll happened to bring the video into the viewport.
 *
 * Both are fixed together: pin playback first, bring the video on screen so it
 * both loads and composites, wait for a decodable frame, and rewind.
 *
 * Note this is deliberately *not* built on `requestVideoFrameCallback()`, which
 * looks like the right signal and is not: it only fires when a frame is
 * presented, and a paused off-screen video never presents one. Measured against
 * a real page it never fired at all -- every call sat there until its timeout,
 * adding the full timeout to each capture and reporting nothing.
 */

/**
 * Settle every visible video, in the browser.
 *
 * This runs in the browser via `page.evaluate()`, which serializes the function
 * source, so it must stay self-contained and reference nothing else in this
 * module. It is exported separately from waitForVideos() so it can be tested
 * directly.
 *
 * The order of operations matters and is not the obvious one:
 *
 * - Playback is pinned -- `autoplay` cleared and the element paused -- *before*
 *   the video is scrolled into view, because bringing a muted `autoplay` video
 *   on screen is exactly what starts it: measured on a real page, scrolling to
 *   it first and pausing after left `currentTime` at 0.6s and climbing, while
 *   pinning first held it at 0 through the same scroll. Pinning first turns the
 *   scroll into a pure repaint.
 * - The video is scrolled into view *before* its readiness is polled, because
 *   for a lazily loaded video the scroll is what starts the load. Polling first
 *   would sit there watching a `preload="none"` element that has been told not
 *   to fetch anything, burn the whole timeout, and only then scroll it on
 *   screen -- leaving the capture racing a load that had just begun.
 *
 * Videos are handled in serial: each one is scrolled into view in turn, and
 * doing that concurrently would just mean the last one wins. Every scroll is
 * undone -- the window offset and any scrollable ancestor `scrollIntoView()`
 * moved -- so this composes with callers that care where the page is left;
 * waitForImages(), in particular, does its own careful scroll back to the top.
 *
 * Playback state is not restored here, because the whole point is to leave the
 * videos pinned at their first frame for the capture. It is recorded on each
 * element so restorePlayback() can put it back afterwards.
 *
 * A video that never produces a frame is not an error. A page that legitimately
 * references a missing or undecodable video should still be screenshotted and
 * still have its accessibility checked, and the comparison is what fails. The
 * wait is not silent either: the sources that never became ready are returned
 * so the caller can report them.
 *
 * @param options.timeoutMs How long to wait for each video to become ready.
 * @param options.pollMs How long to sleep between readiness checks.
 * @param options.paintTimeoutMs How long to wait on a frame or a seek that may
 *   never arrive.
 * @returns The sources of the videos that never became ready, and whether the
 *   page was scrolled at all.
 */
export async function settleVideos(
  options: {timeoutMs: number, pollMs?: number, paintTimeoutMs?: number}
): Promise<{notReady: string[], scrolled: boolean}> {
  const timeoutMs = options.timeoutMs;
  const pollMs = options.pollMs ?? 50;
  const paintTimeoutMs = options.paintTimeoutMs ?? 1000;
  // HTMLMediaElement readyStates: nothing loaded at all, and a frame exists for
  // the current position.
  const HAVE_NOTHING = 0;
  const HAVE_CURRENT_DATA = 2;

  const isCandidate = (video: HTMLVideoElement) => {
    const rect = video.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      return false;
    }
    const style = getComputedStyle(video);
    return style.visibility !== "hidden" && style.display !== "none";
  };

  // Taking a screenshot should not be what stops a video: a test may well go on
  // to assert that it is playing. Record enough to put it back, on the element
  // itself so a later evaluate() in the same page can find it, and only the
  // first time so repeated captures do not record the pinned state as the
  // original one. The key is spelled out here and in restorePlayback() rather
  // than shared, because a reference to anything in this module would be a
  // ReferenceError once this function is serialized into the browser.
  const remember = (video: HTMLVideoElement) => {
    if (!("__playwrightDrupalVideoState" in video)) {
      (video as any)["__playwrightDrupalVideoState"] = {
        autoplay: video.autoplay,
        paused: video.paused,
        currentTime: video.currentTime,
      };
    }
  };

  // A muted autoplay video plays whenever it is on screen, so clear the
  // attribute as well as pausing -- otherwise Chromium restarts it the moment
  // the scroll below makes it visible.
  const pin = (video: HTMLVideoElement) => {
    video.autoplay = false;
    if (!video.paused) {
      video.pause();
    }
  };

  // Two frames, because the first only gets as far as scheduling the paint that
  // the second then observes. The timeout is not decoration: Chromium stops
  // running animation frames for a page it is not rendering -- one behind
  // another tab of the same context, say -- and page.evaluate() has no timeout
  // of its own, so an unguarded wait here hangs the whole capture.
  const nextPaint = () => new Promise<void>(resolve => {
    const timer = setTimeout(resolve, paintTimeoutMs);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      clearTimeout(timer);
      resolve();
    }));
  });

  // Assigning `currentTime` only *starts* a seek: the browser still has to
  // decode the frame at the new position and present it, which lands several
  // frames later when the position is not a keyframe. Waiting for `seeked` is
  // what makes the rewind visible in the capture rather than a race.
  const seeked = (video: HTMLVideoElement) => new Promise<void>(resolve => {
    const done = () => {
      clearTimeout(timer);
      video.removeEventListener("seeked", done);
      resolve();
    };
    const timer = setTimeout(done, paintTimeoutMs);
    video.addEventListener("seeked", done);
  });

  // scrollIntoView() scrolls every scrollable ancestor, not just the window, so
  // record where each of them was. Without this a video inside a modal body, an
  // off-canvas tray or a carousel track leaves that region showing something
  // the baseline never had, and the pixel diff lands nowhere near the video.
  const ancestorScrolls = (video: HTMLVideoElement) => {
    const saved: Array<{element: Element, top: number, left: number}> = [];
    for (let node = video.parentElement; node; node = node.parentElement) {
      if (node.scrollHeight > node.clientHeight || node.scrollWidth > node.clientWidth) {
        saved.push({element: node, top: node.scrollTop, left: node.scrollLeft});
      }
    }
    return saved;
  };

  const sourceOf = (video: HTMLVideoElement) => {
    const src = video.currentSrc || video.src
      || video.querySelector("source")?.getAttribute("src") || "";
    try {
      return new URL(src, location.href).href;
    } catch {
      return src;
    }
  };

  const videos = Array.from(document.querySelectorAll("video")).filter(isCandidate);
  if (videos.length === 0) {
    return {notReady: [], scrolled: false};
  }

  const scrollX = window.scrollX;
  const scrollY = window.scrollY;
  const notReady: string[] = [];

  for (const video of videos) {
    remember(video);
    pin(video);

    // Bringing the video on screen is both what starts a lazy load and what
    // gives Chromium a reason to composite the first frame. Without it a
    // full-page capture can raster the region before the frame is ready to
    // paint.
    const ancestors = ancestorScrolls(video);
    video.scrollIntoView({block: "center", inline: "nearest", behavior: "instant"});
    await nextPaint();

    // `preload="none"` means the browser fetches nothing until playback is
    // asked for, and nothing here ever asks. Scrolling alone does not override
    // it, so say what is wanted and let the poll below wait for it.
    if (video.readyState === HAVE_NOTHING) {
      video.preload = "auto";
      try {
        video.load();
      } catch {
        // Nothing loadable; reported as not ready below.
      }
    }

    // Each video gets its own deadline. A single deadline for the call would
    // make `timeoutMs` a budget the first slow video can spend in full, so the
    // second one is reported as having no frame without ever being waited for.
    const deadline = Date.now() + timeoutMs;
    const readyBeforeWait = video.readyState >= HAVE_CURRENT_DATA;
    while (video.readyState < HAVE_CURRENT_DATA && Date.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, pollMs));
    }
    if (video.readyState < HAVE_CURRENT_DATA) {
      // Reported below, but still settled: a video that becomes ready between
      // here and the capture must not start playing off the back of `autoplay`.
      notReady.push(sourceOf(video));
    } else if (!readyBeforeWait) {
      // The frame only arrived during the wait, so spend a paint compositing it
      // while the video is still on screen. A video that was already ready was
      // composited by the paint after the scroll.
      await nextPaint();
    }

    // Belt and braces: `pin()` above should have kept it still through the
    // scroll, and rewinding costs nothing if it did. `currentTime` throws on a
    // source that is not seekable, such as a live stream.
    pin(video);
    try {
      if (video.currentTime !== 0) {
        video.currentTime = 0;
        await seeked(video);
        await nextPaint();
      }
    } catch {
      // Not seekable; whatever frame it is showing is the best available.
    }

    for (const {element, top, left} of ancestors) {
      element.scrollTop = top;
      element.scrollLeft = left;
    }
  }

  window.scroll({top: scrollY, left: scrollX, behavior: "instant"});
  await nextPaint();
  // window.scroll is async and can be dropped outright -- when a Drupal dialog
  // has locked the body, for one -- so confirm it landed and ask once more if
  // it did not. Only once, so this cannot fight with the caller.
  if (window.scrollX !== scrollX || window.scrollY !== scrollY) {
    window.scroll({top: scrollY, left: scrollX, behavior: "instant"});
    await nextPaint();
  }

  return {notReady, scrolled: true};
}

/**
 * Put back the playback state settleVideos() recorded, in the browser.
 *
 * Like settleVideos() this is serialized into the page by `page.evaluate()`, so
 * it must stay self-contained, and it is exported separately from
 * restoreVideoPlayback() so it can be tested directly.
 *
 * Videos that were not settled are left alone, and the recorded state is
 * cleared as it is applied so a second call is a no-op rather than a rewind of
 * whatever the test did in between.
 */
export function restorePlayback(): void {
  for (const video of Array.from(document.querySelectorAll("video"))) {
    const saved = (video as any)["__playwrightDrupalVideoState"];
    if (!saved) {
      continue;
    }
    delete (video as any)["__playwrightDrupalVideoState"];
    video.autoplay = saved.autoplay;
    try {
      if (video.currentTime !== saved.currentTime) {
        video.currentTime = saved.currentTime;
      }
    } catch {
      // Not seekable; it was not seekable on the way in either.
    }
    if (!saved.paused && video.paused) {
      const played = video.play();
      if (played && typeof played.catch === "function") {
        // Autoplay policy can refuse this. Restoring playback is best effort:
        // the capture is already taken, and throwing here would fail a test for
        // something it never asked for.
        played.catch(() => {});
      }
    }
  }
}

/**
 * Wait for every visible video to be ready, composited, and paused at its
 * first frame.
 *
 * See settleVideos() for what "ready" means, why playback is pinned before the
 * video is scrolled into view, why the readiness poll comes after that scroll,
 * and why this is not built on `requestVideoFrameCallback()`.
 *
 * This runs in every frame, not just the main one: Drupal renders oEmbed and
 * media embeds inside iframes, which is why waitForFrames() exists, and a
 * `<video>` in one of those is no less able to break a comparison.
 *
 * @param page
 * @param timeoutMs How long to wait for each video to produce a frame.
 * @returns The sources of the videos that never became ready. Empty when they
 *   all did.
 */
export async function waitForVideos(page: Page, timeoutMs = 5000): Promise<string[]> {
  const notReady: string[] = [];
  let scrolled = false;

  for (const frame of page.frames()) {
    try {
      const result = await frame.evaluate(settleVideos, {timeoutMs});
      notReady.push(...result.notReady);
      scrolled = scrolled || result.scrolled;
    } catch {
      // A frame that navigated or detached while we were working through the
      // list has nothing left to settle.
    }
  }

  // The same guard waitForImages() ends with: the admin toolbar keeps moving
  // for a moment after the browser has reported the new Y position, which is
  // most visible in tablet viewports. Only pay for it when a video actually
  // moved the page.
  if (scrolled && await page.locator('#toolbar-administration, #admin-toolbar').count() > 0) {
    await page.waitForTimeout(250);
  }

  if (notReady.length > 0) {
    console.warn(
      `waitForVideos: ${notReady.length} video(s) had no frame available within ${timeoutMs}ms and may be captured as an empty box: ${notReady.join(', ')}`
    );
  }
  return notReady;
}

/**
 * Restore the playback state waitForVideos() pinned.
 *
 * Settling a video means pausing it, clearing `autoplay` and rewinding it, and
 * a test that takes a screenshot has not asked for any of that to outlive the
 * capture -- it may well go on to assert that the video is playing. Call this
 * once the screenshot is taken to hand the page back as it was found.
 *
 * @param page
 */
export async function restoreVideoPlayback(page: Page): Promise<void> {
  for (const frame of page.frames()) {
    try {
      await frame.evaluate(restorePlayback);
    } catch {
      // Same as waitForVideos(): a frame that has gone away needs nothing.
    }
  }
}
