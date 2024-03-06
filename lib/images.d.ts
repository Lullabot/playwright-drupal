import { Page } from "@playwright/test";
import { Serializable } from "playwright-core/types/structs";
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
export declare function waitForImages(page: Page, selector: string): Promise<Serializable>;
/**
 * Wait for all image tags on the page to load.
 *
 * @param page
 */
export declare function waitForAllImages(page: Page): Promise<Serializable>;
