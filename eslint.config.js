import js from "@eslint/js";
import globals from "globals";

const unusedVars = ["error", {
  args: "after-used",
  argsIgnorePattern: "^_",
  varsIgnorePattern: "^_",
  caughtErrors: "all",
  caughtErrorsIgnorePattern: "^_"
}];

export default [
  {
    ignores: [
      "node_modules/**",
      "build/**",
      "coverage/**",
      "test-results/**",
      "playwright-report/**",
      "blob-report/**",
      "tmp/**",
      "**/*.min.js",
      "**/*.map"
    ]
  },
  js.configs.recommended,
  {
    // Frontend (browser) ESM source.
    files: ["src/**/*.js", "script.js"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      globals: { ...globals.browser }
    },
    rules: {
      "no-unused-vars": unusedVars
    }
  },
  {
    // Node ESM test/tooling code. Browser globals are included because these
    // tests both simulate a DOM in Node and run code inside Playwright
    // page.evaluate()/addInitScript() callbacks (browser execution context).
    files: ["tests/**/*.mjs"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      globals: { ...globals.node, ...globals.browser }
    },
    rules: {
      // Test files intentionally import the full module surface for coverage,
      // so a large number of imports are unused per file. Keep the rule strict
      // for first-party src/ code and relax it for tests only.
      "no-unused-vars": "off"
    }
  },
  {
    // Node CommonJS reporters/helpers.
    files: ["tests/**/*.cjs"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "commonjs",
      globals: { ...globals.node, ...globals.browser }
    },
    rules: {
      "no-unused-vars": unusedVars
    }
  }
];
