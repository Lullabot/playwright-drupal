/**
 * Run task either inside of the web container or from the host.
 *
 * @param command
 * @param options
 */
export declare function drushSync(command: string, options?: any): string;
/**
 * Run drush asynchronously. Console output is streamed.
 *
 * @param command
 */
export declare function drush(command: string): import("child_process").ChildProcess;
