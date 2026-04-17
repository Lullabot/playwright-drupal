import { quote as shellQuote } from 'shell-quote';
import { execDrushInTestSite } from '../testcase/test';
import { isModuleEnabled } from './modules';

/**
 * Drupal `dblog` (database log) utilities, driven via Drush.
 *
 * Provides a small surface for test suites that want to treat Drupal log
 * entries as assertions: truncate the log at the start of a test, drive the
 * system under test, then fail if any `error` / `critical` entries landed.
 *
 * Everything here goes through `execDrushInTestSite` (`watchdog:show`,
 * `watchdog:delete`) so the functions must run inside the bootstrapped test
 * site this package manages. That's the same constraint as the `modules`
 * probes.
 */

/**
 * Severity levels, matching Drupal's RfcLogLevel names (lowercase).
 */
export enum DblogSeverity {
  EMERGENCY = 'emergency',
  ALERT = 'alert',
  CRITICAL = 'critical',
  ERROR = 'error',
  WARNING = 'warning',
  NOTICE = 'notice',
  INFO = 'info',
  DEBUG = 'debug',
}

/**
 * Configuration for dblog fetching / assertion.
 */
export interface DblogMonitorConfig {
  /** Severity levels that should cause test failure. Default: [CRITICAL, ERROR]. */
  failOnSeverities?: DblogSeverity[];
  /** Limit results to a single Drupal log type (e.g. `'php'`, `'cron'`). */
  moduleFilter?: string;
}

/**
 * A single watchdog entry as returned by `drush watchdog:show --format=json
 * --extended`. `severity` is lowercased to match `DblogSeverity`.
 */
export interface DblogEntry {
  wid: string;
  type: string;
  message: string;
  severity: string;
  location: string;
  hostname: string;
  date: string;
  username: string;
  uid: string;
}

/**
 * Default configuration for dblog monitoring.
 */
export const DEFAULT_DBLOG_CONFIG: DblogMonitorConfig = {
  failOnSeverities: [DblogSeverity.CRITICAL, DblogSeverity.ERROR],
};

/**
 * High count cap passed to `drush watchdog:show --count=…`. Drush's own
 * default is 10 — way too low for test assertions. This cap is high enough
 * that any reasonable test flow stays below it while avoiding unbounded
 * output in pathological scenarios.
 */
const DRUSH_FETCH_COUNT_CAP = 10_000;

/**
 * Check whether the `dblog` module is enabled on the test site.
 */
export async function isDblogEnabled(): Promise<boolean> {
  return isModuleEnabled('dblog');
}

/**
 * Delete all watchdog messages on the test site.
 */
export async function truncateDblog(): Promise<void> {
  await execDrushInTestSite('watchdog:delete all -y');
}

/**
 * Fetch watchdog entries via `drush watchdog:show`. Returns the full set
 * (up to the internal count cap), with severities normalised to lowercase
 * so they line up with the `DblogSeverity` enum.
 */
export async function fetchDblogEntries(
  config: DblogMonitorConfig = DEFAULT_DBLOG_CONFIG,
): Promise<DblogEntry[]> {
  let command = `watchdog:show --format=json --extended --count=${DRUSH_FETCH_COUNT_CAP}`;
  if (config.moduleFilter) {
    command += ` --type=${shellQuote([config.moduleFilter])}`;
  }
  const result = await execDrushInTestSite(command);
  const stdout = result.stdout.trim();
  if (!stdout) return [];

  const parsed = JSON.parse(stdout) as Record<string, Record<string, string>>;
  return Object.values(parsed).map((entry) => ({
    wid: entry.wid ?? '',
    type: entry.type ?? '',
    message: entry.message ?? '',
    severity: (entry.severity ?? '').toLowerCase(),
    location: entry.location ?? '',
    hostname: entry.hostname ?? '',
    date: entry.date ?? '',
    username: entry.username ?? '',
    uid: entry.uid ?? '',
  }));
}

/**
 * Fetch dblog entries and return only those whose severity is in
 * `config.failOnSeverities`. Defaults to `CRITICAL` + `ERROR`.
 */
export async function checkDblogForErrors(
  config: DblogMonitorConfig = DEFAULT_DBLOG_CONFIG,
): Promise<DblogEntry[]> {
  const merged = { ...DEFAULT_DBLOG_CONFIG, ...config };
  const entries = await fetchDblogEntries(merged);
  const failOn = new Set<string>(merged.failOnSeverities ?? []);
  return entries.filter((e) => failOn.has(e.severity));
}

/**
 * Format log entries for error reporting.
 */
export function formatLogErrors(entries: DblogEntry[]): string {
  if (entries.length === 0) {
    return 'No errors found';
  }

  const lines = entries.map((entry, index) => {
    return `${index + 1}. [${entry.severity.toUpperCase()}] ${entry.type}\n   Message: ${entry.message}\n   Time: ${entry.date || 'N/A'}`;
  });

  return `Found ${entries.length} critical/error log entries:\n\n${lines.join('\n\n')}`;
}
