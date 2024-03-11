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
exports.waitForAllImages = exports.waitForImages = void 0;
/**
 * Wait for images specified by a selector to load.
 *
 * The function must scroll the page to handle lazy-loading images. After all
 * images have loaded, the page is scrolled back to the top.
 *
 * See https://github.com/microsoft/playwright/issues/14388 for further details.
 *
 * @param page
 * @param selector
 */
function waitForImages(page, selector) {
    return __awaiter(this, void 0, void 0, function () {
        var locators, _i, _a, l, promises, forcedScroll;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    locators = page.locator(selector);
                    _i = 0;
                    return [4 /*yield*/, locators.all()];
                case 1:
                    _a = _b.sent();
                    _b.label = 2;
                case 2:
                    if (!(_i < _a.length)) return [3 /*break*/, 6];
                    l = _a[_i];
                    return [4 /*yield*/, l.evaluate(function (image) { return image.isConnected; })];
                case 3:
                    if (!_b.sent()) return [3 /*break*/, 5];
                    return [4 /*yield*/, l.scrollIntoViewIfNeeded()];
                case 4:
                    _b.sent();
                    _b.label = 5;
                case 5:
                    _i++;
                    return [3 /*break*/, 2];
                case 6: return [4 /*yield*/, locators.all()];
                case 7:
                    promises = (_b.sent()).map(function (locator) { return locator.evaluate(function (image) {
                        // Make sure 1x1 images that are visually hidden for accessibility (like
                        // on the Umami home page) don't hang waiting for the image to load. Even
                        // though the images are :visible, Chrome doesn't load the image at desktop
                        // widths.
                        // See https://www.tpgi.com/the-anatomy-of-visually-hidden/ for details on
                        // how .visually-hidden works.
                        // @ts-ignore
                        return ((image.width <= 1 && image.height <= 1) || image.complete || new Promise(function (f) { return image.onload = f; }));
                    }); });
                    return [4 /*yield*/, Promise.all(promises)];
                case 8:
                    _b.sent();
                    // Scroll to the top.
                    return [4 /*yield*/, page.evaluate(function () {
                            return window.scroll({
                                top: 0,
                                left: 0,
                                behavior: 'instant',
                            });
                        })];
                case 9:
                    // Scroll to the top.
                    _b.sent();
                    return [4 /*yield*/, page.locator('#toolbar-administration').count()];
                case 10:
                    if (!((_b.sent()) > 0)) return [3 /*break*/, 12];
                    return [4 /*yield*/, page.waitForTimeout(250)];
                case 11:
                    _b.sent();
                    _b.label = 12;
                case 12:
                    forcedScroll = false;
                    return [2 /*return*/, page.waitForFunction(function (forcedScroll) {
                            // The above scroll can fail when a Drupal dialog is open. So, if we
                            // haven't scrolled successfully, we trigger another one.
                            if (window.scrollY !== 0 && !forcedScroll) {
                                window.scroll({
                                    top: 0,
                                    left: 0,
                                    behavior: 'instant',
                                });
                                // But only trigger this once, so we don't override previous scroll
                                // calls.
                                forcedScroll = true;
                            }
                            return window.scrollY == 0;
                        }, forcedScroll)];
            }
        });
    });
}
exports.waitForImages = waitForImages;
/**
 * Wait for all image tags on the page to load.
 *
 * @param page
 */
function waitForAllImages(page) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, waitForImages(page, 'img:visible')];
        });
    });
}
exports.waitForAllImages = waitForAllImages;
