import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { restorePlayback, restoreVideoPlayback, settleVideos, waitForVideos } from './videos'

/**
 * A stand-in for the parts of HTMLVideoElement settleVideos() touches.
 *
 * settleVideos() runs in the browser, so it is exercised here against a fake
 * DOM rather than a real page: each video declares whether it already has a
 * frame, whether it is playing, and whether it can be seeked.
 */
interface FakeVideoOptions {
  src?: string
  /** Sources of nested <source> elements, when there is no src attribute. */
  sourceSrc?: string
  /** HTMLMediaElement.readyState. 2 (HAVE_CURRENT_DATA) means a frame exists. */
  readyState?: number
  /** readyState to switch to after `readyAfterMs`, simulating a slow load. */
  readyAfterMs?: number
  /** When true, readyState only starts climbing once load() is called. */
  readyAfterLoad?: boolean
  /** The preload attribute. "none" means nothing loads until asked for. */
  preload?: string
  paused?: boolean
  autoplay?: boolean
  currentTime?: number
  /** When false, assigning currentTime throws, as on a live stream. */
  seekable?: boolean
  /** When true, a seek is accepted but the `seeked` event never arrives. */
  neverSeeked?: boolean
  rect?: { width: number, height: number }
  style?: { visibility?: string, display?: string }
  /** A scrollable ancestor that scrollIntoView() moves along with the window. */
  scrollParent?: any
  /** Where scrollIntoView() leaves the window, as the browser would. */
  scrollsWindowTo?: { x: number, y: number }
}

function makeVideo(options: FakeVideoOptions = {}) {
  let currentTime = options.currentTime ?? 0
  let readyAt = options.readyAfterMs === undefined || options.readyAfterLoad
    ? undefined
    : Date.now() + options.readyAfterMs
  const initialReadyState = options.readyState ?? 4
  const listeners: Record<string, Array<() => void>> = {}

  const video: any = {
    src: options.src ?? '',
    preload: options.preload ?? 'auto',
    autoplay: options.autoplay ?? false,
    paused: options.paused ?? true,
    parentElement: options.scrollParent ?? null,
    scrolledIntoView: 0,
    pauseCalls: 0,
    playCalls: 0,
    loadCalls: 0,
    seeks: [] as number[],
    getBoundingClientRect: () => options.rect ?? { width: 640, height: 480 },
    querySelector: (selector: string) =>
      selector === 'source' && options.sourceSrc
        ? { getAttribute: () => options.sourceSrc }
        : null,
    events: [] as string[],
    addEventListener: (type: string, listener: () => void) => {
      listeners[type] = [...(listeners[type] ?? []), listener]
    },
    removeEventListener: (type: string, listener: () => void) => {
      listeners[type] = (listeners[type] ?? []).filter(l => l !== listener)
    },
    scrollIntoView: () => {
      video.scrolledIntoView++
      video.events.push('scroll')
      // Bringing an element on screen scrolls every scrollable ancestor, not
      // just the window.
      if (options.scrollParent) {
        options.scrollParent.scrollTop = 900
        options.scrollParent.scrollLeft = 40
      }
      if (options.scrollsWindowTo) {
        const win = (globalThis as any).window
        win.scrollX = options.scrollsWindowTo.x
        win.scrollY = options.scrollsWindowTo.y
      }
      // Chromium starts a muted autoplay video once it is on screen, which is
      // why the attribute has to be cleared before this happens and not after.
      if (video.autoplay) video.paused = false
    },
    pause: () => {
      video.pauseCalls++
      video.events.push('pause')
      video.paused = true
    },
    play: () => {
      video.playCalls++
      video.events.push('play')
      video.paused = false
      return Promise.resolve()
    },
    load: () => {
      video.loadCalls++
      video.events.push('load')
      if (options.readyAfterLoad) {
        readyAt = Date.now() + (options.readyAfterMs ?? 0)
      }
    },
  }

  Object.defineProperty(video, 'readyState', {
    get: () => (readyAt !== undefined && Date.now() >= readyAt ? 4 : initialReadyState),
  })

  Object.defineProperty(video, 'currentSrc', {
    get: () => (video.readyState >= 2 ? video.src : ''),
  })

  Object.defineProperty(video, 'currentTime', {
    get: () => currentTime,
    set: (value: number) => {
      if (options.seekable === false) throw new Error('not seekable')
      video.seeks.push(value)
      currentTime = value
      // A seek is asynchronous: the browser decodes the frame at the new
      // position and only then fires `seeked`.
      if (!options.neverSeeked) {
        setTimeout(() => (listeners.seeked ?? []).forEach(listener => listener()), 0)
      }
    },
  })

  return video
}

/**
 * A stand-in for a scrollable ancestor, such as a modal body or a carousel.
 */
function makeScrollBox() {
  return {
    scrollTop: 0,
    scrollLeft: 0,
    scrollHeight: 2000,
    clientHeight: 400,
    scrollWidth: 800,
    clientWidth: 400,
    parentElement: null,
  }
}

/**
 * Install the browser globals settleVideos() reaches for.
 *
 * @param options.lockScroll Accept window.scroll() calls but ignore them, as
 *   happens when a Drupal dialog has locked the body.
 */
function installDom(videos: any[], scroll = { x: 0, y: 0 }, options: { lockScroll?: boolean } = {}) {
  const scrolls: Array<{ top: number, left: number }> = []
  const win: any = {
    scrollX: scroll.x,
    scrollY: scroll.y,
    scroll: (opts: { top: number, left: number }) => {
      scrolls.push(opts)
      if (options.lockScroll) return
      win.scrollX = opts.left
      win.scrollY = opts.top
    },
  }
  vi.stubGlobal('document', {
    querySelectorAll: (selector: string) => (selector === 'video' ? videos : []),
  })
  vi.stubGlobal('getComputedStyle', (el: any) => ({
    visibility: el.styleVisibility ?? 'visible',
    display: el.styleDisplay ?? 'block',
  }))
  vi.stubGlobal('requestAnimationFrame', (cb: () => void) => {
    setTimeout(cb, 0)
    return 0
  })
  vi.stubGlobal('location', { href: 'https://example.com/page' })
  vi.stubGlobal('window', win)
  return scrolls
}

describe('settleVideos', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('reports nothing when there are no videos', async () => {
    installDom([])
    expect(await settleVideos({ timeoutMs: 100 })).toEqual({ notReady: [], scrolled: false })
  })

  it('composites, pauses and rewinds a playing autoplay video', async () => {
    const video = makeVideo({ src: 'https://example.com/v.mp4', autoplay: true, paused: false, currentTime: 3.5 })
    installDom([video])

    expect(await settleVideos({ timeoutMs: 100 })).toEqual({ notReady: [], scrolled: true })

    // Scrolled into view once, so Chromium has a reason to composite the frame.
    expect(video.scrolledIntoView).toBe(1)
    // Left paused at the first frame, so the capture is the same every run.
    expect(video.paused).toBe(true)
    expect(video.autoplay).toBe(false)
    expect(video.currentTime).toBe(0)
    expect(video.seeks).toEqual([0])
  })

  it('pins playback before scrolling, so the scroll cannot restart it', async () => {
    const video = makeVideo({ src: 'https://example.com/v.mp4', autoplay: true, paused: false })
    installDom([video])

    await settleVideos({ timeoutMs: 100 })

    // If the scroll came first, Chromium would restart the muted autoplay video
    // and the frame captured would depend on how long the rest of the waits took.
    expect(video.events[0]).toBe('pause')
    expect(video.events.indexOf('scroll')).toBeGreaterThan(0)
    expect(video.paused).toBe(true)
  })

  it('does not seek a video already at its first frame', async () => {
    const video = makeVideo({ src: 'https://example.com/v.mp4', currentTime: 0 })
    installDom([video])

    await settleVideos({ timeoutMs: 100 })

    expect(video.seeks).toEqual([])
    expect(video.paused).toBe(true)
  })

  it('still settles a video whose source cannot be seeked', async () => {
    const video = makeVideo({ src: 'https://example.com/live.m3u8', paused: false, currentTime: 12, seekable: false })
    installDom([video])

    expect(await settleVideos({ timeoutMs: 100 })).toEqual({ notReady: [], scrolled: true })
    expect(video.paused).toBe(true)
  })

  it('does not hang when a seek never completes', async () => {
    const video = makeVideo({ src: 'https://example.com/v.mp4', currentTime: 7, neverSeeked: true })
    installDom([video])

    expect(await settleVideos({ timeoutMs: 100, paintTimeoutMs: 20 })).toEqual({ notReady: [], scrolled: true })
    expect(video.seeks).toEqual([0])
  })

  it('does not hang when the page is never painted', async () => {
    const video = makeVideo({ src: 'https://example.com/v.mp4' })
    installDom([video])
    // A page Chromium is not rendering never runs an animation frame callback.
    vi.stubGlobal('requestAnimationFrame', () => 0)

    expect(await settleVideos({ timeoutMs: 100, paintTimeoutMs: 20 })).toEqual({ notReady: [], scrolled: true })
  })

  it('waits for a slow video to produce a frame', async () => {
    const video = makeVideo({ src: 'https://example.com/slow.mp4', readyState: 0, readyAfterMs: 120 })
    installDom([video])

    expect(await settleVideos({ timeoutMs: 2000, pollMs: 10 })).toEqual({ notReady: [], scrolled: true })
    expect(video.readyState).toBe(4)
  })

  it('gives every video its own timeout instead of a shared budget', async () => {
    const slow = makeVideo({ src: 'https://example.com/never.mp4', readyState: 0 })
    const ready = makeVideo({ src: 'https://example.com/ready.mp4', readyState: 0, readyAfterMs: 30 })
    installDom([slow, ready])

    // The first video spends its whole timeout without ever becoming ready. The
    // second must still be waited for rather than reported on a budget the
    // first one already emptied.
    const result = await settleVideos({ timeoutMs: 80, pollMs: 10 })

    expect(result.notReady).toEqual(['https://example.com/never.mp4'])
    expect(ready.readyState).toBe(4)
  })

  it('loads a lazy video instead of waiting for one that was never asked for', async () => {
    const video = makeVideo({
      src: 'https://example.com/lazy.mp4',
      preload: 'none',
      readyState: 0,
      readyAfterLoad: true,
      readyAfterMs: 30,
    })
    installDom([video])

    expect(await settleVideos({ timeoutMs: 2000, pollMs: 10 })).toEqual({ notReady: [], scrolled: true })
    // Asked for on screen first, then told to load: polling a preload="none"
    // video without either would just burn the whole timeout.
    expect(video.events.slice(0, 2)).toEqual(['scroll', 'load'])
    expect(video.preload).toBe('auto')
    expect(video.loadCalls).toBe(1)
  })

  it('reports a video that never produces a frame instead of hanging', async () => {
    const video = makeVideo({ src: 'https://example.com/missing.mp4', readyState: 0 })
    installDom([video])

    expect(await settleVideos({ timeoutMs: 60, pollMs: 10 })).toEqual({
      notReady: ['https://example.com/missing.mp4'],
      scrolled: true,
    })
    // Reported, but still pinned down: it must not start playing if it becomes
    // ready between here and the capture.
    expect(video.autoplay).toBe(false)
  })

  it('falls back to a nested <source> when reporting an unready video', async () => {
    const video = makeVideo({ readyState: 0, sourceSrc: '/files/missing.mp4' })
    installDom([video])

    expect((await settleVideos({ timeoutMs: 60, pollMs: 10 })).notReady)
      .toEqual(['https://example.com/files/missing.mp4'])
  })

  it('skips videos that are not visible', async () => {
    const zeroSized = makeVideo({ src: 'https://example.com/a.mp4', rect: { width: 0, height: 0 } })
    const hidden = makeVideo({ src: 'https://example.com/b.mp4' })
    hidden.styleVisibility = 'hidden'
    const notDisplayed = makeVideo({ src: 'https://example.com/c.mp4' })
    notDisplayed.styleDisplay = 'none'
    installDom([zeroSized, hidden, notDisplayed])

    expect(await settleVideos({ timeoutMs: 100 })).toEqual({ notReady: [], scrolled: false })
    expect(zeroSized.scrolledIntoView).toBe(0)
    expect(hidden.scrolledIntoView).toBe(0)
    expect(notDisplayed.scrolledIntoView).toBe(0)
  })

  it('restores the scroll position it found', async () => {
    const video = makeVideo({ src: 'https://example.com/v.mp4' })
    const scrolls = installDom([video], { x: 12, y: 3400 })

    await settleVideos({ timeoutMs: 100 })

    expect(scrolls).toEqual([{ top: 3400, left: 12, behavior: 'instant' }])
  })

  it('restores the scroll of every container the video was scrolled inside', async () => {
    const box = makeScrollBox()
    const video = makeVideo({ src: 'https://example.com/v.mp4', scrollParent: box })
    installDom([video], { x: 0, y: 200 })

    await settleVideos({ timeoutMs: 100 })

    // A video in a modal body or a carousel track must not leave that region
    // showing something the baseline never had.
    expect(box.scrollTop).toBe(0)
    expect(box.scrollLeft).toBe(0)
  })

  it('asks again when the scroll back is dropped', async () => {
    const video = makeVideo({ src: 'https://example.com/v.mp4', scrollsWindowTo: { x: 0, y: 4200 } })
    // window.scroll is async and does nothing at all when a Drupal dialog has
    // locked the body.
    const scrolls = installDom([video], { x: 0, y: 900 }, { lockScroll: true })

    await settleVideos({ timeoutMs: 100 })

    expect(scrolls).toEqual([
      { top: 900, left: 0, behavior: 'instant' },
      { top: 900, left: 0, behavior: 'instant' },
    ])
  })

  it('does not scroll at all when the page has no visible videos', async () => {
    const hidden = makeVideo({ src: 'https://example.com/b.mp4', rect: { width: 0, height: 0 } })
    const scrolls = installDom([hidden], { x: 0, y: 900 })

    await settleVideos({ timeoutMs: 100 })

    expect(scrolls).toEqual([])
  })

  it('settles every video on the page', async () => {
    const first = makeVideo({ src: 'https://example.com/1.mp4', autoplay: true, paused: false, currentTime: 2 })
    const second = makeVideo({ src: 'https://example.com/2.mp4', autoplay: true, paused: false, currentTime: 5 })
    installDom([first, second])

    expect(await settleVideos({ timeoutMs: 100 })).toEqual({ notReady: [], scrolled: true })
    for (const video of [first, second]) {
      expect(video.scrolledIntoView).toBe(1)
      expect(video.paused).toBe(true)
      expect(video.currentTime).toBe(0)
    }
  })

  it('records the playback state it found so it can be restored', async () => {
    const video = makeVideo({ src: 'https://example.com/v.mp4', autoplay: true, paused: false, currentTime: 3.5 })
    installDom([video])

    await settleVideos({ timeoutMs: 100 })

    expect(video.__playwrightDrupalVideoState).toEqual({
      autoplay: true,
      paused: false,
      currentTime: 3.5,
    })
  })

  it('keeps the first recorded state when it settles the same video twice', async () => {
    const video = makeVideo({ src: 'https://example.com/v.mp4', autoplay: true, paused: false, currentTime: 3.5 })
    installDom([video])

    await settleVideos({ timeoutMs: 100 })
    await settleVideos({ timeoutMs: 100 })

    // Otherwise a second capture would record the pinned state as the original
    // one and there would be nothing left to restore.
    expect(video.__playwrightDrupalVideoState.paused).toBe(false)
    expect(video.__playwrightDrupalVideoState.currentTime).toBe(3.5)
  })
})

describe('restorePlayback', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('puts back the playback state settleVideos() found', async () => {
    const video = makeVideo({ src: 'https://example.com/v.mp4', autoplay: true, paused: false, currentTime: 3.5 })
    installDom([video])

    await settleVideos({ timeoutMs: 100 })
    restorePlayback()

    expect(video.autoplay).toBe(true)
    expect(video.paused).toBe(false)
    expect(video.currentTime).toBe(3.5)
    expect(video.playCalls).toBe(1)
  })

  it('leaves a video that was already paused where it was', async () => {
    const video = makeVideo({ src: 'https://example.com/v.mp4', currentTime: 0 })
    installDom([video])

    await settleVideos({ timeoutMs: 100 })
    restorePlayback()

    expect(video.paused).toBe(true)
    expect(video.playCalls).toBe(0)
  })

  it('ignores videos it never settled', () => {
    const video = makeVideo({ src: 'https://example.com/v.mp4', autoplay: true, paused: false })
    installDom([video])

    restorePlayback()

    expect(video.playCalls).toBe(0)
    expect(video.pauseCalls).toBe(0)
  })

  it('does not undo what the test did after the first restore', async () => {
    const video = makeVideo({ src: 'https://example.com/v.mp4', autoplay: true, paused: false, currentTime: 3.5 })
    installDom([video])

    await settleVideos({ timeoutMs: 100 })
    restorePlayback()
    video.pause()
    restorePlayback()

    expect(video.paused).toBe(true)
    expect(video.playCalls).toBe(1)
  })

  it('survives a video whose source cannot be seeked', async () => {
    const video = makeVideo({ src: 'https://example.com/live.m3u8', paused: false, currentTime: 12, seekable: false })
    installDom([video])

    await settleVideos({ timeoutMs: 100 })
    expect(() => restorePlayback()).not.toThrow()
    expect(video.paused).toBe(false)
  })
})

describe('waitForVideos', () => {
  let warn: any

  beforeEach(() => {
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    warn.mockRestore()
  })

  /**
   * A stand-in for the parts of Page waitForVideos() uses, with one result per
   * frame.
   */
  function makePage(results: Array<{notReady: string[], scrolled: boolean} | Error>, toolbarCount = 0) {
    const frames = results.map(result => ({
      evaluate: vi.fn().mockImplementation(() =>
        result instanceof Error ? Promise.reject(result) : Promise.resolve(result)
      ),
    }))
    const page = {
      frames: () => frames,
      locator: vi.fn().mockReturnValue({ count: vi.fn().mockResolvedValue(toolbarCount) }),
      waitForTimeout: vi.fn().mockResolvedValue(undefined),
    } as any
    return { page, frames }
  }

  it('runs the settle in the page with the requested timeout', async () => {
    const { page, frames } = makePage([{ notReady: [], scrolled: true }])

    expect(await waitForVideos(page, 5000)).toEqual([])
    // The browser-side function is handed to evaluate() by reference so
    // Playwright serializes it: it must not be wrapped in a closure over
    // anything in this module.
    expect(frames[0].evaluate).toHaveBeenCalledWith(settleVideos, { timeoutMs: 5000 })
    expect(warn).not.toHaveBeenCalled()
  })

  it('defaults to a 5 second timeout', async () => {
    const { page, frames } = makePage([{ notReady: [], scrolled: false }])

    await waitForVideos(page)

    expect(frames[0].evaluate).toHaveBeenCalledWith(settleVideos, { timeoutMs: 5000 })
  })

  it('settles videos in every frame, not just the main one', async () => {
    // Drupal renders oEmbed and media embeds inside iframes, which is what
    // waitForFrames() exists for; a video in one of those is no less able to
    // break a comparison.
    const { page, frames } = makePage([
      { notReady: [], scrolled: true },
      { notReady: ['https://example.com/embed.mp4'], scrolled: true },
    ])

    expect(await waitForVideos(page)).toEqual(['https://example.com/embed.mp4'])
    expect(frames[1].evaluate).toHaveBeenCalledWith(settleVideos, { timeoutMs: 5000 })
  })

  it('keeps going when a frame has gone away', async () => {
    const { page } = makePage([
      new Error('Execution context was destroyed'),
      { notReady: [], scrolled: true },
    ])

    expect(await waitForVideos(page)).toEqual([])
  })

  it('lets the admin toolbar settle after a video moved the page', async () => {
    const { page } = makePage([{ notReady: [], scrolled: true }], 1)

    await waitForVideos(page)

    // The toolbar keeps moving after the browser has reported the new Y
    // position, exactly as waitForImages() has to allow for.
    expect(page.waitForTimeout).toHaveBeenCalledWith(250)
  })

  it('does not wait on the toolbar when nothing scrolled', async () => {
    const { page } = makePage([{ notReady: [], scrolled: false }], 1)

    await waitForVideos(page)

    expect(page.waitForTimeout).not.toHaveBeenCalled()
  })

  it('warns about, and returns, the videos that never became ready', async () => {
    const { page } = makePage([
      { notReady: ['https://example.com/a.mp4', 'https://example.com/b.mp4'], scrolled: true },
    ])

    const notReady = await waitForVideos(page, 1000)

    expect(notReady).toEqual(['https://example.com/a.mp4', 'https://example.com/b.mp4'])
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0][0]).toContain('2 video(s) had no frame available within 1000ms')
    expect(warn.mock.calls[0][0]).toContain('https://example.com/a.mp4, https://example.com/b.mp4')
  })
})

describe('restoreVideoPlayback', () => {
  function makePage(frameCount: number, failing: number[] = []) {
    const frames = Array.from({ length: frameCount }, (_unused, index) => ({
      evaluate: vi.fn().mockImplementation(() =>
        failing.includes(index)
          ? Promise.reject(new Error('Execution context was destroyed'))
          : Promise.resolve(undefined)
      ),
    }))
    return { page: { frames: () => frames } as any, frames }
  }

  it('restores playback in every frame', async () => {
    const { page, frames } = makePage(2)

    await restoreVideoPlayback(page)

    for (const frame of frames) {
      // By reference, for the same serialization reason as settleVideos().
      expect(frame.evaluate).toHaveBeenCalledWith(restorePlayback)
    }
  })

  it('keeps going when a frame has gone away', async () => {
    const { page, frames } = makePage(2, [0])

    await expect(restoreVideoPlayback(page)).resolves.toBeUndefined()
    expect(frames[1].evaluate).toHaveBeenCalledWith(restorePlayback)
  })
})
