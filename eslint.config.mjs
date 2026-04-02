import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default [
  {
    ignores: [
      "**/dist/**",
      "**/coverage/**",
      "node_modules/**",
      "apps/web/src/*.js",
      "apps/web/src/*.test.js"
    ]
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.browser
      }
    },
    rules: {
      "no-console": ["warn", { "allow": ["info", "warn", "error"] }]
    }
  }
];
