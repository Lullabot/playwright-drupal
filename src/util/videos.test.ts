import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { settleVideos } from './videos'

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
  paused?: boolean
  autoplay?: boolean
  currentTime?: number
  /** When false, assigning currentTime throws, as on a live stream. */
  seekable?: boolean
  rect?: { width: number, height: number }
  style?: { visibility?: string, display?: string }
}

function makeVideo(options: FakeVideoOptions = {}) {
  let currentTime = options.currentTime ?? 0
  const readyAt = options.readyAfterMs === undefined ? undefined : Date.now() + options.readyAfterMs
  const initialReadyState = options.readyState ?? 4

  const video: any = {
    src: options.src ?? '',
    autoplay: options.autoplay ?? false,
    paused: options.paused ?? true,
    scrolledIntoView: 0,
    pauseCalls: 0,
    seeks: [] as number[],
    getBoundingClientRect: () => options.rect ?? { width: 640, height: 480 },
    querySelector: (selector: string) =>
      selector === 'source' && options.sourceSrc
        ? { getAttribute: () => options.sourceSrc }
        : null,
    events: [] as string[],
    scrollIntoView: () => {
      video.scrolledIntoView++
      video.events.push('scroll')
      // Chromium starts a muted autoplay video once it is on screen, which is
      // why the attribute has to be cleared before this happens and not after.
      if (video.autoplay) video.paused = false
    },
    pause: () => {
      video.pauseCalls++
      video.events.push('pause')
      video.paused = true
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
    },
  })

  return video
}

/**
 * Install the browser globals settleVideos() reaches for.
 */
function installDom(videos: any[], scroll = { x: 0, y: 0 }) {
  const scrolls: Array<{ top: number, left: number }> = []
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
  vi.stubGlobal('window', {
    scrollX: scroll.x,
    scrollY: scroll.y,
    scroll: (opts: { top: number, left: number }) => scrolls.push(opts),
  })
  return scrolls
}

describe('settleVideos', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('reports nothing when there are no videos', async () => {
    installDom([])
    expect(await settleVideos({ timeoutMs: 100 })).toEqual([])
  })

  it('composites, pauses and rewinds a playing autoplay video', async () => {
    const video = makeVideo({ src: 'https://example.com/v.mp4', autoplay: true, paused: false, currentTime: 3.5 })
    installDom([video])

    expect(await settleVideos({ timeoutMs: 100 })).toEqual([])

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

    expect(await settleVideos({ timeoutMs: 100 })).toEqual([])
    expect(video.paused).toBe(true)
  })

  it('waits for a slow video to produce a frame', async () => {
    const video = makeVideo({ src: 'https://example.com/slow.mp4', readyState: 0, readyAfterMs: 120 })
    installDom([video])

    expect(await settleVideos({ timeoutMs: 2000, pollMs: 10 })).toEqual([])
    expect(video.readyState).toBe(4)
  })

  it('reports a video that never produces a frame instead of hanging', async () => {
    const video = makeVideo({ src: 'https://example.com/missing.mp4', readyState: 0 })
    installDom([video])

    expect(await settleVideos({ timeoutMs: 60, pollMs: 10 })).toEqual(['https://example.com/missing.mp4'])
    // Reported, but still pinned down: it must not start playing if it becomes
    // ready between here and the capture.
    expect(video.autoplay).toBe(false)
  })

  it('falls back to a nested <source> when reporting an unready video', async () => {
    const video = makeVideo({ readyState: 0, sourceSrc: '/files/missing.mp4' })
    installDom([video])

    expect(await settleVideos({ timeoutMs: 60, pollMs: 10 })).toEqual(['https://example.com/files/missing.mp4'])
  })

  it('skips videos that are not visible', async () => {
    const zeroSized = makeVideo({ src: 'https://example.com/a.mp4', rect: { width: 0, height: 0 } })
    const hidden = makeVideo({ src: 'https://example.com/b.mp4' })
    hidden.styleVisibility = 'hidden'
    const notDisplayed = makeVideo({ src: 'https://example.com/c.mp4' })
    notDisplayed.styleDisplay = 'none'
    installDom([zeroSized, hidden, notDisplayed])

    expect(await settleVideos({ timeoutMs: 100 })).toEqual([])
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

    expect(await settleVideos({ timeoutMs: 100 })).toEqual([])
    for (const video of [first, second]) {
      expect(video.scrolledIntoView).toBe(1)
      expect(video.paused).toBe(true)
      expect(video.currentTime).toBe(0)
    }
  })
})
