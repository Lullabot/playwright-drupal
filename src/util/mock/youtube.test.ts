import { describe, it, expect, vi } from 'vitest'
import { YoutubeMock } from './youtube'

describe('YoutubeMock', () => {
  it('registers a route handler for youtube.com', async () => {
    const mockPage = {
      route: vi.fn(),
    }

    const mock = new YoutubeMock()
    await mock.mock(mockPage as any)

    expect(mockPage.route).toHaveBeenCalledOnce()
    const [pattern] = mockPage.route.mock.calls[0]
    expect(pattern).toBeInstanceOf(RegExp)
    expect(pattern.test('https://www.youtube.com/embed/abc123')).toBe(true)
    expect(pattern.test('https://www.notyoutube.com')).toBe(false)
  })

  it('fulfills with HTML mock content', async () => {
    const mockFulfill = vi.fn()
    const mockPage = {
      route: vi.fn(),
    }

    const mock = new YoutubeMock()
    await mock.mock(mockPage as any)

    // Call the route handler
    const handler = mockPage.route.mock.calls[0][1]
    await handler({ fulfill: mockFulfill })

    expect(mockFulfill).toHaveBeenCalledOnce()
    const fulfillArg = mockFulfill.mock.calls[0][0]
    expect(fulfillArg.contentType).toBe('text/html')
    expect(fulfillArg.body).toContain('Youtube Video Mock')
  })
})
