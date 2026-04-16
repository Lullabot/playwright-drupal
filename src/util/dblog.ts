import { Page } from '@playwright/test';

/**
 * Drupal `dblog` (database log) utilities.
 *
 * Provides a small surface for test suites that want to treat Drupal log
 * entries as assertions: truncate the log at the start of a test, drive the
 * system under test, then fail if any `error` / `critical` entries landed.
 */

/**
 * Severity levels that can be monitored in Drupal's dblog.
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
 * Configuration for dblog monitoring.
 */
export interface DblogMonitorConfig {
  /** Severity levels that should cause test failure. Default: [CRITICAL, ERROR]. */
  failOnSeverities?: DblogSeverity[];
  /** Whether to check all pages if logs are paginated. Default: true. */
  checkAllPages?: boolean;
  /** Module-specific filter (optional). */
  moduleFilter?: string;
}

/**
 * Structure of a log entry extracted from the dblog admin page.
 */
export interface DblogEntry {
  severity: string;
  type: string;
  message: string;
  timestamp: string;
  user?: string;
}

/**
 * Default configuration for dblog monitoring.
 */
export const DEFAULT_DBLOG_CONFIG: DblogMonitorConfig = {
  failOnSeverities: [DblogSeverity.CRITICAL, DblogSeverity.ERROR],
  checkAllPages: true,
};

/**
 * Check whether the `dblog` module is enabled by visiting its admin page.
 */
export async function isDblogEnabled(page: Page): Promise<boolean> {
  try {
    const response = await page.goto('/admin/reports/dblog');
    if (response?.ok()) {
      const hasLogTable = await page
        .locator('table.dblog-event-list, div.view-dblog, table')
        .count();
      return hasLogTable > 0;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Truncate all log messages in the database log.
 */
export async function truncateDblog(page: Page): Promise<void> {
  await page.goto('/admin/reports/dblog/confirm');
  await page.waitForSelector('form', { timeout: 5000 });
  const confirmButton = page.locator(
    'input[type="submit"][value*="Clear"], input[type="submit"][value*="Confirm"], input[type="submit"].button--primary',
  );
  if ((await confirmButton.count()) === 0) {
    throw new Error('truncateDblog: could not find a confirmation button');
  }
  await confirmButton.first().click();
}

async function extractLogEntriesFromPage(page: Page): Promise<DblogEntry[]> {
  const entries: DblogEntry[] = [];
  const tableLocator = page.locator('table');
  await tableLocator.first().waitFor({ timeout: 5000 });

  const rows = page.locator('table tbody tr, table tr:not(:first-child)');
  const rowCount = await rows.count();

  for (let i = 0; i < rowCount; i++) {
    const row = rows.nth(i);

    let severity = '';
    const severityCell = row.locator('td').first();
    const severityImg = severityCell.locator('img');
    if ((await severityImg.count()) > 0) {
      const alt = await severityImg.getAttribute('alt');
      severity = alt?.toLowerCase() || '';
    }
    if (!severity) {
      const severityText = await severityCell.textContent();
      severity = severityText?.trim().toLowerCase() || '';
    }

    const cells = row.locator('td');
    const cellCount = await cells.count();

    let type = '';
    let message = '';
    let timestamp = '';

    if (cellCount >= 3) {
      type = (await cells.nth(1).textContent())?.trim() || '';
      message = (await cells.nth(2).textContent())?.trim() || '';
    }
    if (cellCount >= 4) {
      timestamp = (await cells.nth(cellCount - 2).textContent())?.trim() || '';
    }

    entries.push({ severity, type, message, timestamp });
  }

  return entries;
}

async function hasNextPage(page: Page): Promise<boolean> {
  const nextLink = page.locator(
    'nav.pager a[title*="next" i], nav.pager a.pager__item--next, li.pager__item--next a, a[rel="next"]',
  );
  return (await nextLink.count()) > 0;
}

async function goToNextPage(page: Page): Promise<void> {
  const nextLink = page.locator(
    'nav.pager a[title*="next" i], nav.pager a.pager__item--next, li.pager__item--next a, a[rel="next"]',
  );
  if ((await nextLink.count()) > 0) {
    await nextLink.first().click();
    await page.waitForLoadState('domcontentloaded');
  }
}

/**
 * Fetch all log entries from dblog, handling pagination when configured.
 */
export async function fetchDblogEntries(
  page: Page,
  config: DblogMonitorConfig = DEFAULT_DBLOG_CONFIG,
): Promise<DblogEntry[]> {
  const allEntries: DblogEntry[] = [];

  await page.goto('/admin/reports/dblog');

  const noLogsMessage = page
    .getByText(/no log messages available/i)
    .or(page.locator('.empty-text'))
    .or(page.locator('.view-empty'));
  if ((await noLogsMessage.count()) > 0) {
    return allEntries;
  }

  let entries = await extractLogEntriesFromPage(page);
  allEntries.push(...entries);

  if (config.checkAllPages !== false) {
    while (await hasNextPage(page)) {
      await goToNextPage(page);
      entries = await extractLogEntriesFromPage(page);
      allEntries.push(...entries);
    }
  }

  return allEntries;
}

/**
 * Fetch dblog entries and return only those matching the configured severity
 * levels. Defaults to `ERROR` and `CRITICAL`.
 */
export async function checkDblogForErrors(
  page: Page,
  config: DblogMonitorConfig = DEFAULT_DBLOG_CONFIG,
): Promise<DblogEntry[]> {
  const mergedConfig = { ...DEFAULT_DBLOG_CONFIG, ...config };
  const allEntries = await fetchDblogEntries(page, mergedConfig);

  const failureSeverities = mergedConfig.failOnSeverities || [];
  return allEntries.filter((entry) => {
    const entrySeverity = entry.severity.toLowerCase();
    return failureSeverities.some((sev) => entrySeverity.includes(sev));
  });
}

/**
 * Format log entries for error reporting.
 */
export function formatLogErrors(entries: DblogEntry[]): string {
  if (entries.length === 0) {
    return 'No errors found';
  }

  const lines = entries.map((entry, index) => {
    return `${index + 1}. [${entry.severity.toUpperCase()}] ${entry.type}\n   Message: ${entry.message}\n   Time: ${entry.timestamp || 'N/A'}`;
  });

  return `Found ${entries.length} critical/error log entries:\n\n${lines.join('\n\n')}`;
}
