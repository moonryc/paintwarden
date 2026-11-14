module.exports = {
  root: true,
  ignorePatterns: [
    "**/node_modules/**",
    "**/dist/**",
    "**/build/**",
    "apps/paintwarden/drizzle/**",
    "apps/paintwarden-electron/desktop-server/**",
  ],
  overrides: [
    {
      files: [
        "apps/paintwarden/**/*.ts",
        "apps/paintwarden-web/**/*.ts",
        "apps/paintwarden-web/**/*.tsx",
        "apps/paintwarden-site/**/*.ts",
        "apps/paintwarden-site/**/*.tsx",
        "packages/**/*.ts",
        "packages/**/*.tsx",
      ],
      parser: "@typescript-eslint/parser",
      parserOptions: {
        project: [
          "./apps/paintwarden/tsconfig.json",
          "./apps/paintwarden-web/tsconfig.json",
          "./apps/paintwarden-site/tsconfig.json",
          "./packages/paint-core/tsconfig.json",
          "./packages/vault-ui/tsconfig.json",
        ],
        tsconfigRootDir: __dirname,
      },
      plugins: ["@typescript-eslint", "import", "sonarjs"],
      extends: [
        "eslint:recommended",
        "plugin:@typescript-eslint/recommended",
        "plugin:@typescript-eslint/recommended-requiring-type-checking",
        "plugin:import/recommended",
        "plugin:import/typescript",
        "plugin:sonarjs/recommended",
        "plugin:prettier/recommended",
      ],
      settings: {
        "import/resolver": {
          typescript: {
            project: [
              "./apps/paintwarden/tsconfig.json",
              "./apps/paintwarden-web/tsconfig.json",
              "./apps/paintwarden-site/tsconfig.json",
              "./packages/paint-core/tsconfig.json",
              "./packages/vault-ui/tsconfig.json",
            ],
          },
        },
      },
      rules: {
        "no-console": "error",
        "max-lines": ["error", 500],
        "no-restricted-syntax": [
          "error",
          {
            selector: "CallExpression[callee.property.name='toFixed']",
            message: "Use an explicit numeric rounding helper instead of toFixed().",
          },
        ],
        "import/order": [
          "warn",
          {
            groups: ["builtin", "external", "internal", "parent", "sibling"],
            "newlines-between": "always",
            alphabetize: { order: "asc", caseInsensitive: true },
          },
        ],
        "@typescript-eslint/consistent-type-imports": "error",
        "@typescript-eslint/no-unused-vars": [
          "error",
          { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
        ],
        "@typescript-eslint/no-floating-promises": "warn",
        "@typescript-eslint/no-misused-promises": ["error", { checksVoidReturn: false }],
        "@typescript-eslint/no-unsafe-argument": "warn",
        "@typescript-eslint/no-unsafe-assignment": "warn",
        "@typescript-eslint/no-unsafe-call": "warn",
        "@typescript-eslint/no-unsafe-member-access": "warn",
        "@typescript-eslint/no-unsafe-return": "warn",
        "@typescript-eslint/unbound-method": "warn",
        "@typescript-eslint/require-await": "off",
        "import/default": "off",
        "sonarjs/no-duplicate-string": "warn",
        "sonarjs/cognitive-complexity": "warn",
        "sonarjs/no-nested-template-literals": "warn",
      },
    },
    {
      files: [
        "apps/paintwarden-web/**/*.tsx",
        "apps/paintwarden-site/**/*.tsx",
        "packages/vault-ui/**/*.tsx",
      ],
      plugins: ["react", "react-hooks", "jsx-a11y"],
      extends: ["plugin:react/recommended", "plugin:jsx-a11y/recommended", "plugin:prettier/recommended"],
      settings: { react: { version: "detect" } },
      rules: {
        "max-lines": ["warn", 500],
        "react/prop-types": "off",
        "react/react-in-jsx-scope": "off",
        "react/jsx-filename-extension": ["error", { extensions: [".tsx"] }],
        "react/no-unstable-nested-components": "warn",
        "react/no-multi-comp": "warn",
        // Inline handlers are ordinary in React 19 function components.
        "react/jsx-no-bind": "off",
        // sx objects repeat theme tokens such as "var(--ink-faint)" by design.
        "sonarjs/no-duplicate-string": "off",
        "react-hooks/exhaustive-deps": "error",
        "react-hooks/rules-of-hooks": "error",
        "jsx-a11y/click-events-have-key-events": "warn",
        "jsx-a11y/no-autofocus": "warn",
        "jsx-a11y/no-static-element-interactions": "warn",
        "no-restricted-imports": [
          "error",
          {
            paths: [
              { name: "lodash", message: "Import the Lodash method directly, for example lodash/uniq." },
            ],
          },
        ],
        "no-restricted-globals": [
          "error",
          { name: "React", message: "Import React members explicitly." },
          { name: "_", message: "Import Lodash methods explicitly." },
        ],
      },
    },
    {
      files: [
        "apps/paintwarden/**/*.ts",
        "apps/paintwarden-web/**/*.ts",
        "apps/paintwarden-web/**/*.tsx",
        "apps/paintwarden-site/**/*.ts",
        "apps/paintwarden-site/**/*.tsx",
        "packages/paint-core/**/*.ts",
      ],
      rules: {
        "@typescript-eslint/no-unsafe-argument": "error",
        "@typescript-eslint/no-unsafe-assignment": "error",
        "@typescript-eslint/no-unsafe-call": "error",
        "@typescript-eslint/no-unsafe-member-access": "error",
        "@typescript-eslint/no-unsafe-return": "error",
      },
    },
    {
      files: ["packages/vault-ui/**/*.ts"],
      rules: { "max-lines": ["warn", 500] },
    },
    {
      files: ["apps/paintwarden/**/*.test.ts", "packages/**/*.test.ts"],
      rules: {
        "sonarjs/no-duplicate-string": "off",
        "max-lines": ["error", 1000],
        "@typescript-eslint/no-unsafe-assignment": "off",
        "@typescript-eslint/no-unsafe-member-access": "off",
        "@typescript-eslint/no-unsafe-call": "off",
      },
    },
  ],
};
