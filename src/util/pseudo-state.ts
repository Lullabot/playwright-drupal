import {Page} from '@playwright/test'

/** Pseudo-classes supported by Chromium's CSS.forcePseudoState command. */
export type ForcedPseudoClass =
  | 'active'
  | 'focus'
  | 'focus-visible'
  | 'focus-within'
  | 'hover'
  | 'target'

/** A CSS selector and the pseudo-classes to force on its first match. */
export interface ForcedPseudoState {
  selector: string
  pseudoClasses: ForcedPseudoClass[]
}

/**
 * Force CSS pseudo-classes on the first element matching a selector.
 *
 * This uses Chromium's DevTools Protocol and therefore only works in Chromium
 * projects. The state is synthetic: moving the pointer or blurring the active
 * element does not clear it. Call the returned idempotent cleanup function when
 * the screenshot and accessibility scan are complete.
 */
export async function forcePseudoState(
  page: Page,
  selector: string,
  pseudoClasses: ForcedPseudoClass[],
): Promise<() => Promise<void>> {
  let session
  try {
    session = await page.context().newCDPSession(page)
  } catch (error) {
    throw new Error('forcePseudoState() requires a Chromium browser project.', {cause: error})
  }

  try {
    await session.send('DOM.enable')
    await session.send('CSS.enable')
    const {root} = await session.send('DOM.getDocument')
    const {nodeId} = await session.send('DOM.querySelector', {
      nodeId: root.nodeId,
      selector,
    })

    if (!nodeId) {
      throw new Error(`forcePseudoState() could not find an element matching "${selector}".`)
    }

    await session.send('CSS.forcePseudoState', {nodeId, forcedPseudoClasses: pseudoClasses})

    let cleared = false
    return async () => {
      if (cleared) {
        return
      }
      cleared = true
      try {
        await session.send('CSS.forcePseudoState', {nodeId, forcedPseudoClasses: []})
      } finally {
        await session.detach()
      }
    }
  } catch (error) {
    await session.detach()
    throw error
  }
}
