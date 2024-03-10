"use strict";
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
exports.VisualDiffTestCases = exports.defaultTestFunction = exports.defineVisualDiffConfig = void 0;
var test_1 = require("@playwright/test");
var util_1 = require("../util");
function defineVisualDiffConfig(cases) {
    return new VisualDiffTestCases(cases);
}
exports.defineVisualDiffConfig = defineVisualDiffConfig;
function defaultTestFunction(testCase, group) {
    var _this = this;
    // @ts-ignore
    return function (_a, testInfo) {
        var page = _a.page, context = _a.context;
        return __awaiter(_this, void 0, void 0, function () {
            var representativeUrl, path;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        // Log any errors to the Playwright console too.
                        context.on('weberror', function (webError) { return console.log(webError.error()); });
                        testInfo.annotations.push({
                            type: 'Description',
                            description: testCase.description,
                        });
                        representativeUrl = "";
                        if (testCase.representativeUrl) {
                            representativeUrl = testCase.representativeUrl;
                        }
                        else if (group.representativeUrl) {
                            representativeUrl = group.representativeUrl;
                        }
                        if (representativeUrl) {
                            testInfo.annotations.push({
                                type: 'Representative URL',
                                description: representativeUrl,
                            });
                        }
                        path = testCase.path;
                        if (group.pathPrefix) {
                            path = group.pathPrefix + path;
                        }
                        return [4 /*yield*/, page.goto(path)];
                    case 1:
                        _b.sent();
                        return [4 /*yield*/, (0, util_1.takeAccessibleScreenshot)(page, testInfo, { fullPage: true })];
                    case 2:
                        _b.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
}
exports.defaultTestFunction = defaultTestFunction;
/**
 * Execute a set of visual diffs against groups of test cases.
 */
var VisualDiffTestCases = /** @class */ (function () {
    /**
     * Construct a new set of VisualDiffTestCases
     *
     * @param config The config that has been imported via "import ..."
     */
    function VisualDiffTestCases(config) {
        this.config = config;
    }
    /**
     * Describe, execute, and skip test cases
     *
     * @param overriddenTestFunction
     */
    VisualDiffTestCases.prototype.describe = function (overriddenTestFunction) {
        // Handle skipping of test cases, either based on a simple boolean or a callback.
        function doSkip(testCase) {
            var _this = this;
            if (typeof testCase.skip !== 'undefined' && (typeof testCase.skip.callback == 'undefined' || testCase.skip.callback(testCase))) {
                // eslint-disable-ext-line @typescript-eslint/no-unused-vars
                test_1.test.skip("".concat(testCase.name, ": ").concat(testCase.skip.reason, " <").concat(testCase.skip.willBeFixedIn, ">"), function (_a, testInfo) {
                    var page = _a.page;
                    return __awaiter(_this, void 0, void 0, function () {
                        return __generator(this, function (_b) {
                            return [2 /*return*/];
                        });
                    });
                });
            }
        }
        this.config.groups.forEach(function (group) {
            // Allow skipping of entire groups of tests.
            if (group.skip) {
                doSkip(group);
                return;
            }
            // Actually describe the group.
            test_1.test.describe(group.name, function () {
                group.testCases.forEach((function (testCase) {
                    // Allow skipping of individual test cases.
                    if (testCase.skip) {
                        doSkip(testCase);
                        return;
                    }
                    // Define a default function for test cases.
                    var testFunction;
                    if (typeof overriddenTestFunction != 'function') {
                        testFunction = defaultTestFunction(testCase, group);
                    }
                    else {
                        testFunction = overriddenTestFunction(testCase, group);
                    }
                    (0, test_1.test)("".concat(testCase.name, ": ").concat(testCase.path), testFunction);
                }));
            });
        });
    };
    return VisualDiffTestCases;
}());
exports.VisualDiffTestCases = VisualDiffTestCases;
