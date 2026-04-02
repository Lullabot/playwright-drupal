/**
 * Captures CLI command output for attachment to test results.
 *
 * By default, output from drush/task commands and browser web errors is
 * buffered and attached to test results as files. Set
 * PLAYWRIGHT_DRUPAL_VERBOSE=1 to print output inline instead.
 */

export interface OutputEntry {
  label: string;
  stdout: string;
  stderr: string;
}

export class OutputCollector {
  private entries: OutputEntry[] = [];
  private current: OutputEntry | null = null;
  private webErrors: string[] = [];

  startCommand(label: string): void {
    this.current = { label: sanitizeLabel(label), stdout: '', stderr: '' };
  }

  appendStdout(data: string): void {
    if (this.current) {
      this.current.stdout += data;
    }
  }

  appendStderr(data: string): void {
    if (this.current) {
      this.current.stderr += data;
    }
  }

  finishCommand(): void {
    if (this.current) {
      this.entries.push(this.current);
      this.current = null;
    }
  }

  addWebError(message: string): void {
    this.webErrors.push(message);
  }

  getEntries(): OutputEntry[] {
    return [...this.entries];
  }

  getWebErrors(): string[] {
    return [...this.webErrors];
  }

  reset(): void {
    this.entries = [];
    this.current = null;
    this.webErrors = [];
  }
}

export function isVerbose(): boolean {
  return process.env.PLAYWRIGHT_DRUPAL_VERBOSE === '1' || process.env.PLAYWRIGHT_DRUPAL_VERBOSE === 'true';
}

/**
 * Convert a command string into a safe attachment label.
 */
export function sanitizeLabel(command: string): string {
  return command
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
    .slice(0, 80);
}

export const collector = new OutputCollector();
