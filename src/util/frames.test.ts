import { describe, expect, it, vi } from 'vitest';

import { waitForFrames } from './frames';

function makeLocator({
  connected = true,
  visible = true,
  frame = makeFrame(),
}: {
  connected?: boolean;
  visible?: boolean;
  frame?: ReturnType<typeof makeFrame> | null;
} = {}) {
  const element = {
    contentFrame: vi.fn().mockResolvedValue(frame),
  };

  return {
    evaluate: vi.fn().mockResolvedValue(connected),
    isVisible: vi.fn().mockResolvedValue(visible),
    scrollIntoViewIfNeeded: vi.fn().mockResolvedValue(undefined),
    elementHandle: vi.fn().mockResolvedValue(element),
    element,
  };
}

function makeFrame() {
  return {
    waitForURL: vi.fn().mockResolvedValue(undefined),
    waitForLoadState: vi.fn().mockResolvedValue(undefined),
  };
}

function makePage(locators: ReturnType<typeof makeLocator>[]) {
  return {
    locator: vi.fn().mockReturnValue({
      all: vi.fn().mockResolvedValue(locators),
    }),
  } as never;
}

describe('waitForFrames', () => {
  it('waits for each visible frame URL and load state', async () => {
    const first = makeLocator();
    const second = makeLocator();

    await waitForFrames(makePage([first, second]));

    for (const locator of [first, second]) {
      expect(locator.scrollIntoViewIfNeeded).toHaveBeenCalledTimes(2);
      expect(locator.element.contentFrame).toHaveBeenCalledOnce();
      expect(locator.element.contentFrame.mock.results[0].value).toBeInstanceOf(Promise);
      const frame = await locator.element.contentFrame.mock.results[0].value;
      expect(frame?.waitForURL).toHaveBeenCalledOnce();
      expect(frame?.waitForLoadState).toHaveBeenCalledWith('load');
    }
  });

  it('ignores frames that are detached or hidden', async () => {
    const detached = makeLocator({ connected: false });
    const hidden = makeLocator({ visible: false });

    await waitForFrames(makePage([detached, hidden]));

    expect(detached.isVisible).not.toHaveBeenCalled();
    expect(detached.elementHandle).not.toHaveBeenCalled();
    expect(hidden.elementHandle).not.toHaveBeenCalled();
  });

  it('tolerates an iframe that detaches before its content frame is resolved', async () => {
    const locator = makeLocator({ frame: null });

    await expect(waitForFrames(makePage([locator]))).resolves.toBeUndefined();
  });
});
