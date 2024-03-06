/// <reference types="node" />
import child_process from "child_process";
/**
 * Run a command either inside of the web container or from the host.
 *
 * @param command
 * @param options
 */
export declare function execSync(baseCommand: string, command: string, options: any): string;
/**
 * Run a command asynchronously. Console output is streamed.
 *
 * @param command
 */
export declare function exec(baseCommand: string, command: string): child_process.ChildProcess;
