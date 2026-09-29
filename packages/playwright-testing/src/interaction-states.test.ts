import {describe, expect, it, vi} from 'vitest'
import {applyInteractionStates, validateInteractionStates} from './interaction-states'

describe('validateInteractionStates', () => {
  it('rejects states that real input cannot hold simultaneously', () => {
    const locator = {} as never
    expect(() => validateInteractionStates([
      {locator, states: ['hover']},
      {locator, states: ['hover']},
    ])).toThrow('at most one')
    expect(() => validateInteractionStates([
      {locator, states: ['focus', 'focus']},
    ])).toThrow('cannot repeat')
  })
})

describe('applyInteractionStates', () => {
  it('applies hover before focus and cleans both states up', async () => {
    const hover = vi.fn().mockResolvedValue(undefined)
    const focus = vi.fn().mockResolvedValue(undefined)
    const blur = vi.fn().mockResolvedValue(undefined)
    const clearHover = vi.fn().mockResolvedValue(undefined)

    const cleanup = await applyInteractionStates([
      {locator: {hover, focus: vi.fn(), blur: vi.fn()} as never, states: ['hover']},
      {locator: {hover: vi.fn(), focus, blur} as never, states: ['focus']},
    ], {clearHover})

    expect(hover.mock.invocationCallOrder[0]).toBeLessThan(focus.mock.invocationCallOrder[0])
    await cleanup()
    await cleanup()
    expect(blur).toHaveBeenCalledOnce()
    expect(clearHover).toHaveBeenCalledOnce()
  })

  it('cleans already-applied state when a later interaction fails', async () => {
    const clearHover = vi.fn().mockResolvedValue(undefined)
    const blur = vi.fn().mockResolvedValue(undefined)
    const failure = new Error('focus failed')

    await expect(applyInteractionStates([
      {locator: {hover: vi.fn().mockResolvedValue(undefined)} as never, states: ['hover']},
      {locator: {focus: vi.fn().mockRejectedValue(failure), blur} as never, states: ['focus']},
    ], {clearHover})).rejects.toBe(failure)
    expect(blur).toHaveBeenCalledOnce()
    expect(clearHover).toHaveBeenCalledOnce()
  })
})
