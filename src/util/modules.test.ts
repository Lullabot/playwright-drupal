import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../testcase/test', () => ({
  execDrushInTestSite: vi.fn(),
}));

import { execDrushInTestSite } from '../testcase/test';
import { isModuleEnabled, validateRequiredModules } from './modules';

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

  it('propagates Drush errors instead of swallowing them as missing', async () => {
    mockedDrush.mockRejectedValueOnce(new Error('drush unavailable'));
    await expect(
      validateRequiredModules({} as never, ['field_ui']),
    ).rejects.toThrow(/drush unavailable/);
  });
});
