import child_process from "child_process";
import {collector, isVerbose} from "./output-collector";

/**
 * Run a command either inside of the web container or from the host.
 *
 * @param command
 * @param options
 */
export function execSync(baseCommand: string, command: string, options: any) {
  let ddev = process.env.DDEV_HOSTNAME ? baseCommand : 'ddev ' + baseCommand;

  if (!options) {
    options = {}
  }

  options.cwd = process.env.DDEV_HOSTNAME ? '/var/www/html' : process.cwd();

  if (!isVerbose() && options.stdio !== 'inherit') {
    const label = `${baseCommand}-${command}`;
    const result = child_process.execSync(`${ddev} ${command}`, options);
    collector.startCommand(label);
    collector.appendStdout(result.toString());
    collector.finishCommand();
    return result;
  }

  return child_process.execSync(`${ddev} ${command}`, options);
}

/**
 * Run a command asynchronously. Console output is streamed.
 *
 * @param command
 */
export function exec(baseCommand: string, command: string) {
  let ddev = process.env.DDEV_HOSTNAME ? baseCommand : 'ddev ' + baseCommand;

  let options = {
    cwd: process.env.DDEV_HOSTNAME ? '/var/www/html' : process.cwd(),
  };

  let childProcess = child_process.exec(`${ddev} ${command}`, options);
  if (childProcess.stdout && childProcess.stderr) {
    if (isVerbose()) {
      childProcess.stdout.on('data', (data) => {
        console.log(data.toString());
      });
      childProcess.stderr.on('data', (data) => {
        console.log(data.toString());
      });
    } else {
      const label = `${baseCommand}-${command}`;
      collector.startCommand(label);
      childProcess.stdout.on('data', (data) => {
        collector.appendStdout(data.toString());
      });
      childProcess.stderr.on('data', (data) => {
        collector.appendStderr(data.toString());
      });
      childProcess.on('exit', () => {
        collector.finishCommand();
      });
    }
  }

  return childProcess;
}
