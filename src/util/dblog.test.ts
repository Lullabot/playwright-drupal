import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../testcase/test', () => ({
  execDrushInTestSite: vi.fn(),
}));

import { execDrushInTestSite } from '../testcase/test';
import {
  DblogSeverity,
  DEFAULT_DBLOG_CONFIG,
  DblogEntry,
  fetchDblogEntries,
  checkDblogForErrors,
  truncateDblog,
  formatLogErrors,
} from './dblog';

const mockedDrush = vi.mocked(execDrushInTestSite);

describe('DblogSeverity', () => {
  it('matches Drupal\'s RfcLogLevel names (lowercase)', () => {
    expect(DblogSeverity.EMERGENCY).toBe('emergency');
    expect(DblogSeverity.CRITICAL).toBe('critical');
    expect(DblogSeverity.ERROR).toBe('error');
    expect(DblogSeverity.WARNING).toBe('warning');
    expect(DblogSeverity.DEBUG).toBe('debug');
  });
});

describe('DEFAULT_DBLOG_CONFIG', () => {
  it('fails on CRITICAL and ERROR by default', () => {
    expect(DEFAULT_DBLOG_CONFIG.failOnSeverities).toEqual([
      DblogSeverity.CRITICAL,
      DblogSeverity.ERROR,
    ]);
  });
});

describe('truncateDblog', () => {
  beforeEach(() => mockedDrush.mockReset());

  it('calls drush watchdog:delete all -y', async () => {
    mockedDrush.mockResolvedValueOnce({ stdout: '', stderr: '' } as never);
    await truncateDblog();
    expect(mockedDrush).toHaveBeenCalledWith('watchdog:delete all -y');
  });
});

describe('fetchDblogEntries', () => {
  beforeEach(() => mockedDrush.mockReset());

  it('parses the Drush JSON object into an array of entries', async () => {
    mockedDrush.mockResolvedValueOnce({
      stdout: JSON.stringify({
        '42': {
          wid: '42',
          type: 'php',
          message: 'Undefined variable $foo',
          severity: 'Error',
          location: 'http://example.test/node/1',
          hostname: '127.0.0.1',
          date: '17/Apr 12:08',
          username: 'admin',
          uid: '1',
        },
        '41': {
          wid: '41',
          type: 'cron',
          message: 'Cron ran',
          severity: 'Notice',
          location: 'http://example.test/cron',
          hostname: '127.0.0.1',
          date: '17/Apr 12:00',
          username: 'Anonymous',
          uid: '0',
        },
      }),
      stderr: '',
    } as never);

    const entries = await fetchDblogEntries();
    expect(entries).toHaveLength(2);
    const byWid = Object.fromEntries(entries.map((e) => [e.wid, e]));
    expect(byWid['42']).toMatchObject({
      type: 'php',
      severity: 'error',
      username: 'admin',
    });
    expect(byWid['41'].severity).toBe('notice');
  });

  it('returns an empty array when Drush produces no output', async () => {
    mockedDrush.mockResolvedValueOnce({ stdout: '', stderr: '' } as never);
    expect(await fetchDblogEntries()).toEqual([]);
  });

  it('requests a high count cap and extended output by default', async () => {
    mockedDrush.mockResolvedValueOnce({ stdout: '', stderr: '' } as never);
    await fetchDblogEntries();
    const command = mockedDrush.mock.calls[0][0] as string;
    expect(command).toContain('watchdog:show');
    expect(command).toContain('--format=json');
    expect(command).toContain('--extended');
    expect(command).toMatch(/--count=\d{4,}/);
  });

  it('passes moduleFilter through as --type=', async () => {
    mockedDrush.mockResolvedValueOnce({ stdout: '', stderr: '' } as never);
    await fetchDblogEntries({ moduleFilter: 'php' });
    const command = mockedDrush.mock.calls[0][0] as string;
    expect(command).toContain('--type=php');
  });

  it('shell-quotes moduleFilter values with metacharacters', async () => {
    mockedDrush.mockResolvedValueOnce({ stdout: '', stderr: '' } as never);
    await fetchDblogEntries({ moduleFilter: 'php; rm -rf /' });
    const command = mockedDrush.mock.calls[0][0] as string;
    expect(command).toContain("--type='php; rm -rf /'");
  });

  it('propagates Drush errors instead of swallowing them', async () => {
    mockedDrush.mockRejectedValueOnce(new Error('drush unavailable'));
    await expect(fetchDblogEntries()).rejects.toThrow(/drush unavailable/);
  });
});

describe('checkDblogForErrors', () => {
  beforeEach(() => mockedDrush.mockReset());

  function stubEntries(entries: Partial<DblogEntry>[]) {
    const obj: Record<string, Partial<DblogEntry>> = {};
    entries.forEach((e, i) => {
      obj[String(i)] = e;
    });
    mockedDrush.mockResolvedValue({ stdout: JSON.stringify(obj), stderr: '' } as never);
  }

  it('keeps only entries whose severity is in failOnSeverities', async () => {
    stubEntries([
      { wid: '1', severity: 'Error', type: 'php', message: 'e' },
      { wid: '2', severity: 'Notice', type: 'cron', message: 'n' },
      { wid: '3', severity: 'Critical', type: 'ssl', message: 'c' },
      { wid: '4', severity: 'Warning', type: 'user', message: 'w' },
    ]);
    const errors = await checkDblogForErrors();
    expect(errors.map((e) => e.severity).sort()).toEqual(['critical', 'error']);
  });

  it('honours a custom failOnSeverities list', async () => {
    stubEntries([
      { wid: '1', severity: 'Warning', type: 'php', message: 'w' },
      { wid: '2', severity: 'Error', type: 'php', message: 'e' },
    ]);
    const warnings = await checkDblogForErrors({
      failOnSeverities: [DblogSeverity.WARNING],
    });
    expect(warnings).toHaveLength(1);
    expect(warnings[0].severity).toBe('warning');
  });
});

describe('formatLogErrors', () => {
  it('returns a friendly sentinel string when no entries are supplied', () => {
    expect(formatLogErrors([])).toBe('No errors found');
  });

  it('produces a numbered block with severity, type, message, date', () => {
    const entries: DblogEntry[] = [
      {
        wid: '1',
        type: 'php',
        message: 'Undefined variable $foo',
        severity: 'error',
        location: '',
        hostname: '',
        date: '2026-04-17 12:00',
        username: '',
        uid: '',
      },
      {
        wid: '2',
        type: 'cron',
        message: 'Task failed',
        severity: 'critical',
        location: '',
        hostname: '',
        date: '',
        username: '',
        uid: '',
      },
    ];
    const result = formatLogErrors(entries);
    expect(result).toContain('Found 2 critical/error log entries:');
    expect(result).toContain('[ERROR] php');
    expect(result).toContain('Undefined variable $foo');
    expect(result).toContain('2026-04-17 12:00');
    expect(result).toContain('[CRITICAL] cron');
    expect(result).toContain('Time: N/A');
  });
});
