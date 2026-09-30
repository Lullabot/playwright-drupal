import {test, expect} from '@playwright/test'
import {takeAccessibleScreenshot} from '../../src/util/accessible-screenshot'

const html = `<!doctype html><html lang="en"><title>Clip fixture</title>
<style>body{margin:0;background:white}main{position:absolute;left:40.125px;top:800.125px;width:240.25px;height:160.25px;background:#246}h1{margin:20px;color:white;font:24px sans-serif}body{height:1800px;width:1000px}</style>
<main><h1>Original content</h1></main></html>`
const accessibility = {baseline: [], bestPracticeMode: 'off' as const, screenshotViolations: false}

for (const fullPage of [false, true]) {
  test(`derived clip ${fullPage ? 'document' : 'viewport'}`, async ({page}, info) => {
    await page.setContent(html)
    if (process.env.CLIP_MUTATION === 'content') await page.locator('h1').evaluate(el => {el.textContent = 'Changed content'})
    if (process.env.CLIP_MUTATION === 'layout') await page.locator('h1').evaluate(el => {el.style.marginLeft = '40px'})
    await takeAccessibleScreenshot(page, info, {clipLocator: page.locator('main'), fullPage, accessibility, threshold: 0, maxDiffPixels: 0})
    expect(info.errors).toHaveLength(0)
  })
}

test('fractional enclosure reproduction', async ({page}, info) => {
  await page.setContent(html)
  const target = page.locator('main')
  await target.evaluate(el => {el.style.width = '240.75px'; el.style.background = 'white'; el.style.color = 'white'; el.replaceChildren()})
  const sizes: number[] = []
  const rounded: Buffer[] = []
  for (const left of [40.125, 40.375]) {
    await target.evaluate((el, x) => {el.style.left = `${x}px`}, left)
    const raw = await target.screenshot({scale: 'css'})
    sizes.push(raw.readUInt32BE(16))
    const b = (await target.boundingBox())!
    rounded.push(await page.screenshot({clip: {x: Math.round(b.x), y: Math.round(b.y), width: Math.round(b.width), height: Math.round(b.height)}, scale: 'css'}))
  }
  await info.attach('fractional-widths', {body: JSON.stringify(sizes), contentType: 'application/json'})
  expect(Math.abs(sizes[0] - sizes[1])).toBe(1)
  expect(rounded[0]).toEqual(rounded[1])
})

test('accessibility includes content outside clip', async ({page}, info) => {
  await page.setContent(html + '<img width="10" height="10" src="data:image/svg+xml,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22%20width=%2210%22%20height=%2210%22/%3E">')
  await expect(takeAccessibleScreenshot(page, info, {clipLocator: page.locator('main'), accessibility})).rejects.toThrow('image-alt')
})

test('oversized target requires fullPage', async ({page}, info) => {
  await page.setContent(html)
  await page.locator('main').evaluate(el => {el.style.height = '600px'})
  await expect(takeAccessibleScreenshot(page, info, {clipLocator: page.locator('main'), accessibility})).rejects.toThrow('use fullPage')
  await takeAccessibleScreenshot(page, info, {clipLocator: page.locator('main'), fullPage: true, accessibility})
})

test('horizontal document scroll and frame locator', async ({page}, info) => {
  await page.setContent(html)
  await page.locator('main').evaluate(el => {el.style.left = '800.125px'})
  await takeAccessibleScreenshot(page, info, {clipLocator: page.locator('main'), fullPage: true, accessibility})
  expect(await page.evaluate(() => scrollX)).toBeGreaterThan(0)

  const inner = '<html lang="en"><title>Inner</title><main style="width:200px;height:100px;background:green;color:white">Frame content</main></html>'
  await page.route('https://fixture.test/**', route => route.fulfill({
    contentType: 'text/html',
    body: route.request().url().endsWith('/frame') ? inner : '<html lang="en"><title>Frame fixture</title><iframe title="Content" style="margin-top:800px;width:300px;height:200px" src="/frame"></iframe></html>',
  }))
  await page.goto('https://fixture.test/')
  await takeAccessibleScreenshot(page, info, {clipLocator: page.frameLocator('iframe').locator('main'), fullPage: true, accessibility})
})
