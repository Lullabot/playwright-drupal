import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { decodeVisibleImages, settleImage, waitForImagesToDecode } from './images'

/**
 * A stand-in for the parts of HTMLImageElement decodeVisibleImages() touches.
 *
 * decodeVisibleImages() runs in the browser, so it is exercised here against a
 * fake DOM rather than a real page: each image declares whether it is loaded,
 * still loading, or broken, and a broken one can be told to recover the way a
 * Stage File Proxy URL does once its on-demand fetch finishes.
 */
interface FakeImageOptions {
  src?: string
  currentSrc?: string
  width?: number
  height?: number
  rect?: { width: number, height: number }
  style?: { visibility?: string, display?: string }
  /** 'loaded', 'loading' (never completes on its own), or 'broken'. */
  state?: 'loaded' | 'loading' | 'broken'
  /** Whether a re-request makes a broken image decode. */
  recoversOnReload?: boolean
  /** <source> elements of an enclosing <picture>, if any. */
  sources?: string[]
}

function makeImage(options: FakeImageOptions = {}) {
  const state = options.state ?? 'loaded'
  const sources = options.sources
  let src = options.src ?? 'https://example.com/image.jpg'
  let broken = state === 'broken'

  const img: any = {
    width: options.width ?? 100,
    height: options.height ?? 100,
    complete: state !== 'loading',
    naturalWidth: state === 'loaded' ? 100 : 0,
    currentSrc: options.currentSrc ?? '',
    removedAttributes: [] as string[],
    picture: sources
      ? {
        sources: sources.slice(),
        querySelectorAll: (_selector: string) =>
          img.picture.sources.map((name: string) => ({
            remove: () => {
              img.picture.sources = img.picture.sources.filter((s: string) => s !== name)
            },
          })),
      }
      : null,
    getBoundingClientRect: () => options.rect ?? { width: 100, height: 100 },
    style: {
      visibility: options.style?.visibility ?? 'visible',
      display: options.style?.display ?? 'block',
    },
    decode: () => (broken ? Promise.reject(new Error('decode failed')) : Promise.resolve()),
    closest: (selector: string) => (selector === 'picture' ? img.picture : null),
    removeAttribute: (name: string) => {
      img.removedAttributes.push(name)
    },
    /** Pretend the network finished, for images that start out loading. */
    finishLoading: () => {
      img.complete = true
      img.naturalWidth = 100
    },
  }

  Object.defineProperty(img, 'src', {
    get: () => src,
    set: (value: string) => {
      src = value
      // A re-request clears whatever the browser had resolved from srcset.
      img.currentSrc = ''
      if (options.recoversOnReload) {
        broken = false
        img.naturalWidth = 100
      }
    },
  })

  return img
}

function stubDom(images: any[]) {
  vi.stubGlobal('document', { images })
  vi.stubGlobal('location', { href: 'https://example.com/page' })
  vi.stubGlobal('getComputedStyle', (element: any) => element.style)
}

// Real timers, so the polling is real: keep the intervals tiny.
const fast = { pollMs: 1, reloadIntervalMs: 0 }

describe('decodeVisibleImages', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns no failures when every visible image has decoded', async () => {
    stubDom([makeImage(), makeImage()])

    expect(await decodeVisibleImages({ timeoutMs: 1000, ...fast })).toEqual([])
  })

  it('treats a dimensionless but decodable image as loaded', async () => {
    // An SVG with no intrinsic size is complete with a naturalWidth of 0, but
    // decode() resolves for it. It must not be re-requested or reported.
    const svg = makeImage({ src: 'https://example.com/logo.svg', state: 'broken' })
    svg.decode = () => Promise.resolve()
    stubDom([svg])

    expect(await decodeVisibleImages({ timeoutMs: 1000, ...fast })).toEqual([])
    expect(svg.src).toBe('https://example.com/logo.svg')
  })

  it('ignores 1x1, zero-size, and hidden images even when they are broken', async () => {
    stubDom([
      makeImage({ state: 'broken', width: 1, height: 1 }),
      makeImage({ state: 'broken', rect: { width: 0, height: 0 } }),
      makeImage({ state: 'broken', style: { visibility: 'hidden' } }),
      makeImage({ state: 'broken', style: { display: 'none' } }),
    ])

    expect(await decodeVisibleImages({ timeoutMs: 0, ...fast })).toEqual([])
  })

  it('waits for an image that is still loading', async () => {
    const loading = makeImage({ state: 'loading' })
    stubDom([loading])
    setTimeout(() => loading.finishLoading(), 5)

    expect(await decodeVisibleImages({ timeoutMs: 2000, ...fast })).toEqual([])
  })

  it('re-requests a broken image and reports success once it decodes', async () => {
    const broken = makeImage({
      src: 'https://example.com/broken.jpg',
      currentSrc: 'https://example.com/broken-800.jpg',
      state: 'broken',
      recoversOnReload: true,
      sources: ['source-1', 'source-2'],
    })
    stubDom([broken])

    expect(await decodeVisibleImages({ timeoutMs: 2000, ...fast })).toEqual([])
    // The retry reuses the URL already resolved from srcset, cache-busted...
    expect(broken.src).toMatch(/^https:\/\/example\.com\/broken-800\.jpg\?playwrightReload=\d+$/)
    // ...with the responsive sources dropped so that exact URL is fetched.
    expect(broken.removedAttributes).toContain('srcset')
    expect(broken.picture.sources).toEqual([])
  })

  it('leaves data: URLs alone', async () => {
    const data = makeImage({ src: 'data:image/png;base64,AAAA', state: 'broken' })
    stubDom([data])

    expect(await decodeVisibleImages({ timeoutMs: 0, ...fast })).toEqual(['data:image/png;base64,AAAA'])
    expect(data.src).toBe('data:image/png;base64,AAAA')
  })

  it('reports the images that never decode instead of returning silently', async () => {
    const broken = makeImage({ src: 'https://example.com/missing.jpg', state: 'broken' })
    const loading = makeImage({ src: 'https://example.com/slow.jpg', state: 'loading' })
    stubDom([makeImage(), broken, loading])

    const undecoded = await decodeVisibleImages({ timeoutMs: 20, ...fast })

    // The cache-busting parameter the retries added is stripped back off, so
    // the reported URL is the one the page asked for.
    expect(undecoded).toEqual([
      'https://example.com/missing.jpg',
      'https://example.com/slow.jpg',
    ])
  })

  it('checks the images at least once even with an elapsed timeout', async () => {
    stubDom([makeImage({ src: 'https://example.com/missing.jpg', state: 'broken' })])

    expect(await decodeVisibleImages({ timeoutMs: 0, ...fast })).toEqual([
      'https://example.com/missing.jpg',
    ])
  })
})

/**
 * A stand-in for the parts of HTMLImageElement settleImage() touches.
 *
 * settleImage() also runs in the browser, so it is exercised against a fake
 * element whose load and error events can be fired on demand.
 */
function makeSettleImage(options: { width?: number, height?: number, complete?: boolean } = {}) {
  const listeners: Record<string, Array<() => void>> = { load: [], error: [] }

  return {
    width: options.width ?? 100,
    height: options.height ?? 100,
    complete: options.complete ?? false,
    /** Assigning these instead of adding listeners would clobber the page's. */
    onload: null,
    onerror: null,
    addEventListener: (type: string, handler: () => void) => {
      listeners[type].push(handler)
    },
    removeEventListener: (type: string, handler: () => void) => {
      listeners[type] = listeners[type].filter(h => h !== handler)
    },
    fire: (type: 'load' | 'error') => {
      listeners[type].slice().forEach(handler => handler())
    },
    listenerCount: () => listeners.load.length + listeners.error.length,
  }
}

describe('settleImage', () => {
  it('does not wait for an image that has already settled', () => {
    const settled = makeSettleImage({ complete: true })

    // No promise back means nothing to await.
    expect(settleImage(settled as any)).toBeUndefined()
    expect(settled.listenerCount()).toBe(0)
  })

  it('does not wait for a 1x1 visually-hidden image', () => {
    // Chrome never loads these at desktop widths, so waiting would hang.
    const hidden = makeSettleImage({ width: 1, height: 1, complete: false })

    expect(settleImage(hidden as any)).toBeUndefined()
    expect(hidden.listenerCount()).toBe(0)
  })

  it('resolves once a loading image loads', async () => {
    const loading = makeSettleImage()
    const settled = settleImage(loading as any)
    loading.fire('load')

    await expect(settled).resolves.toBeUndefined()
  })

  it('resolves once a loading image errors', async () => {
    // The regression: an image that 404s or 503s after the wait begins only
    // ever fires `error`. Waiting on `load` alone hung until the test timed
    // out, and never reached the decode retry that could have recovered it.
    const loading = makeSettleImage()
    const settled = settleImage(loading as any)
    loading.fire('error')

    await expect(settled).resolves.toBeUndefined()
  })

  it('cleans up both listeners once settled, and leaves the page handlers alone', async () => {
    const loading = makeSettleImage()
    const settled = settleImage(loading as any)
    expect(loading.listenerCount()).toBe(2)

    loading.fire('error')
    await settled

    expect(loading.listenerCount()).toBe(0)
    // Assigning onload/onerror would have replaced whatever the page installed.
    expect(loading.onload).toBeNull()
    expect(loading.onerror).toBeNull()
  })
})

describe('waitForImagesToDecode', () => {
  let warn: any

  beforeEach(() => {
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    warn.mockRestore()
  })

  function makePage(undecoded: string[]) {
    return {
      evaluate: vi.fn().mockResolvedValue(undecoded),
    } as any
  }

  it('runs the decode poll in the page with the requested timeout', async () => {
    const page = makePage([])

    expect(await waitForImagesToDecode(page, 5000)).toEqual([])
    // The browser-side function is handed to evaluate() by reference so
    // Playwright serializes it: it must not be wrapped in a closure over
    // anything in this module.
    expect(page.evaluate).toHaveBeenCalledWith(decodeVisibleImages, { timeoutMs: 5000 })
    expect(warn).not.toHaveBeenCalled()
  })

  it('defaults to a 15 second timeout', async () => {
    const page = makePage([])

    await waitForImagesToDecode(page)

    expect(page.evaluate).toHaveBeenCalledWith(decodeVisibleImages, { timeoutMs: 15000 })
  })

  it('warns about, and returns, the images that never decoded', async () => {
    const page = makePage(['https://example.com/a.jpg', 'https://example.com/b.jpg'])

    const undecoded = await waitForImagesToDecode(page, 1000)

    expect(undecoded).toEqual(['https://example.com/a.jpg', 'https://example.com/b.jpg'])
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0][0]).toContain('2 image(s) did not finish loading within 1000ms')
    expect(warn.mock.calls[0][0]).toContain('https://example.com/a.jpg, https://example.com/b.jpg')
  })
})
