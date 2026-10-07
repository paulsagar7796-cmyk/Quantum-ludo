import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "test-results/**",
      "playwright-report/**",
      "**/dev-dist/**",
      "supabase/functions/rooms/qludo.js",
      "supabase/.temp/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["apps/web/src/**/*.{ts,tsx}"],
    languageOptions: { globals: globals.browser },
    plugins: { "react-hooks": reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
  {
    files: ["packages/**/*.ts", "e2e/**/*.ts", "*.config.ts"],
    languageOptions: { globals: globals.node },
  },
  prettier,
);
