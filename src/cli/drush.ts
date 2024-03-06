import {exec, execSync} from "./exec";

/**
 * Run task either inside of the web container or from the host.
 *
 * @param command
 * @param options
 */
export function drushSync(command: string, options?: any) {
  return execSync('drush', command, options);
}

/**
 * Run drush asynchronously. Console output is streamed.
 *
 * @param command
 */
export function drush(command: string) {
  return exec('drush', command);
}

