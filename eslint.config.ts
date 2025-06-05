import js from "@eslint/js"
import tsParser from "@typescript-eslint/parser"
import oxlint from "eslint-plugin-oxlint"
import globals from "globals"

import { createTypeScriptImportResolver } from "eslint-import-resolver-typescript"
import { flatConfigs } from "eslint-plugin-import-x"
import { configs as tsEslintConfigs } from "typescript-eslint"

export default [
  {
    ignores: [ "**/dist/", "**/node_modules/" ],
  },
  js.configs.all,
  ...tsEslintConfigs.recommended,
  flatConfigs.recommended,
  flatConfigs.typescript,
  {
    files: [ "**/*.{js,ts}" ],
    linterOptions: {
      reportUnusedDisableDirectives: true,
    },
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.node,
      },
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        tsconfigRootDir: import.meta.dirname,
      },
    },
    settings: {
      "import-x/parsers": {
        "@typescript-eslint/parser": [ ".ts" ],
      },
      "import-x/resolver-next": [
        createTypeScriptImportResolver({
          alwaysTryTypes: false,
          project: "tsconfig.json",
        }),
      ],
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
          ignoreRestSiblings: true,
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
      "capitalized-comments": "off",
      "complexity": [ "warn", { max: 30 }],
      "curly": [ "warn", "all" ],
      "id-length": "off",
      "import-x/no-unresolved": [ "error" ],
      "max-statements": "off",
      "no-underscore-dangle": "off",
      "no-useless-assignment": "off",
      "one-var": "off",
      "prefer-named-capture-group": "off",
      "require-unicode-regexp": "off",
    },
  },
  ...oxlint.configs["flat/all"],
]
