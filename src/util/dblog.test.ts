import { describe, it, expect } from 'vitest';
import {
  DblogSeverity,
  DEFAULT_DBLOG_CONFIG,
  formatLogErrors,
  DblogEntry,
} from './dblog';

describe('DblogSeverity', () => {
  it('exposes Drupal\'s standard severity keys as lowercase string values', () => {
    expect(DblogSeverity.EMERGENCY).toBe('emergency');
    expect(DblogSeverity.ALERT).toBe('alert');
    expect(DblogSeverity.CRITICAL).toBe('critical');
    expect(DblogSeverity.ERROR).toBe('error');
    expect(DblogSeverity.WARNING).toBe('warning');
    expect(DblogSeverity.NOTICE).toBe('notice');
    expect(DblogSeverity.INFO).toBe('info');
    expect(DblogSeverity.DEBUG).toBe('debug');
  });
});

describe('DEFAULT_DBLOG_CONFIG', () => {
  it('fails on critical + error by default', () => {
    expect(DEFAULT_DBLOG_CONFIG.failOnSeverities).toEqual([
      DblogSeverity.CRITICAL,
      DblogSeverity.ERROR,
    ]);
  });

  it('walks paginated results by default', () => {
    expect(DEFAULT_DBLOG_CONFIG.checkAllPages).toBe(true);
  });
});

describe('formatLogErrors', () => {
  it('returns a friendly sentinel string when no entries are supplied', () => {
    expect(formatLogErrors([])).toBe('No errors found');
  });

  it('produces a numbered block with severity, type, message, timestamp', () => {
    const entries: DblogEntry[] = [
      { severity: 'error', type: 'php', message: 'Undefined variable $foo', timestamp: '2026-04-16 12:00' },
      { severity: 'critical', type: 'cron', message: 'Task failed', timestamp: '' },
    ];
    const result = formatLogErrors(entries);
    expect(result).toContain('Found 2 critical/error log entries:');
    expect(result).toContain('[ERROR] php');
    expect(result).toContain('Undefined variable $foo');
    expect(result).toContain('2026-04-16 12:00');
    expect(result).toContain('[CRITICAL] cron');
    expect(result).toContain('Time: N/A'); // empty timestamp → N/A
  });
});
