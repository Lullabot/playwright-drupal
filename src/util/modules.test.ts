import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../testcase/test', () => ({
  execDrushInTestSite: vi.fn(),
}));

import { execDrushInTestSite } from '../testcase/test';
import { isModuleEnabled, validateRequiredModules, isFieldUiEnabled } from './modules';

const mockedDrush = vi.mocked(execDrushInTestSite);

describe('isModuleEnabled', () => {
  beforeEach(() => mockedDrush.mockReset());

  it('returns true when the module appears on its own line', async () => {
    mockedDrush.mockResolvedValueOnce({ stdout: 'node\nfield_ui\nviews\n', stderr: '' } as never);
    expect(await isModuleEnabled('field_ui')).toBe(true);
  });

  it('returns false when the module is absent', async () => {
    mockedDrush.mockResolvedValueOnce({ stdout: 'node\nviews\n', stderr: '' } as never);
    expect(await isModuleEnabled('field_ui')).toBe(false);
  });

  it('tolerates trailing whitespace on lines', async () => {
    mockedDrush.mockResolvedValueOnce({ stdout: '  node  \n  field_ui  \n', stderr: '' } as never);
    expect(await isModuleEnabled('field_ui')).toBe(true);
  });
});

describe('validateRequiredModules', () => {
  beforeEach(() => mockedDrush.mockReset());

  it('resolves when all modules are enabled', async () => {
    mockedDrush.mockResolvedValue({ stdout: 'field_ui\ndblog\n', stderr: '' } as never);
    await expect(validateRequiredModules({} as never, ['field_ui', 'dblog'])).resolves.toBeUndefined();
  });

  it('throws listing every missing module', async () => {
    mockedDrush.mockResolvedValue({ stdout: 'node\n', stderr: '' } as never);
    await expect(
      validateRequiredModules({} as never, ['field_ui', 'dblog']),
    ).rejects.toThrow(/field_ui, dblog/);
  });
});

describe('isFieldUiEnabled', () => {
  beforeEach(() => mockedDrush.mockReset());

  it('returns true when Drush reports field_ui enabled', async () => {
    mockedDrush.mockResolvedValueOnce({ stdout: 'field_ui\n', stderr: '' } as never);
    const fakePage = { goto: vi.fn() } as never;
    expect(await isFieldUiEnabled(fakePage)).toBe(true);
    expect(fakePage.goto).not.toHaveBeenCalled();
  });

  it('falls through to UI probe when Drush rejects', async () => {
    mockedDrush.mockRejectedValueOnce(new Error('drush unavailable'));
    const fakePage = {
      goto: vi.fn().mockResolvedValue({ ok: () => true }),
      locator: () => ({
        count: () => Promise.resolve(0),
        first: () => ({
          count: () => Promise.resolve(0),
          textContent: () => Promise.resolve(null),
        }),
      }),
    } as never;
    const result = await isFieldUiEnabled(fakePage);
    expect(result).toBe(true);
    expect(fakePage.goto).toHaveBeenCalledWith('/admin/structure/types', expect.any(Object));
  });
});
