import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import prettier from "eslint-config-prettier/flat";
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfig(
  globalIgnores([
    ".agents/**",
    ".ai/**",
    ".claude/**",
    ".codex/**",
    "**/lib/**",
    "tmp/**",
    "site/**",
    "**/coverage/**",
    "**/test-results/**",
    "**/playwright-report/**",
  ]),
  {
    files: ["**/*.{js,mjs,cjs,ts}", "**/bin/github-*"],
    ignores: ["docs/javascripts/*.js"],
    extends: [js.configs.recommended],
    languageOptions: { globals: globals.node },
  },
  {
    files: ["**/*.ts"],
    extends: [tseslint.configs.recommended],
    rules: {
      // Existing APIs and partial test doubles use any; type cleanup is separate.
      "@typescript-eslint/no-explicit-any": "off",
      // Destructuring deliberately omits package options before calling Playwright.
      "@typescript-eslint/no-unused-vars": [
        "error",
        { ignoreRestSiblings: true },
      ],
    },
  },
  {
    files: ["commitlint.config.js", "**/bin/github-*"],
    languageOptions: { sourceType: "commonjs" },
  },
  {
    files: ["docs/javascripts/*.js"],
    extends: [js.configs.recommended],
    languageOptions: { globals: globals.browser },
  },
  prettier,
);
