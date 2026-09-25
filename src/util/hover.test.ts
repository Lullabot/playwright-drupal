import {afterEach, describe, expect, it, vi} from 'vitest'
import {clearHover} from './hover'

function fakePage() {
  let shield: any
  const document = {
    querySelector: vi.fn(() => shield),
    createElement: vi.fn(() => {
      shield = {
        setAttribute: vi.fn(),
        style: {cssText: ''},
        remove: vi.fn(() => {
          shield = undefined
        }),
      }
      return shield
    }),
    documentElement: {
      appendChild: vi.fn(),
    },
  }
  const page = {
    evaluate: vi.fn(async (callback: (attribute: string) => void, attribute: string) => {
      vi.stubGlobal('document', document)
      callback(attribute)
    }),
    mouse: {
      move: vi.fn().mockResolvedValue(undefined),
    },
  }

  return {document, page, getShield: () => shield}
}

describe('clearHover', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('covers page content and moves the pointer onto the shield', async () => {
    const {document, page, getShield} = fakePage()

    const cleanup = await clearHover(page as any)
    const shield = getShield()

    expect(document.createElement).toHaveBeenCalledWith('playwright-drupal-hover-shield')
    expect(shield.setAttribute).toHaveBeenCalledWith('aria-hidden', 'true')
    expect(shield.style.cssText).toContain('position: fixed !important')
    expect(shield.style.cssText).toContain('pointer-events: auto !important')
    expect(shield.style.cssText).toContain('opacity: 0 !important')
    expect(document.documentElement.appendChild).toHaveBeenCalledWith(shield)
    expect(page.mouse.move).toHaveBeenCalledWith(0, 0)

    await cleanup()
    expect(shield.remove).toHaveBeenCalledOnce()
  })

  it('makes cleanup idempotent', async () => {
    const {page, getShield} = fakePage()
    const cleanup = await clearHover(page as any)
    const shield = getShield()

    await cleanup()
    await cleanup()

    expect(shield.remove).toHaveBeenCalledOnce()
  })

  it('removes the shield when moving the pointer fails', async () => {
    const {page, getShield} = fakePage()
    page.mouse.move.mockRejectedValueOnce(new Error('mouse failed'))

    await expect(clearHover(page as any)).rejects.toThrow('mouse failed')
    expect(getShield()).toBeUndefined()
  })
})
