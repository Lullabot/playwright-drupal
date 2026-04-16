import { describe, it, expect, vi } from 'vitest';
import { clickSaveButton, waitForSaveOutcome } from './forms';

describe('clickSaveButton', () => {
  function makeBtn({
    visible = true,
    value = '',
    dataOnce = '',
  }: {
    visible?: boolean;
    value?: string;
    dataOnce?: string;
  }) {
    return {
      isVisible: vi.fn().mockResolvedValue(visible),
      getAttribute: vi.fn().mockImplementation((name: string) => {
        if (name === 'value') return Promise.resolve(value);
        if (name === 'data-once') return Promise.resolve(dataOnce);
        return Promise.resolve(null);
      }),
      scrollIntoViewIfNeeded: vi.fn().mockResolvedValue(undefined),
      click: vi.fn().mockResolvedValue(undefined),
    };
  }

  function makePage(candidates: ReturnType<typeof makeBtn>[], fallbackBtn: ReturnType<typeof makeBtn>) {
    const locators: Record<string, unknown> = {
      'input[type=submit][name="op"]': {
        count: () => Promise.resolve(candidates.length),
        nth: (i: number) => candidates[i],
      },
    };
    return {
      locator: (selector: string) => {
        if (selector in locators) return locators[selector] as never;
        return fallbackBtn as never;
      },
    } as never;
  }

  it('skips buttons carrying the autosave_form once-marker and clicks the real Save', async () => {
    const autosaveBtn = makeBtn({ value: 'Save', dataOnce: 'autosave-form-input-monitor' });
    const realSaveBtn = makeBtn({ value: 'Save' });
    const fallbackBtn = makeBtn({ value: 'Fallback' });

    await clickSaveButton(makePage([autosaveBtn, realSaveBtn], fallbackBtn), '#fallback');

    expect(autosaveBtn.click).not.toHaveBeenCalled();
    expect(realSaveBtn.click).toHaveBeenCalledWith({ force: true });
    expect(fallbackBtn.click).not.toHaveBeenCalled();
  });

  it('matches "Save as" buttons (Thunder moderation)', async () => {
    const saveAsBtn = makeBtn({ value: 'Save as' });
    const fallbackBtn = makeBtn({ value: 'Fallback' });

    await clickSaveButton(makePage([saveAsBtn], fallbackBtn), '#fallback');

    expect(saveAsBtn.click).toHaveBeenCalledWith({ force: true });
  });

  it('skips buttons whose value does not start with "Save"', async () => {
    const deleteBtn = makeBtn({ value: 'Delete' });
    const previewBtn = makeBtn({ value: 'Preview' });
    const fallbackBtn = makeBtn({ value: 'Fallback' });

    await clickSaveButton(makePage([deleteBtn, previewBtn], fallbackBtn), '#fallback');

    expect(deleteBtn.click).not.toHaveBeenCalled();
    expect(previewBtn.click).not.toHaveBeenCalled();
    expect(fallbackBtn.click).toHaveBeenCalledWith({ force: true });
  });

  it('falls back when no candidates are visible', async () => {
    const hiddenBtn = makeBtn({ visible: false, value: 'Save' });
    const fallbackBtn = makeBtn({ value: 'Fallback' });

    await clickSaveButton(makePage([hiddenBtn], fallbackBtn), '#fallback');

    expect(hiddenBtn.click).not.toHaveBeenCalled();
    expect(fallbackBtn.click).toHaveBeenCalledWith({ force: true });
  });
});

describe('waitForSaveOutcome', () => {
  function makePage({
    urlChanges,
    errorAppears,
    rejectAll,
  }: {
    urlChanges?: boolean;
    errorAppears?: boolean;
    rejectAll?: boolean;
  }) {
    return {
      waitForURL: vi.fn().mockImplementation(() => {
        if (rejectAll || !urlChanges) return new Promise((_res, rej) => setTimeout(() => rej(new Error('url timeout')), 5));
        return Promise.resolve();
      }),
      locator: () => ({
        first: () => ({
          waitFor: vi.fn().mockImplementation(() => {
            if (rejectAll || !errorAppears) return new Promise((_res, rej) => setTimeout(() => rej(new Error('locator timeout')), 5));
            return Promise.resolve();
          }),
        }),
      }),
    } as never;
  }

  it('returns "ok" when the URL changes away from the add-form', async () => {
    const result = await waitForSaveOutcome(
      makePage({ urlChanges: true }),
      { addFormPathPattern: /\/node\/add\//, timeout: 50 },
    );
    expect(result).toBe('ok');
  });

  it('returns "error" when the error message appears first', async () => {
    const result = await waitForSaveOutcome(
      makePage({ errorAppears: true }),
      { addFormPathPattern: /\/node\/add\//, timeout: 50 },
    );
    expect(result).toBe('error');
  });

  it('throws a descriptive error when neither outcome occurs within the timeout', async () => {
    await expect(
      waitForSaveOutcome(
        makePage({ rejectAll: true }),
        { addFormPathPattern: /\/node\/add\//, timeout: 20 },
      ),
    ).rejects.toThrow(/neither a URL change.*nor a \.messages--error appeared/);
  });
});
