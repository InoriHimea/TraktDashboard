import js from "@eslint/js";
import jsxA11y from "eslint-plugin-jsx-a11y";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";

export default tseslint.config(
    {
        ignores: [
            "**/dist/**",
            "**/node_modules/**",
            "**/.turbo/**",
            "**/.agents/**",
            "**/coverage/**",
            "**/.codegraph/**",
            "apps/web/public/sw.js",
            "packages/db/drizzle/**",
        ],
    },
    js.configs.recommended,
    ...tseslint.configs.recommended,
    {
        files: ["**/*.{js,mjs,cjs}"],
        languageOptions: {
            globals: {
                ...globals.node,
            },
        },
    },
    {
        // Browser-side public scripts (e.g. service-worker registration) run in the
        // browser, not Node — give them browser + service-worker globals.
        files: ["apps/web/public/**/*.js"],
        languageOptions: {
            globals: {
                ...globals.browser,
                ...globals.serviceworker,
            },
        },
    },
    {
        // Shared TypeScript rules (P3-T06): apply to every package regardless of runtime.
        files: ["**/*.{ts,tsx}"],
        rules: {
            "prefer-const": "error",
            "no-undef": "off",
            "no-unused-vars": "off",
            "@typescript-eslint/no-explicit-any": "error",
            "@typescript-eslint/no-unused-vars": [
                "error",
                {
                    argsIgnorePattern: "^_",
                    varsIgnorePattern: "^_",
                    caughtErrorsIgnorePattern: "^_",
                },
            ],
        },
    },
    {
        // Web app (P3-T06): browser runtime + React/Hooks/a11y rules.
        files: ["apps/web/**/*.{ts,tsx}"],
        languageOptions: {
            parserOptions: {
                ecmaFeatures: { jsx: true },
            },
            globals: {
                ...globals.browser,
                ...globals.vitest,
            },
        },
        plugins: {
            "react-hooks": reactHooks,
            "jsx-a11y": jsxA11y,
        },
        rules: {
            ...reactHooks.configs.recommended.rules,
            ...jsxA11y.configs.recommended.rules,
            // a11y violations block CI (P1-T09).
            "jsx-a11y/click-events-have-key-events": "error",
            "jsx-a11y/label-has-associated-control": "error",
            "jsx-a11y/no-static-element-interactions": "error",
            // Intentionally non-blocking warnings (P1-T09 policy): the existing "sync local
            // state from fetched data / one-shot init" effects are an accepted pattern.
            "react-hooks/set-state-in-effect": "warn",
            "react-hooks/exhaustive-deps": "warn",
        },
    },
    {
        // API + workspace packages (P3-T06): Node/Bun runtime, no React/DOM/a11y rules.
        files: ["apps/api/**/*.ts", "packages/**/*.ts"],
        languageOptions: {
            globals: {
                ...globals.node,
                ...globals.vitest,
            },
        },
    },
    {
        // Test files use `any` for lightweight mocks — allowed (P1-T09).
        files: ["**/*.{test,spec}.{ts,tsx}", "**/__tests__/**"],
        rules: {
            "@typescript-eslint/no-explicit-any": "off",
        },
    },
    // Must be last: disables ESLint rules that conflict with Prettier formatting (P1-T08).
    prettier,
);
