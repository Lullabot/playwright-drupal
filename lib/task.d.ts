/// <reference types="node" />
/**
 * Run task either inside of the web container or from the host.
 *
 * @param command
 * @param options
 */
export declare function taskSync(command: string, options?: any): string;
/**
 * Run a task asynchronously. Console output is streamed.
 *
 * @param command
 */
export declare function task(command: string): import("child_process").ChildProcess;
