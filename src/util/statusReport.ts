import { execDrushInTestSite } from '../testcase/test';

/**
 * Drupal status-report utilities, driven via Drush.
 *
 * `getStatusReport` runs `drush core:requirements --format=json` and groups
 * the result by severity so tests can assert against specific outcomes
 * (e.g. "no errors" post-install) without scraping the admin page. Must run
 * inside a bootstrapped test site; the helpers share the `execDrushInTestSite`
 * lifecycle with `modules.ts` and `dblog.ts`.
 */

export interface StatusReportItem {
  /** Drupal's requirement machine name (e.g. `'cron'`, `'database_system'`). */
  id: string;
  title: string;
  severity: 'error' | 'warning' | 'info' | 'ok';
  description?: string;
  value?: string;
}

export interface StatusReportResult {
  errors: StatusReportItem[];
  warnings: StatusReportItem[];
  info: StatusReportItem[];
  ok: StatusReportItem[];
}

export interface StatusReportConfig {
  /** Array of item titles (or substrings) to ignore, case-insensitive. */
  ignoreItems?: string[];
  /** Array of warning titles that should fail the test. */
  failOnWarnings?: string[];
}

/**
 * Parse the string Drush emits in the `severity` field (`"OK"`, `"Warning"`,
 * `"Info"`, `"Error"`) into our lowercased union. Unknown values fall
 * through as `'ok'` (they don't count toward any failure bucket).
 */
function normaliseSeverity(raw: string): StatusReportItem['severity'] {
  switch (raw.toLowerCase()) {
    case 'error':
      return 'error';
    case 'warning':
      return 'warning';
    case 'info':
      return 'info';
    default:
      return 'ok';
  }
}

/**
 * Run `drush core:requirements --format=json` and return the items grouped
 * by severity.
 */
export async function getStatusReport(): Promise<StatusReportResult> {
  const result: StatusReportResult = { errors: [], warnings: [], info: [], ok: [] };

  const { stdout } = await execDrushInTestSite('core:requirements --format=json');
  const trimmed = stdout.trim();
  if (!trimmed) return result;

  const parsed = JSON.parse(trimmed) as Record<string, {
    title?: string;
    severity?: string;
    description?: string;
    value?: string;
  }>;

  for (const [id, entry] of Object.entries(parsed)) {
    const title = entry.title?.trim() || '';
    if (!title) continue;

    const item: StatusReportItem = {
      id,
      title,
      severity: normaliseSeverity(entry.severity ?? ''),
      description: entry.description?.trim() || undefined,
      value: entry.value?.trim() || undefined,
    };

    switch (item.severity) {
      case 'error':
        result.errors.push(item);
        break;
      case 'warning':
        result.warnings.push(item);
        break;
      case 'info':
        result.info.push(item);
        break;
      default:
        result.ok.push(item);
        break;
    }
  }

  return result;
}

/**
 * Filter a list of status items by the `ignoreItems` configuration
 * (case-insensitive substring match against the item title).
 */
export function filterStatusItems(
  items: StatusReportItem[],
  config?: StatusReportConfig,
): StatusReportItem[] {
  if (!config?.ignoreItems || config.ignoreItems.length === 0) {
    return items;
  }
  return items.filter((item) => {
    const lowerTitle = item.title.toLowerCase();
    return !config.ignoreItems!.some((pattern) => lowerTitle.includes(pattern.toLowerCase()));
  });
}

/**
 * Format status-report items as a human-readable block, suitable for use in
 * assertion messages.
 */
export function formatStatusItems(items: StatusReportItem[]): string {
  return items
    .map((item) => {
      let output = `• ${item.title}`;
      if (item.value && item.value !== item.title) {
        const snippet = item.value.length > 200 ? `${item.value.substring(0, 200)}...` : item.value;
        output += `\n  Details: ${snippet}`;
      }
      return output;
    })
    .join('\n\n');
}
