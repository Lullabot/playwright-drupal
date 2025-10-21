"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.drushSync = drushSync;
exports.drush = drush;
var exec_1 = require("./exec");
/**
 * Run task either inside of the web container or from the host.
 *
 * @param command
 * @param options
 */
function drushSync(command, options) {
    return (0, exec_1.execSync)('drush', command, options);
}
/**
 * Run drush asynchronously. Console output is streamed.
 *
 * @param command
 */
function drush(command) {
    return (0, exec_1.exec)('drush', command);
}
