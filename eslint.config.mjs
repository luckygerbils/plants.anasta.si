// @ts-check

import globals from "globals";
import js from "@eslint/js";
import react from "@eslint-react/eslint-plugin";
import ts from "typescript-eslint";

export default [
  js.configs.recommended,
  react.configs.recommended,
  ...ts.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    rules: {
      // @eslint-react/hooks-extra recommended rules
      "@eslint-react/hooks-extra/no-direct-set-state-in-use-effect": "warn",
      "@eslint-react/hooks-extra/no-direct-set-state-in-use-layout-effect": "warn",
      "@eslint-react/hooks-extra/prefer-use-state-lazy-initialization": "warn",
    }
  },
  { 
    languageOptions: { 
      globals: globals.browser 
    },
    settings: {
      react: {
        version: "detect",
      }
    }
  },
  {
    rules: {
        "@typescript-eslint/no-unused-vars": "off",
        "@typescript-eslint/no-empty-object-type": ["error", { "allowInterfaces": "always" }],
    }
  },
  {
    ignores: ["dist/**/*"]
  }
];