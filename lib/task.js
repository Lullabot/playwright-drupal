"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.task = exports.taskSync = void 0;
var exec_1 = require("./exec");
/**
 * Run task either inside of the web container or from the host.
 *
 * @param command
 * @param options
 */
function taskSync(command, options) {
    return (0, exec_1.execSync)('task', command, options);
}
exports.taskSync = taskSync;
/**
 * Run a task asynchronously. Console output is streamed.
 *
 * @param command
 */
function task(command) {
    return (0, exec_1.exec)('task', command);
}
exports.task = task;
