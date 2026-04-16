import { describe, it, expect, vi } from 'vitest';
import { extractEntityIdFromPage } from './entities';

function makePage({ url, editHref }: { url: string; editHref?: string | null }) {
  return {
    url: () => url,
    locator: (_sel: string) => ({
      first: () => ({
        getAttribute: vi.fn().mockImplementation(() => {
          if (editHref === undefined) return Promise.reject(new Error('boom'));
          return Promise.resolve(editHref);
        }),
      }),
    }),
  } as never;
}

describe('extractEntityIdFromPage', () => {
  it('extracts from a direct /node/N URL', async () => {
    const id = await extractEntityIdFromPage(makePage({ url: 'http://example.test/node/42' }), 'node');
    expect(id).toBe('42');
  });

  it('extracts from an edit-link fallback when the URL is path-aliased', async () => {
    const id = await extractEntityIdFromPage(
      makePage({ url: 'http://example.test/my-article', editHref: '/node/99/edit' }),
      'node',
    );
    expect(id).toBe('99');
  });

  it('works for media entities', async () => {
    const id = await extractEntityIdFromPage(makePage({ url: 'http://example.test/media/7' }), 'media');
    expect(id).toBe('7');
  });

  it('returns undefined when neither the URL nor an edit link matches', async () => {
    const id = await extractEntityIdFromPage(
      makePage({ url: 'http://example.test/unrelated', editHref: null }),
      'node',
    );
    expect(id).toBeUndefined();
  });

  it('returns undefined when the edit-link lookup rejects', async () => {
    const id = await extractEntityIdFromPage(
      makePage({ url: 'http://example.test/unrelated' }),
      'node',
    );
    expect(id).toBeUndefined();
  });
});
