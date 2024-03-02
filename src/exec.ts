import child_process from "child_process";

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
    childProcess.stdout.on('data', (data) => {
      console.log(data.toString());
    });
    childProcess.stderr.on('data', (data) => {
      console.log(data.toString());
    });
  }

  return childProcess;
}
