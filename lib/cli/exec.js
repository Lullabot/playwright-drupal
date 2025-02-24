"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.execSync = execSync;
exports.exec = exec;
var child_process_1 = __importDefault(require("child_process"));
/**
 * Run a command either inside of the web container or from the host.
 *
 * @param command
 * @param options
 */
function execSync(baseCommand, command, options) {
    var ddev = process.env.DDEV_HOSTNAME ? baseCommand : 'ddev ' + baseCommand;
    if (!options) {
        options = {};
    }
    options.cwd = process.env.DDEV_HOSTNAME ? '/var/www/html' : process.cwd();
    return child_process_1.default.execSync("".concat(ddev, " ").concat(command), options);
}
/**
 * Run a command asynchronously. Console output is streamed.
 *
 * @param command
 */
function exec(baseCommand, command) {
    var ddev = process.env.DDEV_HOSTNAME ? baseCommand : 'ddev ' + baseCommand;
    var options = {
        cwd: process.env.DDEV_HOSTNAME ? '/var/www/html' : process.cwd(),
    };
    var childProcess = child_process_1.default.exec("".concat(ddev, " ").concat(command), options);
    if (childProcess.stdout && childProcess.stderr) {
        childProcess.stdout.on('data', function (data) {
            console.log(data.toString());
        });
        childProcess.stderr.on('data', function (data) {
            console.log(data.toString());
        });
    }
    return childProcess;
}
