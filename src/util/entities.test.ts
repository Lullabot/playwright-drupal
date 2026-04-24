import { describe, it, expect, vi } from 'vitest';
import { extractEntityIdFromPage } from './entities';

function makePage({
  url,
  editHref,
  currentPath,
}: {
  url: string;
  editHref?: string | null;
  currentPath?: string | null;
}) {
  return {
    url: () => url,
    evaluate: vi.fn().mockImplementation(() => {
      if (currentPath === undefined) return Promise.reject(new Error('boom'));
      return Promise.resolve(currentPath);
    }),
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

  it('extracts from drupalSettings.path.currentPath when the URL is path-aliased and no canonical edit link is rendered', async () => {
    const id = await extractEntityIdFromPage(
      makePage({
        url: 'http://example.test/news/my-article',
        currentPath: 'node/99',
        editHref: '/news/my-article/edit',
      }),
      'node',
    );
    expect(id).toBe('99');
  });

  it('extracts from an edit-link fallback when the URL is path-aliased and drupalSettings is unavailable', async () => {
    const id = await extractEntityIdFromPage(
      makePage({ url: 'http://example.test/my-article', currentPath: null, editHref: '/node/99/edit' }),
      'node',
    );
    expect(id).toBe('99');
  });

  it('works for media entities', async () => {
    const id = await extractEntityIdFromPage(makePage({ url: 'http://example.test/media/7' }), 'media');
    expect(id).toBe('7');
  });

  it('accepts arbitrary entity types (e.g. user)', async () => {
    const id = await extractEntityIdFromPage(makePage({ url: 'http://example.test/user/3' }), 'user');
    expect(id).toBe('3');
  });

  it('returns undefined when URL, drupalSettings, and edit link all miss', async () => {
    const id = await extractEntityIdFromPage(
      makePage({ url: 'http://example.test/unrelated', currentPath: null, editHref: null }),
      'node',
    );
    expect(id).toBeUndefined();
  });

  it('returns undefined when every lookup rejects', async () => {
    const id = await extractEntityIdFromPage(
      makePage({ url: 'http://example.test/unrelated' }),
      'node',
    );
    expect(id).toBeUndefined();
  });
});
