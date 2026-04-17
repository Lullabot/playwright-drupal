import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../testcase/test', () => ({
  execDrushInTestSite: vi.fn(),
}));

import { execDrushInTestSite } from '../testcase/test';
import {
  getStatusReport,
  filterStatusItems,
  formatStatusItems,
  StatusReportItem,
} from './statusReport';

const mockedDrush = vi.mocked(execDrushInTestSite);

describe('getStatusReport', () => {
  beforeEach(() => mockedDrush.mockReset());

  it('runs drush core:requirements --format=json', async () => {
    mockedDrush.mockResolvedValueOnce({ stdout: '{}', stderr: '' } as never);
    await getStatusReport();
    expect(mockedDrush).toHaveBeenCalledWith('core:requirements --format=json');
  });

  it('groups entries by severity and preserves the requirement id', async () => {
    mockedDrush.mockResolvedValueOnce({
      stdout: JSON.stringify({
        cron: { title: 'Cron maintenance tasks', severity: 'Info', description: '', value: 'Last run 1 hour ago' },
        drupal: { title: 'Drupal', severity: 'Info', description: '', value: '11.3.7' },
        database_system: { title: 'Database system', severity: 'OK', description: '', value: 'MariaDB' },
        configuration_files: {
          title: 'Configuration files',
          severity: 'Warning',
          description: 'settings.php is writable',
          value: 'Protection disabled',
        },
        update_status: {
          title: 'Out-of-date modules',
          severity: 'Error',
          description: '',
          value: 'Five modules need updating',
        },
      }),
      stderr: '',
    } as never);

    const report = await getStatusReport();
    expect(report.errors).toHaveLength(1);
    expect(report.errors[0]).toMatchObject({
      id: 'update_status',
      title: 'Out-of-date modules',
      severity: 'error',
      value: 'Five modules need updating',
    });
    expect(report.warnings).toHaveLength(1);
    expect(report.warnings[0].id).toBe('configuration_files');
    expect(report.info.map((i) => i.id).sort()).toEqual(['cron', 'drupal']);
    expect(report.ok.map((i) => i.id)).toEqual(['database_system']);
  });

  it('skips entries without a title', async () => {
    mockedDrush.mockResolvedValueOnce({
      stdout: JSON.stringify({
        empty: { title: '', severity: 'OK' },
        present: { title: 'Present', severity: 'OK' },
      }),
      stderr: '',
    } as never);
    const report = await getStatusReport();
    expect(report.ok.map((i) => i.id)).toEqual(['present']);
  });

  it('treats unknown severity strings as ok rather than throwing', async () => {
    mockedDrush.mockResolvedValueOnce({
      stdout: JSON.stringify({ weird: { title: 'Weird', severity: 'Mystery' } }),
      stderr: '',
    } as never);
    const report = await getStatusReport();
    expect(report.ok).toHaveLength(1);
    expect(report.errors).toEqual([]);
  });

  it('returns empty buckets when Drush produces no output', async () => {
    mockedDrush.mockResolvedValueOnce({ stdout: '', stderr: '' } as never);
    const report = await getStatusReport();
    expect(report).toEqual({ errors: [], warnings: [], info: [], ok: [] });
  });

  it('propagates Drush errors instead of swallowing them', async () => {
    mockedDrush.mockRejectedValueOnce(new Error('drush unavailable'));
    await expect(getStatusReport()).rejects.toThrow(/drush unavailable/);
  });
});

describe('filterStatusItems', () => {
  const items: StatusReportItem[] = [
    { id: 'drupal', title: 'Drupal core', severity: 'ok' },
    { id: 'update_status', title: 'Update status', severity: 'warning' },
    { id: 'cron', title: 'Cron maintenance tasks', severity: 'info' },
  ];

  it('returns input unchanged when no config is provided', () => {
    expect(filterStatusItems(items)).toEqual(items);
  });

  it('drops items whose title matches any ignore substring (case-insensitive)', () => {
    const filtered = filterStatusItems(items, { ignoreItems: ['cron', 'UPDATE'] });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe('drupal');
  });
});

describe('formatStatusItems', () => {
  it('produces a bulleted block with optional details', () => {
    const out = formatStatusItems([
      { id: 'foo', title: 'Foo', severity: 'ok', value: 'Foo' },
      { id: 'bar', title: 'Bar', severity: 'warning', value: 'Some details about Bar' },
    ]);
    expect(out).toContain('• Foo');
    expect(out).toContain('• Bar');
    expect(out).toContain('Details: Some details about Bar');
  });

  it('truncates very long values to 200 chars with an ellipsis', () => {
    const long = 'x'.repeat(250);
    const out = formatStatusItems([{ id: 'big', title: 'Big', severity: 'ok', value: long }]);
    expect(out).toContain('...');
    expect(out.length).toBeLessThan(long.length + 50);
  });
});
