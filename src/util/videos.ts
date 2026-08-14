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
 * Both are fixed together: pin playback first, wait for a decodable frame,
 * bring it on screen once so Chromium composites that frame, and rewind.
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
 * The order of operations matters and is not the obvious one. Playback is
 * pinned -- `autoplay` cleared and the element paused -- *before* the video is
 * scrolled into view, because bringing a muted `autoplay` video on screen is
 * exactly what starts it: measured on a real page, scrolling to it first and
 * pausing after left `currentTime` at 0.6s and climbing, while pinning first
 * held it at 0 through the same scroll. Pinning first turns the scroll into a
 * pure repaint.
 *
 * Videos are handled in serial: each one is scrolled into view in turn, and
 * doing that concurrently would just mean the last one wins. The original
 * scroll position is restored at the end so this composes with callers that
 * care where the page is left -- waitForImages(), in particular, does its own
 * careful scroll back to the top.
 *
 * A video that never produces a frame is not an error. A page that legitimately
 * references a missing or undecodable video should still be screenshotted and
 * still have its accessibility checked, and the comparison is what fails. The
 * wait is not silent either: the sources that never became ready are returned
 * so the caller can report them.
 *
 * @param options.timeoutMs How long to wait for a video to become ready.
 * @param options.pollMs How long to sleep between readiness checks.
 * @returns The sources of the videos that never became ready. Empty when they
 *   all did.
 */
export async function settleVideos(
  options: {timeoutMs: number, pollMs?: number}
): Promise<string[]> {
  const timeoutMs = options.timeoutMs;
  const pollMs = options.pollMs ?? 50;
  const deadline = Date.now() + timeoutMs;
  // HTMLMediaElement.HAVE_CURRENT_DATA: a frame exists for the current position.
  const HAVE_CURRENT_DATA = 2;

  const isCandidate = (video: HTMLVideoElement) => {
    const rect = video.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      return false;
    }
    const style = getComputedStyle(video);
    return style.visibility !== "hidden" && style.display !== "none";
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
  // the second then observes.
  const nextPaint = () => new Promise<void>(resolve =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  );

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
    return [];
  }

  const scrollX = window.scrollX;
  const scrollY = window.scrollY;
  const notReady: string[] = [];

  for (const video of videos) {
    pin(video);

    while (video.readyState < HAVE_CURRENT_DATA && Date.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, pollMs));
    }
    if (video.readyState < HAVE_CURRENT_DATA) {
      // Reported below, but still settled: a video that becomes ready between
      // here and the capture must not start playing off the back of `autoplay`.
      notReady.push(sourceOf(video));
    }

    // Bringing the video on screen is what gives Chromium a reason to composite
    // its first frame. Without it a full-page capture can raster the region
    // before the frame is ready to paint.
    video.scrollIntoView({block: "center", inline: "nearest", behavior: "instant"});
    await nextPaint();

    // Belt and braces: `pin()` above should have kept it still through the
    // scroll, and rewinding costs nothing if it did. `currentTime` throws on a
    // source that is not seekable, such as a live stream.
    pin(video);
    try {
      if (video.currentTime !== 0) {
        video.currentTime = 0;
      }
    } catch {
      // Not seekable; whatever frame it is showing is the best available.
    }
    await nextPaint();
  }

  window.scroll({top: scrollY, left: scrollX, behavior: "instant"});
  await nextPaint();

  return notReady;
}

/**
 * Wait for every visible video to be ready, composited, and paused at its
 * first frame.
 *
 * See settleVideos() for what "ready" means, why playback is pinned before the
 * video is scrolled into view, and why this is not built on
 * `requestVideoFrameCallback()`.
 *
 * @param page
 * @param timeoutMs How long to wait for each video to produce a frame.
 * @returns The sources of the videos that never became ready. Empty when they
 *   all did.
 */
export async function waitForVideos(page: Page, timeoutMs = 5000): Promise<string[]> {
  const notReady = await page.evaluate(settleVideos, {timeoutMs});
  if (notReady.length > 0) {
    console.warn(
      `waitForVideos: ${notReady.length} video(s) had no frame available within ${timeoutMs}ms and may be captured as an empty box: ${notReady.join(', ')}`
    );
  }
  return notReady;
}
