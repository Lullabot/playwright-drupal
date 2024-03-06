"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var fs = __importStar(require("fs"));
var path_1 = __importDefault(require("path"));
var task_1 = require("../cli/task");
/**
 * Global setup callback for Playwright
 *
 * https://playwright.dev/docs/test-global-setup-teardown#option-2-configure-globalsetup-and-globalteardown
 * @param config
 */
function globalSetup(config) {
    // We cannot directly reference the files in the node_modules directory,
    // otherwise Playwright's TypeScript processing gets confused.
    copyDirectory('node_modules/playwright-drupal/src', 'packages/playwright-drupal');
    // Make sure we have the initial site database.
    installBaseDrupalSite();
}
/**
 * Copy a directory recursively.
 *
 * @param src
 * @param dest
 */
function copyDirectory(src, dest) {
    try {
        fs.mkdirSync(dest, { recursive: true });
        var entries = fs.readdirSync(src, { withFileTypes: true });
        for (var _i = 0, entries_1 = entries; _i < entries_1.length; _i++) {
            var entry = entries_1[_i];
            var srcPath = path_1.default.join(src, entry.name);
            var destPath = path_1.default.join(dest, entry.name);
            if (entry.isDirectory()) {
                copyDirectory(srcPath, destPath);
            }
            else {
                fs.copyFileSync(srcPath, destPath);
            }
        }
    }
    catch (error) {
        console.error('Error occurred:', error);
    }
}
/**
 * Call task to do a site install.
 */
function installBaseDrupalSite() {
    if (!fs.existsSync('/tmp/sqlite/.ht.sqlite')) {
        (0, task_1.taskSync)('playwright:install', { stdio: 'inherit' });
    }
    else {
        console.log("/tmp/sqlite/.ht.sqlite exists. Not installing Drupal. Run task playwright:install to reinstall if needed.");
    }
}
exports.default = globalSetup;
