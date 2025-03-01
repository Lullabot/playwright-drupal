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
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
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
exports.waitForFrames = waitForFrames;
/**
 * Wait for all frames to load.
 *
 * @param page
 */
function waitForFrames(page) {
    return __awaiter(this, void 0, void 0, function () {
        var locators, _i, _a, locator, element, frame;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, page.locator('iframe')];
                case 1:
                    locators = _b.sent();
                    _i = 0;
                    return [4 /*yield*/, locators.all()];
                case 2:
                    _a = _b.sent();
                    _b.label = 3;
                case 3:
                    if (!(_i < _a.length)) return [3 /*break*/, 12];
                    locator = _a[_i];
                    return [4 /*yield*/, locator.evaluate(function (iframe) { return iframe.isConnected; })];
                case 4:
                    if (!_b.sent()) return [3 /*break*/, 11];
                    return [4 /*yield*/, locator.isVisible()];
                case 5:
                    if (!_b.sent()) return [3 /*break*/, 11];
                    return [4 /*yield*/, locator.scrollIntoViewIfNeeded()];
                case 6:
                    _b.sent();
                    return [4 /*yield*/, locator.scrollIntoViewIfNeeded()];
                case 7:
                    _b.sent();
                    return [4 /*yield*/, locator.elementHandle()];
                case 8:
                    element = _b.sent();
                    return [4 /*yield*/, (element === null || element === void 0 ? void 0 : element.contentFrame())];
                case 9:
                    frame = _b.sent();
                    return [4 /*yield*/, (frame === null || frame === void 0 ? void 0 : frame.waitForURL(new RegExp('.*/.*', 'i')))];
                case 10:
                    _b.sent();
                    _b.label = 11;
                case 11:
                    _i++;
                    return [3 /*break*/, 3];
                case 12: return [2 /*return*/];
            }
        });
    });
}
