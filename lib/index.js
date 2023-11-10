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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.expect = exports.test = void 0;
var test_1 = require("@playwright/test");
Object.defineProperty(exports, "expect", { enumerable: true, get: function () { return test_1.expect; } });
var child_process = __importStar(require("child_process"));
/**
 * Run task either inside of the web container or from the host.
 *
 * @param command
 */
function taskSync(command) {
    var ddev = process.env.DDEV_HOSTNAME ? 'task' : 'ddev task';
    return child_process.execSync("".concat(ddev, " ").concat(command), {
        cwd: process.env.DDEV_HOSTNAME ? '/var/www/html' : process.cwd(),
    });
}
/**
 * Run a task asynchronously. Console output is streamed.
 *
 * @param command
 */
function task(command) {
    var ddev = process.env.DDEV_HOSTNAME ? 'task' : 'ddev task';
    var options = {
        cwd: process.env.DDEV_HOSTNAME ? '/var/www/html' : process.cwd(),
    };
    var childProcess = child_process.exec("".concat(ddev, " ").concat(command), options);
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
/**
 * Keep a reference to the test ID so we can use it to attach the error log.
 */
var drupal_id;
/**
 * Set a simpletest cookie for routing the tests to a separate database.
 */
var test = test_1.test.extend({
    context: function (_a, use) {
        var context = _a.context, request = _a.request;
        return __awaiter(this, void 0, void 0, function () {
            var id, install;
            var _this = this;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (!process.env.PLAYWRIGHT_NO_TEST_ISOLATION) return [3 /*break*/, 2];
                        return [4 /*yield*/, use(context)];
                    case 1:
                        _b.sent();
                        return [2 /*return*/];
                    case 2:
                        id = Math.round(Math.random() * 1000000);
                        drupal_id = id;
                        install = task('test:playwright:prepare test_id=' + id);
                        install.on('exit', function (code) { return __awaiter(_this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                if (code === null || code > 0) {
                                    throw new Error("Task errored with exit code " + code);
                                }
                                return [2 /*return*/];
                            });
                        }); });
                        install.on('exit', function (code) { return __awaiter(_this, void 0, void 0, function () {
                            var ua;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        ua = taskSync('-o group test:playwright:ua test_id=' + id).toString();
                                        // let c: PlaywrightTestConfig= require('playwright.config.ts');
                                        return [4 /*yield*/, context.addCookies([{
                                                    name: 'SIMPLETEST_USER_AGENT',
                                                    value: ua,
                                                    path: '/',
                                                    // domain: c.use.baseURL,
                                                    domain: 'http://drupal/',
                                                }])];
                                    case 1:
                                        // let c: PlaywrightTestConfig= require('playwright.config.ts');
                                        _a.sent();
                                        // Mirror browser errors to the Playwright console log.
                                        context.on('weberror', function (webError) { return console.log(webError.error()); });
                                        // Clean up tests after they are complete.
                                        // This must be done when closing the context, and not in test.afterEach(),
                                        // as afterEach() still has a reference to a page object and active browser.
                                        context.on("close", function (browserContext) {
                                            task('test:playwright:cleanup test_id=' + id);
                                        });
                                        return [4 /*yield*/, use(context)];
                                    case 2:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        }); });
                        return [2 /*return*/];
                }
            });
        });
    },
});
exports.test = test;
