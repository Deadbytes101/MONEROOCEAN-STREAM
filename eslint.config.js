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
    // Stricter shared ruleset applied across all first-party linted files
    // (frontend source, root scripts, and Node test/tooling code). Vendored,
    // build, and ignored paths are excluded via the top-level `ignores`.
    files: ["src/**/*.js", "script.js", "tests/**/*.mjs", "tests/**/*.cjs"],
    rules: {
      "no-throw-literal": "error",
      "default-case-last": "error",
      "no-unused-expressions": "error",
      "no-var": "error",
      "no-else-return": "error",
      "prefer-const": "error",
      "eqeqeq": ["error", "always", { "null": "ignore" }],
      "no-implicit-coercion": "error",
      "object-shorthand": "error",
      "prefer-template": "error",
      "no-shadow": "error",
      "no-param-reassign": "error"
    }
  },
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
      // Strict like the rest of the repo. The underscore-ignore convention
      // (argsIgnorePattern/varsIgnorePattern "^_") still applies.
      "no-unused-vars": unusedVars
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
