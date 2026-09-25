import {Page} from "@playwright/test";

const HOVER_SHIELD_ATTRIBUTE = 'data-playwright-drupal-hover-shield';

/**
 * Move the pointer away from page content for a deterministic screenshot.
 *
 * Pointer position survives clicks, navigation, and layout changes. That can
 * leave an unrelated element under the pointer and activate its `:hover`
 * styles. A transparent shield gives the pointer a neutral target regardless
 * of what the page renders at the chosen coordinate.
 *
 * The returned cleanup function removes the shield. Call it after the
 * screenshot so normal pointer hit testing is restored.
 */
export async function clearHover(page: Page): Promise<() => Promise<void>> {
  await page.evaluate((attribute) => {
    document.querySelector(`[${attribute}]`)?.remove();

    const shield = document.createElement('playwright-drupal-hover-shield');
    shield.setAttribute(attribute, '');
    shield.setAttribute('aria-hidden', 'true');
    shield.style.cssText = [
      'all: initial !important',
      'position: fixed !important',
      'inset: 0 !important',
      'display: block !important',
      'width: 100vw !important',
      'height: 100vh !important',
      'margin: 0 !important',
      'padding: 0 !important',
      'border: 0 !important',
      'opacity: 0 !important',
      'pointer-events: auto !important',
      'z-index: 2147483647 !important',
    ].join(';');
    document.documentElement.appendChild(shield);
  }, HOVER_SHIELD_ATTRIBUTE);

  try {
    // Playwright emits a mousemove even when the pointer was already at this
    // coordinate, ensuring mouseleave/pointerleave handlers get a chance to
    // respond to the new hit target.
    await page.mouse.move(0, 0);
  } catch (error) {
    await removeHoverShield(page);
    throw error;
  }

  let removed = false;
  return async () => {
    if (removed) {
      return;
    }
    removed = true;
    await removeHoverShield(page);
  };
}

async function removeHoverShield(page: Page): Promise<void> {
  await page.evaluate((attribute) => {
    document.querySelector(`[${attribute}]`)?.remove();
  }, HOVER_SHIELD_ATTRIBUTE);
}
