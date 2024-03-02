import {exec, execSync} from "./exec";

/**
 * Run task either inside of the web container or from the host.
 *
 * @param command
 * @param options
 */
export function taskSync(command: string, options?: any) {
  return execSync('task', command, options);
}

/**
 * Run a task asynchronously. Console output is streamed.
 *
 * @param command
 */
export function task(command: string) {
  return exec('task', command);
}
