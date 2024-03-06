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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.takeAccessibleScreenshot = void 0;
var playwright_1 = __importDefault(require("@axe-core/playwright"));
var test_1 = require("@playwright/test");
var images_1 = require("./images");
var frames_1 = require("./frames");
/**
 * Take a visual comparison, and also ensure there's no accessibility issues.
 *
 * @param page The Page fixture from the test.
 * @param testInfo The testInfo object from the test.
 * @param options Screenshot options from toHaveScreenshot().
 * @param scrollLocator A locator to ensure is visible before taking the screenshot.
 * @param locator A specific locator to take the screenshot of. aXe still checks the whole page.
 */
function takeAccessibleScreenshot(page, testInfo, options, scrollLocator, locator) {
    var _a;
    return __awaiter(this, void 0, void 0, function () {
        var locatorToScreenshot, accessibilityScanResults, wcagScanResults;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    if (!options) {
                        options = {};
                    }
                    // The default is 5 seconds. However, even on a fast machine it can take
                    // longer than 5 seconds for large pages like node forms to stabilize. This
                    // doesn't affect end users because the page still being rendered is
                    // typically below the viewport, and it's loaded by the time they scroll.
                    // So, we set this to at least 10 seconds, unless it's already larger.
                    // To test changing this, try running this command and see if it times out:
                    options.timeout = Math.max((_a = options.timeout) !== null && _a !== void 0 ? _a : 0, 10000);
                    // Handle browsers that have strongly non-deterministic rendering of images.
                    if (testInfo.project.name == 'desktop firefox') {
                        options.threshold = 0.5;
                    }
                    if (testInfo.project.name == 'desktop safari') {
                        options.threshold = 0.8;
                    }
                    return [4 /*yield*/, (0, images_1.waitForAllImages)(page)];
                case 1:
                    _b.sent();
                    return [4 /*yield*/, (0, frames_1.waitForFrames)(page)];
                case 2:
                    _b.sent();
                    if (!scrollLocator) return [3 /*break*/, 4];
                    return [4 /*yield*/, scrollLocator.scrollIntoViewIfNeeded()];
                case 3:
                    _b.sent();
                    _b.label = 4;
                case 4:
                    locatorToScreenshot = page;
                    if (locator) {
                        locatorToScreenshot = locator;
                    }
                    // Soft failure here so we can get accessibility violations too.
                    return [4 /*yield*/, test_1.expect.soft(locatorToScreenshot).toHaveScreenshot(options)];
                case 5:
                    // Soft failure here so we can get accessibility violations too.
                    _b.sent();
                    return [4 /*yield*/, new playwright_1.default({ page: page })
                            .withTags(['best-practice'])
                            // Exclude "Skip to main content" anchor. See https://dequeuniversity.com/rules/axe/4.7/region?application=playwright
                            .exclude('.focusable.skip-link')
                            // Exclude duplicated landmarks. See https://dequeuniversity.com/rules/axe/4.7/landmark-unique?application=playwright
                            .exclude('[role="article"]')
                            .exclude('[role="region"]')
                            .exclude('.footer__inner-3')
                            .analyze()];
                case 6:
                    accessibilityScanResults = _b.sent();
                    return [4 /*yield*/, testInfo.attach('a11y-best-practice-scan-results', {
                            body: JSON.stringify(accessibilityScanResults, null, 2),
                            contentType: 'application/json'
                        })];
                case 7:
                    _b.sent();
                    test_1.expect.soft(violationFingerprints(accessibilityScanResults)).toMatchSnapshot();
                    return [4 /*yield*/, new playwright_1.default({ page: page })
                            .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
                            .exclude('[data-drupal-media-preview="ready"]')
                            .analyze()];
                case 8:
                    wcagScanResults = _b.sent();
                    return [4 /*yield*/, testInfo.attach('a11y-wcag-scan-results', {
                            body: JSON.stringify(wcagScanResults, null, 2),
                            contentType: 'application/json'
                        })];
                case 9:
                    _b.sent();
                    return [2 /*return*/, (0, test_1.expect)(violationFingerprints(wcagScanResults)).toMatchSnapshot()];
            }
        });
    });
}
exports.takeAccessibleScreenshot = takeAccessibleScreenshot;
/**
 * Filter violations down to stable elements.
 *
 * If we try to create a snapshot of the entire report, it will fail on random
 * unique HTML IDs.
 *
 * @param accessibilityScanResults
 */
function violationFingerprints(accessibilityScanResults) {
    var uniqueHtmlID = /(#.*)--\d+/;
    var ariaLabelledById = /(aria-labelledby="[^"]+)--\d+"/;
    var violationFingerprints = accessibilityScanResults.violations.map(function (violation) { return ({
        rule: violation.id,
        // These are CSS selectors which uniquely identify each element with
        // a violation of the rule in question.
        targets: violation.nodes.map(function (node) { return node.target.map(function (target) {
            // If the violation is within an iframe, the target may be an array.
            if (typeof target == "string") {
                return target.replace(uniqueHtmlID, "$1--UNIQUE-ID")
                    .replace(ariaLabelledById, '$1--UNIQUE-ID"');
            }
            return target;
        }); }),
    }); });
    return JSON.stringify(violationFingerprints, null, 2);
}
